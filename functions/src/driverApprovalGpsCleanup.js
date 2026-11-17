const createDriverApprovalGpsCleanup = ({ cleanupDriverTracking, logger }) => {
  if (typeof cleanupDriverTracking !== 'function' || typeof logger !== 'function') {
    throw new TypeError('Driver approval GPS cleanup requires cleanup and logger adapters.');
  }

  return async (event) => {
    const before = event?.data?.before?.data();
    const after = event?.data?.after?.data();
    const driverId = event?.params?.userId;

    if (
      typeof driverId !== 'string' ||
      driverId.length === 0 ||
      before?.role !== 'driver' ||
      before?.approved !== true ||
      (after?.role === 'driver' && after?.approved === true)
    ) {
      return { status: 'ignored' };
    }

    const result = await cleanupDriverTracking(driverId);
    logger({
      operation: 'cleanup_revoked_driver_tracking',
      result: result.complete ? 'complete' : 'partial',
      deletedCount: result.deletedCount || 0,
    });
    return { status: result.complete ? 'cleaned' : 'partial', deletedCount: result.deletedCount };
  };
};

module.exports = {
  createDriverApprovalGpsCleanup,
};
