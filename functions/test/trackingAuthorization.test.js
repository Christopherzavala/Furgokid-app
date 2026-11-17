const { createTrackingAuthorizationHandler } = require('../src/trackingAuthorization');

const createHarness = ({ profile, match } = {}) => {
  const getUserProfile = jest.fn(async () => profile ?? null);
  const getMatch = jest.fn(async () => match ?? null);
  const handler = createTrackingAuthorizationHandler({ getUserProfile, getMatch });
  return { handler, getUserProfile, getMatch };
};

describe('startTracking authorization', () => {
  test('requires authentication', async () => {
    const { handler } = createHarness();
    await expect(handler({ data: { matchId: 'match-1' } })).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  test('rejects invalid match IDs and ignores client identity fields', async () => {
    const { handler } = createHarness({
      profile: { role: 'driver', approved: true },
      match: { status: 'active', driverId: 'driver-1' },
    });
    await expect(
      handler({ auth: { uid: 'driver-1' }, data: { matchId: '../match' } })
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(
      handler({
        auth: { uid: 'driver-1' },
        data: { matchId: 'match-1', driverId: 'attacker', parentId: 'attacker' },
      })
    ).resolves.toEqual({ matchId: 'match-1' });
  });

  test.each([
    [null, 'permission-denied'],
    [{ role: 'parent', approved: true }, 'permission-denied'],
    [{ role: 'driver', approved: false }, 'permission-denied'],
    [{ role: 'driver' }, 'permission-denied'],
  ])('rejects a profile that is not an approved driver', async (profile, code) => {
    const { handler } = createHarness({
      profile,
      match: { status: 'active', driverId: 'driver-1' },
    });
    await expect(
      handler({ auth: { uid: 'driver-1' }, data: { matchId: 'match-1' } })
    ).rejects.toMatchObject({ code });
  });

  test.each(['pending', 'completed', 'cancelled'])('rejects a %s match', async (status) => {
    const { handler } = createHarness({
      profile: { role: 'driver', approved: true },
      match: { status, driverId: 'driver-1' },
    });
    await expect(
      handler({ auth: { uid: 'driver-1' }, data: { matchId: 'match-1' } })
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  test('rejects a match assigned to another driver', async () => {
    const { handler } = createHarness({
      profile: { role: 'driver', approved: true },
      match: { status: 'active', driverId: 'driver-2' },
    });
    await expect(
      handler({ auth: { uid: 'driver-1' }, data: { matchId: 'match-1' } })
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  test('authorizes only the authenticated assigned driver for an active match', async () => {
    const { handler, getUserProfile, getMatch } = createHarness({
      profile: { role: 'driver', approved: true },
      match: { status: 'active', driverId: 'driver-1' },
    });

    await expect(
      handler({ auth: { uid: 'driver-1' }, data: { matchId: 'match-1' } })
    ).resolves.toEqual({ matchId: 'match-1' });
    expect(getUserProfile).toHaveBeenCalledWith('driver-1');
    expect(getMatch).toHaveBeenCalledWith('match-1');
  });

  test('returns not-found for a missing match', async () => {
    const { handler } = createHarness({
      profile: { role: 'driver', approved: true },
    });
    await expect(
      handler({ auth: { uid: 'driver-1' }, data: { matchId: 'match-1' } })
    ).rejects.toMatchObject({ code: 'not-found' });
  });
});
