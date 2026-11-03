const { HttpsError } = require('firebase-functions/v2/https');
const { AccountDeletionError } = require('./accountDeletionService');

const SAFE_ERROR_CODES = new Set([
  'aborted',
  'failed-precondition',
  'internal',
  'invalid-argument',
  'unavailable',
  'unauthenticated',
]);

const ERROR_HTTP_CODES = Object.freeze({
  'active-match': 'failed-precondition',
  'already-completed': 'failed-precondition',
  'in-progress': 'aborted',
  'invalid-data': 'invalid-argument',
  'reservation-exists': 'failed-precondition',
  unavailable: 'unavailable',
});

const createAccountDeletionCallables = ({
  service,
  logger = (entry) => console.info('Account deletion', entry),
  HttpsErrorClass = HttpsError,
}) => {
  if (!service || typeof service.requestDeletion !== 'function') {
    throw new TypeError('Account deletion callables require a service adapter.');
  }
  if (typeof service.getDeletionStatus !== 'function') {
    throw new TypeError('Account deletion callables require a status service adapter.');
  }

  const run = (operation, invoke) => async (request) => {
    const uid = request?.auth?.uid;
    if (typeof uid !== 'string' || uid.length === 0 || uid.length > 1500) {
      throw new HttpsErrorClass('unauthenticated', 'Authentication is required.');
    }

    try {
      return await invoke(uid);
    } catch (error) {
      const code =
        error instanceof AccountDeletionError && SAFE_ERROR_CODES.has(ERROR_HTTP_CODES[error.code])
          ? ERROR_HTTP_CODES[error.code]
          : 'internal';
      logger({ operation, result: 'failed', errorCode: code });
      throw new HttpsErrorClass(code, 'Unable to process the account deletion request.');
    }
  };

  return {
    requestAccountDeletion: run('request_account_deletion', (uid) => service.requestDeletion(uid)),
    getAccountDeletionStatus: run('get_account_deletion_status', (uid) =>
      service.getDeletionStatus(uid)
    ),
  };
};

module.exports = {
  createAccountDeletionCallables,
};
