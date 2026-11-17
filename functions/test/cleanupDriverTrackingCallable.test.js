const { createCleanupDriverTrackingHandler } = require('../src/cleanupDriverTrackingCallable');

const createHarness = ({ cleanupResult, failure } = {}) => {
  const repository = {};
  const logger = jest.fn();
  const cleanup = jest.fn(async () => {
    if (failure) throw failure;
    return (
      cleanupResult || {
        complete: true,
        deletedCount: 2,
        missingCount: 1,
        deniedCount: 0,
      }
    );
  });
  const handler = createCleanupDriverTrackingHandler({
    createRepository: jest.fn(async () => repository),
    createCleanup: jest.fn(() => cleanup),
    logger,
  });

  return { handler, logger, cleanup };
};

describe('cleanupDriverTracking callable', () => {
  test('requires authentication', async () => {
    const { handler } = createHarness();
    await expect(handler({ data: {} })).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  test('rejects client identity fields', async () => {
    const { handler } = createHarness();
    await expect(
      handler({ auth: { uid: 'driver-1' }, data: { driverId: 'attacker' } })
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('uses only request.auth.uid and returns the cleanup summary', async () => {
    const { handler } = createHarness();
    await expect(handler({ auth: { uid: 'driver-1' }, data: {} })).resolves.toEqual({
      status: 'cleaned',
      deletedCount: 2,
      missingCount: 1,
      deniedCount: 0,
    });
  });

  test('returns unavailable for an incomplete cleanup', async () => {
    const { handler } = createHarness({
      cleanupResult: { complete: false, deletedCount: 0, missingCount: 0, deniedCount: 0 },
    });
    await expect(handler({ auth: { uid: 'driver-1' }, data: {} })).rejects.toMatchObject({
      code: 'unavailable',
    });
  });

  test('does not expose internal error details', async () => {
    const { handler, logger } = createHarness({
      failure: new Error('private coordinate private@example.test'),
    });
    await expect(handler({ auth: { uid: 'driver-1' }, data: {} })).rejects.toMatchObject({
      code: 'internal',
      message: 'Unable to clean tracking data.',
    });
    expect(JSON.stringify(logger.mock.calls)).not.toContain('private@example.test');
  });
});
