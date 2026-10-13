const { HttpsError } = require('firebase-functions/v2/https');
const { createGpsCleanup } = require('./gpsCleanup');

const VALID_DOCUMENT_ID = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 1500 &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/');

const SAFE_ERROR_CODES = new Set([
  'aborted',
  'deadline-exceeded',
  'internal',
  'resource-exhausted',
  'unavailable',
]);

const getSafeErrorCode = (error) => {
  const value = error?.code;
  const code = typeof value === 'number' ? String(value) : value;
  const normalized = typeof code === 'string' ? code.toLowerCase() : '';
  if (normalized === '4') return 'deadline-exceeded';
  if (normalized === '8') return 'resource-exhausted';
  if (normalized === '10') return 'aborted';
  if (normalized === '13') return 'internal';
  if (normalized === '14') return 'unavailable';
  return SAFE_ERROR_CODES.has(normalized) ? normalized : 'unknown';
};

const createStopTrackingHandler = ({
  createRepository,
  getUserProfile,
  logger = (entry) => console.info('GPS cleanup', entry),
  HttpsErrorClass = HttpsError,
}) => {
  if (typeof createRepository !== 'function' || typeof getUserProfile !== 'function') {
    throw new TypeError('stopTracking requires repository and profile providers.');
  }
  if (typeof logger !== 'function') {
    throw new TypeError('stopTracking requires an injected logger.');
  }

  return async (request) => {
    const uid = request?.auth?.uid;
    if (typeof uid !== 'string' || uid.length === 0) {
      throw new HttpsErrorClass('unauthenticated', 'Authentication is required.');
    }

    const matchId = request.data?.matchId;
    if (!VALID_DOCUMENT_ID(matchId)) {
      throw new HttpsErrorClass('invalid-argument', 'A valid matchId is required.');
    }

    let userProfile;
    try {
      userProfile = await getUserProfile(uid);
    } catch (error) {
      logger({
        operation: 'stop_tracking_authorization',
        result: 'failed',
        errorCode: getSafeErrorCode(error),
      });
      throw new HttpsErrorClass('internal', 'Unable to stop tracking.');
    }

    if (userProfile?.role !== 'driver' || userProfile?.approved !== true) {
      throw new HttpsErrorClass('permission-denied', 'Only approved drivers can stop tracking.');
    }

    let repository;
    try {
      repository = await createRepository();
    } catch (error) {
      logger({
        operation: 'stop_tracking_repository',
        result: 'failed',
        errorCode: getSafeErrorCode(error),
      });
      throw new HttpsErrorClass('internal', 'Unable to stop tracking.');
    }

    const cleanup = createGpsCleanup({
      repository,
      authorizer: {
        authorizeMatchCleanup: async (requestedMatchId) => ({
          authorized: requestedMatchId === matchId,
          matchId: requestedMatchId,
          owner: { field: 'driverId', uid },
        }),
        getAuthorizedDriverId: async () => uid,
      },
      logger,
    });

    const result = await cleanup.cleanupMatchCurrentTracking(matchId);
    if (result.status === 'deleted') {
      return { status: 'stopped', locationDeleted: true };
    }
    if (result.status === 'missing') {
      return { status: 'already-stopped', locationDeleted: false };
    }
    if (result.status === 'match-missing') {
      throw new HttpsErrorClass('not-found', 'Match not found.');
    }
    if (result.status === 'denied') {
      throw new HttpsErrorClass('permission-denied', 'Only the match driver can stop tracking.');
    }
    if (result.status === 'skipped') {
      throw new HttpsErrorClass(
        'failed-precondition',
        'Tracking can only be stopped for an active match.'
      );
    }

    throw new HttpsErrorClass('internal', 'Unable to stop tracking.');
  };
};

module.exports = {
  createStopTrackingHandler,
  isValidMatchDocumentId: VALID_DOCUMENT_ID,
};
