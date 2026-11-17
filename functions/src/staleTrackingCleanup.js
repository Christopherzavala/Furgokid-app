const createStaleTrackingCleanup = ({ repository, logger, now = Date.now }) => {
  if (
    !repository ||
    typeof repository.deleteStaleCurrentTracking !== 'function' ||
    typeof logger !== 'function'
  ) {
    throw new TypeError('Stale tracking cleanup requires repository and logger adapters.');
  }

  return async () => {
    const result = await repository.deleteStaleCurrentTracking({ now: now() });
    logger({
      operation: 'cleanup_stale_current_tracking',
      result: result.complete ? 'complete' : 'partial',
      deletedCount: result.deletedCount || 0,
    });
    return result;
  };
};

module.exports = {
  createStaleTrackingCleanup,
};
