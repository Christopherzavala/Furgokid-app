const createMatchDeletionGpsCleanup = ({ repository, logger }) => {
  if (
    !repository ||
    typeof repository.deleteCurrentTrackingByMatchId !== 'function' ||
    typeof logger !== 'function'
  ) {
    throw new TypeError('Match deletion GPS cleanup requires repository and logger adapters.');
  }

  return async (event) => {
    const matchId = event?.params?.matchId;
    if (typeof matchId !== 'string' || matchId.length === 0 || matchId.includes('/')) {
      throw new TypeError('A valid matchId event parameter is required.');
    }

    const status = await repository.deleteCurrentTrackingByMatchId(matchId);
    logger({
      operation: 'cleanup_deleted_match_current_tracking',
      result: status,
    });
    return { status };
  };
};

module.exports = {
  createMatchDeletionGpsCleanup,
};
