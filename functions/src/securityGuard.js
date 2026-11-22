/**
 * Security Guard & Rate Limiting Module (Big Tech Standard)
 *
 * Provides transactional rate limiting, App Check options configuration,
 * and telemetry validation for anti-spoofing.
 */

const { HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

/**
 * Enforces transactional rate limiting per user action.
 */
async function enforceRateLimit(db, { uid, action, maxRequests = 10, windowMs = 600000 }) {
  if (!uid || !action) {
    throw new HttpsError('invalid-argument', 'uid and action are required for rate limiting.');
  }

  const rateLimitRef = db.collection('rateLimits').doc(`${uid}_${action}`);
  const now = Date.now();

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(rateLimitRef);
    let data = snap.exists ? snap.data() : { count: 0, windowStart: now };

    if (now - data.windowStart > windowMs) {
      data = { count: 1, windowStart: now };
    } else {
      data.count += 1;
    }

    if (data.count > maxRequests) {
      throw new HttpsError(
        'resource-exhausted',
        `Rate limit exceeded for action [${action}]. Please try again later.`
      );
    }

    transaction.set(rateLimitRef, data, { merge: true });
  });
}

/**
 * Returns callable options including configurable App Check enforcement.
 */
function getCallableSecurityOptions(extraOptions = {}) {
  return {
    enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true',
    consumeAppCheckToken: false,
    ...extraOptions,
  };
}

/**
 * Validates location telemetry to detect impossible GPS jumps (anti-spoofing).
 */
async function validateLocationTelemetry(db, { userId, prevPoint, nextPoint, maxSpeedMps = 45 }) {
  if (!prevPoint || !nextPoint) return true;

  const toRadians = (deg) => (deg * Math.PI) / 180;
  const R = 6371000; // meters
  const dLat = toRadians(nextPoint.latitude - prevPoint.latitude);
  const dLon = toRadians(nextPoint.longitude - prevPoint.longitude);
  const lat1 = toRadians(prevPoint.latitude);
  const lat2 = toRadians(nextPoint.latitude);

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const distance = 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));

  const timeDeltaSec = Math.abs(nextPoint.timestamp - prevPoint.timestamp) / 1000;
  if (timeDeltaSec <= 0) return true;

  const speed = distance / timeDeltaSec;

  if (speed > maxSpeedMps) {
    // Log telemetry anomaly
    try {
      await db.collection('securityAuditLogs').add({
        type: 'GPS_SPOOFING_ANOMALY',
        userId: userId || 'unknown',
        calculatedSpeedMps: speed,
        distanceMeters: distance,
        timeDeltaSec,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.warn('Failed to log security audit anomaly:', err?.message);
    }
    return false;
  }

  return true;
}

module.exports = {
  enforceRateLimit,
  getCallableSecurityOptions,
  validateLocationTelemetry,
};
