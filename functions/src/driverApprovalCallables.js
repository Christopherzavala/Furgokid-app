const { HttpsError } = require('firebase-functions/v2/https');
const { DriverApprovalError } = require('./driverApproval');

const VALID_DOCUMENT_ID = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 1500 &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/');

const SAFE_CODES = new Set([
  'failed-precondition',
  'internal',
  'invalid-argument',
  'not-found',
  'permission-denied',
  'unauthenticated',
]);

const createDriverApprovalCallables = ({
  repository,
  logger = (entry) => console.info('Driver approval', entry),
  HttpsErrorClass = HttpsError,
  getUserActiveDevices = require('./externalNotifications').getUserActiveDevices,
  sendExpoPush = require('./externalNotifications').sendExpoPush,
}) => {
  if (!repository || typeof logger !== 'function') {
    throw new TypeError('Driver approval callables require a repository and logger.');
  }

  const run = (operation, invoke) => async (request) => {
    const actorUid = request?.auth?.uid;
    if (!VALID_DOCUMENT_ID(actorUid)) {
      throw new HttpsErrorClass('unauthenticated', 'Authentication is required.');
    }

    try {
      const data = request.data === undefined ? {} : request.data;
      return await invoke(actorUid, data);
    } catch (error) {
      process.stderr.write('CALLABLE ERROR: ' + (error.stack || error.message) + '\n');
      const code = error instanceof DriverApprovalError ? error.code : 'internal';
      const safeCode = SAFE_CODES.has(code) ? code : 'internal';
      logger({ operation, result: 'failed', errorCode: safeCode });
      if (!SAFE_CODES.has(code)) {
        throw new HttpsErrorClass('internal', 'Unable to complete the driver request.');
      }

      const messages = {
        'failed-precondition': 'The driver request transition is not allowed.',
        'invalid-argument': 'The driver request data is invalid.',
        'not-found': 'The driver request was not found.',
        'permission-denied': 'The operation is not authorized.',
      };
      throw new HttpsErrorClass(code, messages[code] || 'The operation is not allowed.');
    }
  };

  const requestDriverApproval = run('request_driver_approval', (actorUid, data) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new DriverApprovalError('invalid-argument');
    }
    if (Object.keys(data).length > 0) {
      throw new DriverApprovalError('invalid-argument');
    }
    return repository.requestDriverApproval({ actorUid });
  });

  const reviewDriverRequest = run('review_driver_request', async (actorUid, data) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new DriverApprovalError('invalid-argument');
    }
    const allowedKeys = new Set(['decision', 'targetUid']);
    if (Object.keys(data).some((key) => !allowedKeys.has(key))) {
      throw new DriverApprovalError('invalid-argument');
    }
    if (!VALID_DOCUMENT_ID(data.targetUid)) {
      throw new DriverApprovalError('invalid-argument');
    }
    if (data.decision !== 'approve' && data.decision !== 'reject' && data.decision !== 'revoke') {
      throw new DriverApprovalError('invalid-argument');
    }
    const result = await repository.reviewDriverRequest({
      actorUid,
      targetUid: data.targetUid,
      decision: data.decision,
    });

    if (result.affectedParentIds && result.affectedParentIds.length > 0) {
      try {
        const firestore = repository.firestore;
        if (firestore) {
          for (const parentId of result.affectedParentIds) {
            const activeDevices = await getUserActiveDevices(firestore, parentId);
            for (const device of activeDevices) {
              if (device.expoPushToken) {
                await sendExpoPush({
                  payload: [
                    {
                      to: device.expoPushToken,
                      sound: 'default',
                      title: '🚌 Viaje cancelado',
                      body: 'El viaje programado ha sido cancelado por revocación de la autorización del conductor.',
                      data: { type: 'match_cancelled', reason: 'driver_revoked' },
                      priority: 'high',
                      channelId: 'urgent',
                    },
                  ],
                  headers: {
                    Accept: 'application/json',
                    'Accept-Encoding': 'gzip, deflate',
                    'Content-Type': 'application/json',
                  },
                });
              }
            }
          }
        }
      } catch (pushErr) {
        logger({
          operation: 'review_driver_request_push',
          result: 'warning',
          error: pushErr.message,
        });
      }
    }

    return result;
  });

  return {
    requestDriverApproval,
    reviewDriverRequest,
  };
};

module.exports = {
  createDriverApprovalCallables,
};
