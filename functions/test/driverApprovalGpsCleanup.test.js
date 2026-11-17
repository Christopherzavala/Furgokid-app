const { createDriverApprovalGpsCleanup } = require('../src/driverApprovalGpsCleanup');

const makeEvent = (before, after) => ({
  params: { userId: 'driver-1' },
  data: {
    before: { data: () => before },
    after: { data: () => after },
  },
});

describe('driver approval GPS cleanup trigger', () => {
  test('cleans tracking when approval is revoked', async () => {
    const cleanupDriverTracking = jest.fn(async () => ({ complete: true, deletedCount: 2 }));
    const logger = jest.fn();
    const trigger = createDriverApprovalGpsCleanup({ cleanupDriverTracking, logger });

    await expect(
      trigger(makeEvent({ role: 'driver', approved: true }, { role: 'parent', approved: false }))
    ).resolves.toEqual({ status: 'cleaned', deletedCount: 2 });
    expect(cleanupDriverTracking).toHaveBeenCalledWith('driver-1');
  });

  test('ignores updates that do not revoke approval', async () => {
    const cleanupDriverTracking = jest.fn();
    const trigger = createDriverApprovalGpsCleanup({
      cleanupDriverTracking,
      logger: jest.fn(),
    });

    await expect(
      trigger(makeEvent({ role: 'driver', approved: true }, { role: 'driver', approved: true }))
    ).resolves.toEqual({ status: 'ignored' });
    expect(cleanupDriverTracking).not.toHaveBeenCalled();
  });

  test('propagates a partial cleanup for platform retry', async () => {
    const cleanupDriverTracking = jest.fn(async () => ({ complete: false, deletedCount: 0 }));
    const trigger = createDriverApprovalGpsCleanup({
      cleanupDriverTracking,
      logger: jest.fn(),
    });

    await expect(
      trigger(makeEvent({ role: 'driver', approved: true }, { role: 'driver', approved: false }))
    ).resolves.toEqual({ status: 'partial', deletedCount: 0 });
  });
});
