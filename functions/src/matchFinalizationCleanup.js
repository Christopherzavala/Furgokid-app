const TERMINAL_MATCH_STATUSES = new Set(['completed', 'cancelled']);
const FINALIZABLE_MATCH_STATUSES = new Set(['pending', 'active']);
const SAFE_ERROR_CODES = new Set([
  'aborted',
  'deadline-exceeded',
  'internal',
  'resource-exhausted',
  'unavailable',
  'unknown',
]);

const safeErrorCode = (error) => {
  const code = error?.code;
  if (typeof code === 'number') {
    return (
      new Map([
        [4, 'deadline-exceeded'],
        [8, 'resource-exhausted'],
        [10, 'aborted'],
        [13, 'internal'],
        [14, 'unavailable'],
      ]).get(code) || 'unknown'
    );
  }
  const normalizedCode = typeof code === 'string' ? code.toLowerCase() : '';
  return SAFE_ERROR_CODES.has(normalizedCode) ? normalizedCode : 'unknown';
};

const createMatchFinalizationCleanup = ({ repository, logger }) => {
  if (
    !repository ||
    typeof repository.deleteMatchCurrentTrackingIfTerminal !== 'function' ||
    typeof logger !== 'function'
  ) {
    throw new TypeError('Match finalization cleanup requires repository and logger adapters.');
  }

  return async (event) => {
    const before = event?.data?.before?.data();
    const after = event?.data?.after?.data();
    if (
      !FINALIZABLE_MATCH_STATUSES.has(before?.status) ||
      !TERMINAL_MATCH_STATUSES.has(after?.status)
    ) {
      return { status: 'ignored' };
    }
    if (after.status === 'completed' && before.status !== 'active') {
      return { status: 'ignored' };
    }

    const matchId = event.params?.matchId;
    if (typeof matchId !== 'string' || matchId.length === 0 || matchId.includes('/')) {
      throw new TypeError('A valid matchId event parameter is required.');
    }

    try {
      const status = await repository.deleteMatchCurrentTrackingIfTerminal(matchId);
      if (!['deleted', 'missing', 'match-missing', 'skipped'].includes(status)) {
        throw new TypeError('Repository returned an invalid cleanup result.');
      }
      logger({
        operation: 'cleanup_finalized_match_current_tracking',
        result: status,
      });
      return { status };
    } catch (error) {
      logger({
        operation: 'cleanup_finalized_match_current_tracking',
        result: 'failed',
        errorCode: safeErrorCode(error),
      });
      throw error;
    }
  };
};

module.exports = {
  createMatchFinalizationCleanup,
};
