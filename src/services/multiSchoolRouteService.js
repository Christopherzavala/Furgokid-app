/**
 * Multi-School Route Service (Ola 3 - #2)
 *
 * Connects driver UI to Cloud Functions for multi-school route creation,
 * ETA computation, and stop advancement (completing or skipping stops).
 */

import { collection, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../config/firebase';

const assertAuthenticated = () => {
  if (!auth.currentUser) {
    const error = new Error('Authentication is required.');
    error.code = 'unauthenticated';
    throw error;
  }
};

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function computeOrderedStopsAndEta(stops = [], originLocation = null, averageSpeedKmh = 28) {
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

export const saveMultiSchoolRoute = async (payload) => {
  assertAuthenticated();
  const fn = httpsCallable(functions, 'saveMultiSchoolRoute');
  const result = await fn(payload);
  return result.data;
};

export const advanceRouteStop = async ({ routeId, stopId, status, currentLocation }) => {
  assertAuthenticated();
  const fn = httpsCallable(functions, 'advanceRouteStop');
  const result = await fn({ routeId, stopId, status, currentLocation });
  return result.data;
};

export const fetchDriverRoutes = async (driverId) => {
  assertAuthenticated();
  if (!driverId) return [];
  const q = query(collection(db, 'routes'), where('driverId', '==', driverId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
};
