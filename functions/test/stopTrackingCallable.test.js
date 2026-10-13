const { createStopTrackingHandler } = require('../src/stopTrackingCallable');

const createHarness = ({
  profile = { role: 'driver', approved: true },
  cleanupResult = 'deleted',
  deleteFailure,
} = {}) => {
  const repository = {
    deleteMatchCurrentTracking: jest.fn(async (matchId, owner) => {
      if (deleteFailure) throw deleteFailure;
      if (
        matchId !== 'match-owned' ||
        owner.field !== 'driverId' ||
        owner.uid !== 'verified-driver'
      ) {
        return 'denied';
      }
      return cleanupResult;
    }),
    listActiveMatchesByDriver: jest.fn(),
    deleteDriverCurrentTrackingIfActiveMatch: jest.fn(),
  };
  const logger = jest.fn();
  const handler = createStopTrackingHandler({
    createRepository: jest.fn(async () => repository),
    getUserProfile: jest.fn(async () => profile),
    logger,
  });

  return { handler, repository, logger };
};

describe('stopTracking callable handler', () => {
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

  test('rejects users whose server-side profile is not a driver', async () => {
    const { handler, repository } = createHarness({ profile: { role: 'parent' } });

    await expect(
      handler({ auth: { uid: 'verified-driver' }, data: { matchId: 'match-owned' } })
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(repository.deleteMatchCurrentTracking).not.toHaveBeenCalled();
  });

  test('rejects users whose server-side profile has approved: false', async () => {
    const { handler, repository } = createHarness({ profile: { role: 'driver', approved: false } });

    await expect(
      handler({ auth: { uid: 'verified-driver' }, data: { matchId: 'match-owned' } })
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(repository.deleteMatchCurrentTracking).not.toHaveBeenCalled();
  });

  test('rejects users whose server-side profile lacks approved field', async () => {
    const { handler, repository } = createHarness({ profile: { role: 'driver' } });

    await expect(
      handler({ auth: { uid: 'verified-driver' }, data: { matchId: 'match-owned' } })
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(repository.deleteMatchCurrentTracking).not.toHaveBeenCalled();
  });

  test('rejects users whose server-side profile does not exist', async () => {
    const { handler, repository } = createHarness({ profile: null });

    await expect(
      handler({ auth: { uid: 'verified-driver' }, data: { matchId: 'match-owned' } })
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(repository.deleteMatchCurrentTracking).not.toHaveBeenCalled();
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

  test('maps a match status change to failed-precondition', async () => {
    const { handler } = createHarness({ cleanupResult: 'skipped' });

    await expect(
      handler({ auth: { uid: 'verified-driver' }, data: { matchId: 'match-owned' } })
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});
