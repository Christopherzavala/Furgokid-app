const { HttpsError } = require('firebase-functions/v2/https');

const VALID_DOCUMENT_ID = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 1500 &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/');

const createTrackingAuthorizationHandler = ({
  getUserProfile,
  getMatch,
  HttpsErrorClass = HttpsError,
}) => {
  if (typeof getUserProfile !== 'function' || typeof getMatch !== 'function') {
    throw new TypeError('Tracking authorization requires profile and match providers.');
  }

  return async (request) => {
    const uid = request?.auth?.uid;
    if (!VALID_DOCUMENT_ID(uid)) {
      throw new HttpsErrorClass('unauthenticated', 'Authentication is required.');
    }

    const matchId = request?.data?.matchId;
    if (!VALID_DOCUMENT_ID(matchId)) {
      throw new HttpsErrorClass('invalid-argument', 'A valid matchId is required.');
    }

    const [profile, match] = await Promise.all([getUserProfile(uid), getMatch(matchId)]);
    if (!profile || profile.role !== 'driver' || profile.approved !== true) {
      throw new HttpsErrorClass('permission-denied', 'An approved driver profile is required.');
    }
    if (!match) {
      throw new HttpsErrorClass('not-found', 'Match not found.');
    }
    if (match.status !== 'active' || match.driverId !== uid) {
      throw new HttpsErrorClass('permission-denied', 'The driver is not assigned to this match.');
    }

    return { matchId };
  };
};

module.exports = {
  createTrackingAuthorizationHandler,
};
