'use strict';

const { createStopTrackingHandler } = require('../src/stopTrackingCallable');

const createHarness = ({
  profile = { role: 'driver', approved: true },
  cleanupResult = 'deleted',
  deleteFailure,
  repositoryPromise,
} = {}) => {
  const repository = {
    deleteMatchCurrentTracking: jest.fn(async (matchId, owner) => {
      if (deleteFailure) throw deleteFailure;
      if (
        matchId !== 'match-owned' ||
        owner.field !== 'driverId' ||
        owner.uid !== 'verified-driver'
      ) {
        if (matchId === 'match-missing') return 'match-missing';
        return 'denied';
      }
      return cleanupResult;
    }),
    listActiveMatchesByDriver: jest.fn(async () => ({ matches: [] })),
    deleteDriverCurrentTrackingIfActiveMatch: jest.fn(async () => 'deleted'),
  };
  const logger = jest.fn();
  const handler = createStopTrackingHandler({
    createRepository: repositoryPromise || jest.fn(async () => repository),
    getUserProfile: jest.fn(async () => profile),
    logger,
  });

  return { handler, repository, logger };
};

describe('stopTracking callable handler', () => {
  test('constructor validates required dependencies', () => {
    expect(() => createStopTrackingHandler({ createRepository: null, logger: jest.fn() })).toThrow(
      TypeError
    );
    expect(() => createStopTrackingHandler({ createRepository: jest.fn(), logger: null })).toThrow(
      TypeError
    );
  });

  test('rejects requests without verified auth context', async () => {
    const { handler } = createHarness();

    await expect(handler({ data: { matchId: 'match-owned' } })).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  test.each([undefined, '', '../match', 'match/path', '.', '..', 42])(
    'rejects invalid matchId %p',
    async (matchId) => {
      const { handler, repository } = createHarness();

      await expect(
        handler({ auth: { uid: 'verified-driver' }, data: { matchId } })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
      expect(repository.deleteMatchCurrentTracking).not.toHaveBeenCalled();
    }
  );

  test('handles repository creation failure safely', async () => {
    const { handler, logger } = createHarness({
      repositoryPromise: jest.fn(async () => {
        throw { code: 8, message: 'Resource exhausted error' };
      }),
    });

    await expect(
      handler({ auth: { uid: 'verified-driver' }, data: { matchId: 'match-owned' } })
    ).rejects.toMatchObject({ code: 'internal' });
    expect(logger).toHaveBeenCalled();
  });

  test('handles repository creation failure with numeric and unknown error codes', async () => {
    const { handler: h1 } = createHarness({
      repositoryPromise: jest.fn(async () => {
        throw { code: 4, message: 'Deadline exceeded' };
      }),
    });
    await expect(
      h1({ auth: { uid: 'verified-driver' }, data: { matchId: 'match-owned' } })
    ).rejects.toMatchObject({ code: 'internal' });

    const { handler: h10 } = createHarness({
      repositoryPromise: jest.fn(async () => {
        throw { code: 10, message: 'Aborted error' };
      }),
    });
    await expect(
      h10({ auth: { uid: 'verified-driver' }, data: { matchId: 'match-owned' } })
    ).rejects.toMatchObject({ code: 'internal' });

    const { handler: h14 } = createHarness({
      repositoryPromise: jest.fn(async () => {
        throw { code: 14, message: 'Unavailable error' };
      }),
    });
    await expect(
      h14({ auth: { uid: 'verified-driver' }, data: { matchId: 'match-owned' } })
    ).rejects.toMatchObject({ code: 'internal' });

    const { handler: h2 } = createHarness({
      repositoryPromise: jest.fn(async () => {
        throw { code: 'unknown-code', message: 'Unknown error' };
      }),
    });
    await expect(
      h2({ auth: { uid: 'verified-driver' }, data: { matchId: 'match-owned' } })
    ).rejects.toMatchObject({ code: 'internal' });
  });

  test('uses default logger and handles repository creation failure', async () => {
    const consoleSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const defaultLoggerHandler = createStopTrackingHandler({
      createRepository: jest.fn(async () => {
        throw new Error('Repo init fail');
      }),
    });

    await expect(
      defaultLoggerHandler({ auth: { uid: 'verified-driver' }, data: { matchId: 'match-owned' } })
    ).rejects.toMatchObject({ code: 'internal' });

    expect(consoleSpy).toHaveBeenCalledWith('GPS cleanup', expect.anything());
    consoleSpy.mockRestore();
  });

  test('uses only request.auth.uid and ignores client-supplied identity fields', async () => {
    const { handler, repository } = createHarness();
    const response = await handler({
      auth: { uid: 'verified-driver' },
      data: {
        matchId: 'match-owned',
        uid: 'attacker',
        driverId: 'attacker',
        parentId: 'attacker',
        owner: { field: 'driverId', uid: 'attacker' },
        role: 'admin',
      },
    });

    expect(response).toEqual({ status: 'stopped', locationDeleted: true });
    expect(repository.deleteMatchCurrentTracking).toHaveBeenCalledWith('match-owned', {
      field: 'driverId',
      uid: 'verified-driver',
    });
  });

  test('allows the assigned driver to clean up even after approval is revoked', async () => {
    const { handler, repository } = createHarness({ profile: { role: 'driver', approved: false } });

    const response = await handler({
      auth: { uid: 'verified-driver' },
      data: { matchId: 'match-owned' },
    });

    expect(response).toEqual({ status: 'stopped', locationDeleted: true });
    expect(repository.deleteMatchCurrentTracking).toHaveBeenCalledWith('match-owned', {
      field: 'driverId',
      uid: 'verified-driver',
    });
  });

  test('accepts users whose server-side profile has approved: true', async () => {
    const { handler, repository } = createHarness({ profile: { role: 'driver', approved: true } });

    const response = await handler({
      auth: { uid: 'verified-driver' },
      data: { matchId: 'match-owned' },
    });

    expect(response).toEqual({ status: 'stopped', locationDeleted: true });
    expect(repository.deleteMatchCurrentTracking).toHaveBeenCalledWith('match-owned', {
      field: 'driverId',
      uid: 'verified-driver',
    });
  });

  test('returns an idempotent response when the current location is absent', async () => {
    const { handler } = createHarness({ cleanupResult: 'missing' });

    await expect(
      handler({ auth: { uid: 'verified-driver' }, data: { matchId: 'match-owned' } })
    ).resolves.toEqual({ status: 'already-stopped', locationDeleted: false });
  });

  test('maps match-missing status to not-found error', async () => {
    const { handler } = createHarness({ cleanupResult: 'match-missing' });

    await expect(
      handler({ auth: { uid: 'verified-driver' }, data: { matchId: 'match-missing' } })
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  test('maps an unauthorized owner to permission-denied', async () => {
    const { handler } = createHarness();

    await expect(
      handler({
        auth: { uid: 'verified-driver' },
        data: { matchId: 'match-other' },
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  test('does not expose Firestore errors or sensitive details', async () => {
    const { handler, logger } = createHarness({
      deleteFailure: {
        code: 14,
        message: 'coordinates 41.8,-87.6, private@example.test verified-driver',
      },
    });
    const error = await handler({
      auth: { uid: 'verified-driver' },
      data: { matchId: 'match-owned' },
    }).catch((caught) => caught);

    expect(error).toMatchObject({
      code: 'internal',
      message: 'Unable to stop tracking.',
    });
    const serializedLogs = JSON.stringify(logger.mock.calls);
    expect(serializedLogs).not.toContain('41.8');
    expect(serializedLogs).not.toContain('private@example.test');
    expect(serializedLogs).not.toContain('verified-driver');
    expect(serializedLogs).toContain('unavailable');
  });

  test('maps an invalid repository cleanup result to an internal error', async () => {
    const { handler } = createHarness({ cleanupResult: 'skipped' });

    await expect(
      handler({ auth: { uid: 'verified-driver' }, data: { matchId: 'match-owned' } })
    ).rejects.toMatchObject({ code: 'internal' });
  });
});
