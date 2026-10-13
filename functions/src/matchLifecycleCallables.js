const { HttpsError } = require('firebase-functions/v2/https');
const { MatchLifecycleError } = require('./matchLifecycle');

const VALID_ID = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 1500 &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/');

const SAFE_CODES = new Set([
  'already-exists',
  'deadline-exceeded',
  'failed-precondition',
  'internal',
  'invalid-argument',
  'not-found',
  'permission-denied',
  'resource-exhausted',
  'unavailable',
  'unauthenticated',
]);

const createMatchLifecycleCallables = ({
  repository,
  logger = (entry) => console.info('Match lifecycle', entry),
  HttpsErrorClass = HttpsError,
}) => {
  if (!repository || typeof logger !== 'function') {
    throw new TypeError('Match lifecycle callables require repository and logger adapters.');
  }

  const run = (operation, invoke) => async (request) => {
    const uid = request?.auth?.uid;
    if (typeof uid !== 'string' || uid.length === 0) {
      throw new HttpsErrorClass('unauthenticated', 'Authentication is required.');
    }
    try {
      return await invoke(uid, request.data || {});
    } catch (error) {
      const code = error instanceof MatchLifecycleError ? error.code : 'internal';
      logger({ operation, result: 'failed', errorCode: SAFE_CODES.has(code) ? code : 'unknown' });
      if (error instanceof MatchLifecycleError && SAFE_CODES.has(code)) {
        const message =
          error.reason === 'request-has-matches'
            ? 'No se puede eliminar la solicitud porque tiene matches asociados.'
            : 'The requested match operation is not allowed.';
        throw new HttpsErrorClass(code, message);
      }
      throw new HttpsErrorClass('internal', 'Unable to complete the match operation.');
    }
  };

  const requireId = (data, field) => {
    if (!VALID_ID(data[field])) throw new MatchLifecycleError('invalid-argument');
    return data[field];
  };

  return {
    createMatch: run('create_match', (actorUid, data) => {
      const requestId = requireId(data, 'requestId');
      const vacancyId = requireId(data, 'vacancyId');
      return repository.createOrAddMatch({
        actorUid,
        requestId,
        vacancyId,
        requestData: data.requestData,
      });
    }),
    acceptMatch: run('accept_match', (actorUid, data) =>
      repository.acceptMatch({ actorUid, matchId: requireId(data, 'matchId') })
    ),
    cancelMatch: run('cancel_match', (actorUid, data) =>
      repository.cancelMatch({ actorUid, matchId: requireId(data, 'matchId') })
    ),
    completeMatch: run('complete_match', (actorUid, data) =>
      repository.completeMatch({ actorUid, matchId: requireId(data, 'matchId') })
    ),
    closeRequest: run('close_request', (actorUid, data) =>
      repository.closeRequest({ actorUid, requestId: requireId(data, 'requestId') })
    ),
    deleteRequests: run('delete_requests', (actorUid, data) => {
      if (!Array.isArray(data.requestIds)) throw new MatchLifecycleError('invalid-argument');
      return repository.deleteRequests({ actorUid, requestIds: data.requestIds });
    }),
    updateVacancyCapacity: run('update_vacancy_capacity', (actorUid, data) => {
      const vacancyId = requireId(data, 'vacancyId');
      return repository.updateVacancyCapacity({
        actorUid,
        vacancyId,
        totalSeats: data.totalSeats,
      });
    }),
    initializeVacancyCapacity: run('initialize_vacancy_capacity', (actorUid, data) =>
      repository.initializeVacancyCapacity({
        actorUid,
        vacancyId: requireId(data, 'vacancyId'),
      })
    ),
  };
};

module.exports = {
  createMatchLifecycleCallables,
};
