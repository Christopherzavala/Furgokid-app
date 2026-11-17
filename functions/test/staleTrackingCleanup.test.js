const { createStaleTrackingCleanup } = require('../src/staleTrackingCleanup');

describe('stale tracking cleanup', () => {
  test('deletes stale current points through the trusted repository', async () => {
    const repository = {
      deleteStaleCurrentTracking: jest.fn(async () => ({
        complete: true,
        deletedCount: 3,
        missingCount: 1,
        skippedCount: 2,
      })),
    };
    const logger = jest.fn();
    const cleanup = createStaleTrackingCleanup({
      repository,
      logger,
      now: () => 1000000,
    });

    await expect(cleanup()).resolves.toMatchObject({ complete: true, deletedCount: 3 });
    expect(repository.deleteStaleCurrentTracking).toHaveBeenCalledWith({ now: 1000000 });
    expect(logger).toHaveBeenCalledWith({
      operation: 'cleanup_stale_current_tracking',
      result: 'complete',
      deletedCount: 3,
    });
  });

  test('reports a partial cleanup for platform retry', async () => {
    const repository = {
      deleteStaleCurrentTracking: jest.fn(async () => ({ complete: false, deletedCount: 0 })),
    };
    const logger = jest.fn();
    const cleanup = createStaleTrackingCleanup({ repository, logger });

    await expect(cleanup()).resolves.toMatchObject({ complete: false });
    expect(logger).toHaveBeenCalledWith({
      operation: 'cleanup_stale_current_tracking',
      result: 'partial',
      deletedCount: 0,
    });
  });
});
