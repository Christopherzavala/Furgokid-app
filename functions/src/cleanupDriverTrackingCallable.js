const { HttpsError } = require('firebase-functions/v2/https');
const { createDriverTrackingCleanup } = require('./driverTrackingCleanup');

const createCleanupDriverTrackingHandler = ({
  createRepository,
  createCleanup = createDriverTrackingCleanup,
  logger = (entry) => console.info('GPS cleanup', entry),
  HttpsErrorClass = HttpsError,
}) => {
  if (typeof createRepository !== 'function') {
    throw new TypeError('cleanupDriverTracking requires a repository provider.');
  }

  return async (request) => {
    const uid = request?.auth?.uid;
    if (typeof uid !== 'string' || uid.length === 0) {
      throw new HttpsErrorClass('unauthenticated', 'Authentication is required.');
    }

    const data = request?.data || {};
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length > 0) {
      throw new HttpsErrorClass('invalid-argument', 'No client identity fields are accepted.');
    }

    let result;
    try {
      const repository = await createRepository();
      const cleanup = createCleanup({ repository, logger });
      result = await cleanup(uid);
    } catch (error) {
      logger({ operation: 'cleanup_driver_tracking', result: 'failed' });
      throw new HttpsErrorClass('internal', 'Unable to clean tracking data.');
    }

    if (!result.complete) {
      throw new HttpsErrorClass('unavailable', 'Unable to clean tracking data.');
    }

    return {
      status: 'cleaned',
      deletedCount: result.deletedCount,
      missingCount: result.missingCount,
      deniedCount: result.deniedCount,
    };
  };
};

module.exports = {
  createCleanupDriverTrackingHandler,
};
