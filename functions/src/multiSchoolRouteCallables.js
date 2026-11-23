/**
 * Multi-School Route Engine & ETA Calculator (Ola 3 - #2)
 *
 * Allows verified drivers to create and manage multi-school, multi-stop routes,
 * calculating ETAs via Haversine distance and skipping stops automatically when absences are reported.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { enforceRateLimit, getCallableSecurityOptions } = require('./securityGuard');

const VALID_DOCUMENT_ID = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 1500 &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/');

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function computeOrderedStopsAndEta(stops = [], originLocation = null, averageSpeedKmh = 28) {
  const sortedStops = [...stops].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  let currentLoc =
    originLocation && typeof originLocation.latitude === 'number' ? originLocation : null;
  let cumulativeMin = 0;

  return sortedStops.map((stop) => {
    const status = stop.status || 'PENDING';
    if (status === 'COMPLETED' || status === 'SKIPPED') {
      return {
        ...stop,
        status,
        estimatedArrivalMin: null,
      };
    }

    if (
      stop.location &&
      typeof stop.location.latitude === 'number' &&
      typeof stop.location.longitude === 'number'
    ) {
      if (currentLoc) {
        const distKm = haversineDistanceKm(
          currentLoc.latitude,
          currentLoc.longitude,
          stop.location.latitude,
          stop.location.longitude
        );
        const segmentMin = Math.max(1, Math.round((distKm / averageSpeedKmh) * 60));
        cumulativeMin += segmentMin;
      } else {
        cumulativeMin = 0;
      }
      currentLoc = stop.location;
      return {
        ...stop,
        status: 'PENDING',
        estimatedArrivalMin: cumulativeMin,
      };
    }

    return {
      ...stop,
      status: 'PENDING',
      estimatedArrivalMin: null,
    };
  });
}

exports.saveMultiSchoolRoute = onCall(getCallableSecurityOptions(), async (request) => {
  const driverUid = request?.auth?.uid;
  if (!driverUid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }

  const db = admin.firestore();
  await enforceRateLimit(db, {
    uid: driverUid,
    action: 'saveMultiSchoolRoute',
    maxRequests: 10,
    windowMs: 10 * 60 * 1000,
  });

  const driverDoc = await db.collection('users').doc(driverUid).get();
  if (
    !driverDoc.exists ||
    driverDoc.data()?.role !== 'driver' ||
    driverDoc.data()?.approved !== true
  ) {
    throw new HttpsError(
      'permission-denied',
      'Only approved drivers can create multi-school routes.'
    );
  }

  const { routeId: customRouteId, name, shift, stops, originLocation } = request?.data || {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new HttpsError('invalid-argument', 'Valid route name is required.');
  }
  if (shift !== 'morning' && shift !== 'afternoon') {
    throw new HttpsError('invalid-argument', 'Shift must be "morning" or "afternoon".');
  }
  if (!Array.isArray(stops) || stops.length === 0) {
    throw new HttpsError('invalid-argument', 'At least one route stop is required.');
  }

  // Validate coordinates of each stop
  stops.forEach((stop, index) => {
    if (!stop.stopId || typeof stop.stopId !== 'string') {
      throw new HttpsError('invalid-argument', `Stop at index ${index} must have a valid stopId.`);
    }
    const validTypes = ['pickup', 'dropoff', 'school'];
    if (!validTypes.includes(stop.type)) {
      throw new HttpsError(
        'invalid-argument',
        `Stop ${stop.stopId} must have a valid type (pickup, dropoff, school).`
      );
    }
    if (stop.location) {
      const { latitude, longitude } = stop.location;
      if (
        typeof latitude !== 'number' ||
        latitude < -90 ||
        latitude > 90 ||
        typeof longitude !== 'number' ||
        longitude < -180 ||
        longitude > 180
      ) {
        throw new HttpsError(
          'invalid-argument',
          `Stop ${stop.stopId} has invalid GPS coordinates.`
        );
      }
    }
  });

  const routeId =
    customRouteId && VALID_DOCUMENT_ID(customRouteId)
      ? customRouteId
      : `route_${driverUid}_${shift}_${Date.now()}`;

  const computedStops = computeOrderedStopsAndEta(stops, originLocation);
  const serverNow = admin.firestore.FieldValue.serverTimestamp();

  const routeData = {
    routeId,
    driverId: driverUid,
    name: name.trim(),
    shift,
    stops: computedStops,
    status: 'ACTIVE',
    updatedAt: serverNow,
    createdAt: serverNow,
  };

  await db.collection('routes').doc(routeId).set(routeData, { merge: true });

  return {
    success: true,
    routeId,
    stopsCount: computedStops.length,
    status: 'ACTIVE',
  };
});

exports.advanceRouteStop = onCall(getCallableSecurityOptions(), async (request) => {
  const driverUid = request?.auth?.uid;
  if (!driverUid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }

  const { routeId, stopId, status, currentLocation } = request?.data || {};
  if (!VALID_DOCUMENT_ID(routeId) || !stopId) {
    throw new HttpsError('invalid-argument', 'Valid routeId and stopId are required.');
  }
  if (status !== 'COMPLETED' && status !== 'SKIPPED') {
    throw new HttpsError('invalid-argument', 'Status must be "COMPLETED" or "SKIPPED".');
  }

  const db = admin.firestore();
  const routeRef = db.collection('routes').doc(routeId);
  const routeSnap = await routeRef.get();

  if (!routeSnap.exists) {
    throw new HttpsError('not-found', 'Route not found.');
  }
  const routeData = routeSnap.data();

  if (routeData.driverId !== driverUid) {
    throw new HttpsError('permission-denied', 'Only the assigned driver can advance stops.');
  }

  const updatedStops = (routeData.stops || []).map((s) => {
    if (s.stopId === stopId) {
      return {
        ...s,
        status,
        updatedAt: new Date().toISOString(),
      };
    }
    return s;
  });

  const recomputedStops = computeOrderedStopsAndEta(updatedStops, currentLocation);
  const serverNow = admin.firestore.FieldValue.serverTimestamp();

  await routeRef.update({
    stops: recomputedStops,
    updatedAt: serverNow,
  });

  return {
    success: true,
    routeId,
    stopId,
    status,
    stops: recomputedStops,
  };
});

module.exports = {
  computeOrderedStopsAndEta,
  haversineDistanceKm,
  saveMultiSchoolRoute: exports.saveMultiSchoolRoute,
  advanceRouteStop: exports.advanceRouteStop,
};
