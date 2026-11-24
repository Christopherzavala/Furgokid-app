const { createGpsCleanup } = require('../src/gpsCleanup');
const { createFirestoreGpsCleanupRepository } = require('../src/firestoreGpsCleanupRepository');

const createHarness = (options = {}) => {
  const matches = new Map();
  const tracking = new Map();
  const logs = [];
  const repository = {
    listActiveMatchesByDriver: jest.fn(async ({ driverId, pageToken, pageSize }) => {
      const activeMatches = [...matches.values()]
        .filter((match) => match.driverId === driverId)
        .sort((left, right) => left.id.localeCompare(right.id));
      const offset = pageToken === null ? 0 : Number(pageToken);
      const page = activeMatches.slice(offset, offset + pageSize);
      const nextOffset = offset + page.length;
      return {
        matches: page,
        nextPageToken: nextOffset < activeMatches.length ? String(nextOffset) : null,
      };
    }),
    deleteMatchCurrentTracking: jest.fn(async (matchId, owner) => {
      const match = matches.get(matchId);
      if (!match) return 'match-missing';
      if (match[owner.field] !== owner.uid) return 'denied';
      if (!tracking.has(matchId)) return 'missing';
      tracking.delete(matchId);
      return 'deleted';
    }),
    deleteDriverCurrentTrackingIfActiveMatch: jest.fn(async (matchId, driverId) => {
      const match = matches.get(matchId);
      if (!match || match.driverId !== driverId || match.status !== 'active') return 'skipped';
      if (!tracking.has(matchId)) return 'missing';
      tracking.delete(matchId);
      return 'deleted';
    }),
  };
  const authorizer = {
    authorizeMatchCleanup: jest.fn(async (matchId) =>
      options.authorizedMatchIds?.has(matchId)
        ? {
            authorized: true,
            matchId,
            owner: { field: 'driverId', uid: options.authorizedDriverId || 'verified-driver' },
          }
        : { authorized: false, matchId }
    ),
    getAuthorizedDriverId: jest.fn(async () => {
      if (options.authError) throw options.authError;
      return options.authorizedDriverId || null;
    }),
  };
  const cleanup = createGpsCleanup({
    repository,
    authorizer,
    logger: (entry) => logs.push(entry),
    ...(options.pageSize ? { pageSize: options.pageSize } : {}),
  });

  return { cleanup, repository, authorizer, matches, tracking, logs };
};

describe('GPS cleanup module', () => {
  test('constructor validates required dependencies and pageSize', () => {
    const validRepo = {
      deleteMatchCurrentTracking: jest.fn(),
      listActiveMatchesByDriver: jest.fn(),
      deleteDriverCurrentTrackingIfActiveMatch: jest.fn(),
    };
    const validAuth = {
      authorizeMatchCleanup: jest.fn(),
      getAuthorizedDriverId: jest.fn(),
    };
    const validLogger = jest.fn();

    expect(() =>
      createGpsCleanup({ repository: null, authorizer: validAuth, logger: validLogger })
    ).toThrow(TypeError);
    expect(() =>
      createGpsCleanup({ repository: validRepo, authorizer: null, logger: validLogger })
    ).toThrow(TypeError);
    expect(() =>
      createGpsCleanup({ repository: validRepo, authorizer: validAuth, logger: null })
    ).toThrow(TypeError);
    expect(() =>
      createGpsCleanup({
        repository: validRepo,
        authorizer: validAuth,
        logger: validLogger,
        pageSize: 0,
      })
    ).toThrow(RangeError);
    expect(() =>
      createGpsCleanup({
        repository: validRepo,
        authorizer: validAuth,
        logger: validLogger,
        pageSize: 600,
      })
    ).toThrow(RangeError);
  });

  test('deletes only the authorized match current location', async () => {
    const harness = createHarness({
      authorizedMatchIds: new Set(['match-A']),
      authorizedDriverId: 'driver-A',
    });
    harness.matches.set('match-A', { id: 'match-A', driverId: 'driver-A', status: 'active' });
    harness.matches.set('match-B', { id: 'match-B', driverId: 'driver-B', status: 'active' });
    harness.tracking.set('match-A', { latitude: 1, longitude: 2 });
    harness.tracking.set('match-B', { latitude: 3, longitude: 4 });

    const result = await harness.cleanup.cleanupMatchCurrentTracking('match-A');

    expect(result).toMatchObject({ status: 'deleted', deletedCount: 1 });
    expect(harness.tracking.has('match-A')).toBe(false);
    expect(harness.tracking.has('match-B')).toBe(true);
    expect(harness.repository.deleteMatchCurrentTracking).toHaveBeenCalledTimes(1);
    expect(harness.repository.deleteMatchCurrentTracking).toHaveBeenCalledWith('match-A', {
      field: 'driverId',
      uid: 'driver-A',
    });
  });

  test('repeating a match cleanup is idempotent and reports the missing document', async () => {
    const harness = createHarness({
      authorizedMatchIds: new Set(['match-A']),
      authorizedDriverId: 'driver-A',
    });
    harness.matches.set('match-A', { id: 'match-A', driverId: 'driver-A', status: 'active' });
    harness.tracking.set('match-A', { latitude: 1, longitude: 2 });

    const first = await harness.cleanup.cleanupMatchCurrentTracking('match-A');
    const second = await harness.cleanup.cleanupMatchCurrentTracking('match-A');

    expect(first.status).toBe('deleted');
    expect(second).toMatchObject({ status: 'missing', missingCount: 1, deletedCount: 0 });
  });

  test('denies an unauthorized match without calling the repository', async () => {
    const harness = createHarness({ authorizedMatchIds: new Set(['match-A']) });
    harness.tracking.set('match-B', { latitude: 3, longitude: 4 });

    const result = await harness.cleanup.cleanupMatchCurrentTracking('match-B');

    expect(result.status).toBe('denied');
    expect(harness.tracking.has('match-B')).toBe(true);
    expect(harness.repository.deleteMatchCurrentTracking).not.toHaveBeenCalled();
  });

  test('handles invalid repository deletion result status', async () => {
    const harness = createHarness({
      authorizedMatchIds: new Set(['match-A']),
      authorizedDriverId: 'driver-A',
    });
    harness.matches.set('match-A', { id: 'match-A', driverId: 'driver-A', status: 'active' });
    harness.repository.deleteMatchCurrentTracking.mockResolvedValueOnce('unknown-status');

    const result = await harness.cleanup.cleanupMatchCurrentTracking('match-A');
    expect(result.status).toBe('failed');
  });

  test.each(['', '../private', 'match/path', '.', '..', null, 42])(
    'rejects invalid match document ID %p',
    async (matchId) => {
      const harness = createHarness();

      await expect(harness.cleanup.cleanupMatchCurrentTracking(matchId)).rejects.toThrow(
        'valid match document ID'
      );
      expect(harness.repository.deleteMatchCurrentTracking).not.toHaveBeenCalled();
      expect(harness.authorizer.authorizeMatchCleanup).not.toHaveBeenCalled();
    }
  );

  test('returns a sanitized failure when reading the target tracking document fails', async () => {
    const harness = createHarness({
      authorizedMatchIds: new Set(['match-A']),
      authorizedDriverId: 'driver-A',
    });
    harness.matches.set('match-A', { id: 'match-A', driverId: 'driver-A', status: 'active' });
    harness.repository.deleteMatchCurrentTracking.mockRejectedValueOnce({
      code: 'unavailable',
      message: 'GPS 12.34,-56.78 for private@example.com',
    });

    const result = await harness.cleanup.cleanupMatchCurrentTracking('match-A');

    expect(result).toMatchObject({
      status: 'failed',
      retryableCount: 1,
      errorCode: 'unavailable',
    });
    expect(result).not.toHaveProperty('message');
  });

  test('paginates through more than 500 active matches without touching other drivers', async () => {
    const harness = createHarness({ authorizedDriverId: 'verified-driver', pageSize: 400 });
    for (let index = 0; index < 523; index++) {
      const id = `match-${String(index).padStart(4, '0')}`;
      harness.matches.set(id, { id, driverId: 'verified-driver', status: 'active' });
      harness.tracking.set(id, { latitude: index, longitude: index });
    }
    harness.matches.set('foreign-match', {
      id: 'foreign-match',
      driverId: 'another-driver',
      status: 'active',
    });
    harness.tracking.set('foreign-match', { latitude: 0, longitude: 0 });

    const result = await harness.cleanup.cleanupDriverActiveMatchTracking();

    expect(result).toMatchObject({
      complete: true,
      scannedCount: 523,
      deletedCount: 523,
      failedCount: 0,
    });
    expect(harness.repository.listActiveMatchesByDriver).toHaveBeenCalledTimes(2);
    expect(harness.tracking.size).toBe(1);
    expect(harness.tracking.has('foreign-match')).toBe(true);
  });

  test('handles auth error in cleanupDriverActiveMatchTracking', async () => {
    const harness = createHarness({ authError: { code: 'unauthenticated' } });
    const result = await harness.cleanup.cleanupDriverActiveMatchTracking();
    expect(result.complete).toBe(false);
    expect(result.failedCount).toBe(1);
  });

  test('handles invalid driver ID in cleanupDriverActiveMatchTracking', async () => {
    const harness = createHarness({ authorizedDriverId: '../bad' });
    const result = await harness.cleanup.cleanupDriverActiveMatchTracking();
    expect(result.complete).toBe(false);
    expect(result.failedCount).toBe(1);
  });

  test('handles invalid match page or invalid candidate ID or invalid deletion in driver cleanup', async () => {
    const harness = createHarness({ authorizedDriverId: 'verified-driver' });
    harness.repository.listActiveMatchesByDriver
      .mockResolvedValueOnce({ matches: 'not-an-array', nextPageToken: null })
      .mockResolvedValueOnce({ matches: [{ id: '../bad-id' }], nextPageToken: null })
      .mockResolvedValueOnce({ matches: [{ id: 'match-1' }], nextPageToken: null });

    harness.repository.deleteDriverCurrentTrackingIfActiveMatch.mockResolvedValueOnce(
      'invalid-status'
    );

    // 1. Invalid match page
    let res = await harness.cleanup.cleanupDriverActiveMatchTracking();
    expect(res.complete).toBe(false);

    // 2. Invalid candidate ID
    res = await harness.cleanup.cleanupDriverActiveMatchTracking();
    expect(res.complete).toBe(false);

    // 3. Invalid deletion status
    res = await harness.cleanup.cleanupDriverActiveMatchTracking();
    expect(res.complete).toBe(false);
  });

  test('detects infinite pagination token loops in driver active match tracking', async () => {
    const harness = createHarness({ authorizedDriverId: 'verified-driver' });
    harness.repository.listActiveMatchesByDriver.mockResolvedValue({
      matches: [{ id: 'match-1' }],
      nextPageToken: 'loop-token',
    });

    const res = await harness.cleanup.cleanupDriverActiveMatchTracking();
    expect(res.complete).toBe(false);
    expect(res.errorCode).toBe('invalid-page-token');
  });

  test('skips matches whose owner or active status no longer matches during the conditional delete', async () => {
    const harness = createHarness({ authorizedDriverId: 'verified-driver' });
    harness.matches.set('match-owned', {
      id: 'match-owned',
      driverId: 'verified-driver',
      status: 'active',
    });
    harness.matches.set('match-completed', {
      id: 'match-completed',
      driverId: 'verified-driver',
      status: 'completed',
    });
    for (const id of ['match-owned', 'match-completed']) {
      harness.tracking.set(id, { latitude: 10, longitude: 20 });
    }

    const result = await harness.cleanup.cleanupDriverActiveMatchTracking();

    expect(result).toMatchObject({ deletedCount: 1, skippedCount: 1, scannedCount: 2 });
    expect(harness.tracking.has('match-owned')).toBe(false);
    expect(harness.tracking.has('match-completed')).toBe(true);
    expect(harness.repository.deleteDriverCurrentTrackingIfActiveMatch).toHaveBeenCalledWith(
      'match-owned',
      'verified-driver'
    );
  });

  test('reports an absent location without failing driver cleanup', async () => {
    const harness = createHarness({ authorizedDriverId: 'verified-driver' });
    harness.matches.set('match-without-point', {
      id: 'match-without-point',
      driverId: 'verified-driver',
      status: 'active',
    });

    const result = await harness.cleanup.cleanupDriverActiveMatchTracking();

    expect(result).toMatchObject({
      complete: true,
      scannedCount: 1,
      missingCount: 1,
      deletedCount: 0,
    });
  });

  test('reports a missing match separately from a missing location', async () => {
    const harness = createHarness({
      authorizedMatchIds: new Set(['missing-match']),
      authorizedDriverId: 'verified-driver',
    });

    const result = await harness.cleanup.cleanupMatchCurrentTracking('missing-match');

    expect(result).toMatchObject({
      status: 'match-missing',
      deletedCount: 0,
      missingCount: 0,
    });
  });

  test('reports paginated read failures as retryable and stops without skipping a page', async () => {
    const harness = createHarness({ authorizedDriverId: 'verified-driver' });
    harness.repository.listActiveMatchesByDriver.mockRejectedValueOnce({
      code: 'unavailable',
      message: 'private coordinates',
    });

    const result = await harness.cleanup.cleanupDriverActiveMatchTracking();

    expect(result).toMatchObject({
      complete: false,
      failedCount: 1,
      retryableCount: 1,
      errorCode: 'unavailable',
    });
    expect(harness.repository.deleteDriverCurrentTrackingIfActiveMatch).not.toHaveBeenCalled();
  });

  test('does not include coordinates, identity, or raw error details in logs', async () => {
    const harness = createHarness({
      authorizedDriverId: 'complete-private-user-id',
      authorizedMatchIds: new Set(['match-A']),
    });
    harness.tracking.set('match-A', {
      latitude: -33.4489,
      longitude: -70.6693,
      email: 'driver@example.com',
      token: 'private-token',
    });
    harness.matches.set('match-A', {
      id: 'match-A',
      driverId: 'complete-private-user-id',
      status: 'active',
    });
    harness.repository.deleteMatchCurrentTracking.mockRejectedValueOnce({
      code: 'unavailable',
      message: '-33.4489,-70.6693 driver@example.com private-token complete-private-user-id',
    });

    await harness.cleanup.cleanupMatchCurrentTracking('match-A');
    await harness.cleanup.cleanupDriverActiveMatchTracking();

    const serializedLogs = JSON.stringify(harness.logs);
    for (const sensitiveValue of [
      '-33.4489',
      '-70.6693',
      'driver@example.com',
      'private-token',
      'complete-private-user-id',
    ]) {
      expect(serializedLogs).not.toContain(sensitiveValue);
    }
  });

  test.each(['read', 'delete'])(
    'sanitizes Firestore transaction %s failures through the cleanup service',
    async (failurePoint) => {
      const matchRef = {
        collection: () => ({ doc: () => ({}) }),
      };
      const firestore = {
        collection: () => ({ doc: () => matchRef }),
        runTransaction: jest.fn(async (operation) =>
          operation({
            get: jest.fn(async () => {
              if (failurePoint === 'read') {
                throw {
                  code: 'unavailable',
                  message: 'private coordinates -33.4,-70.6 user@example.com',
                };
              }
              return {
                exists: true,
                get: (field) => {
                  if (field === 'driverId') return 'verified-driver';
                  if (field === 'status') return 'active';
                  return undefined;
                },
              };
            }),
            delete: jest.fn(() => {
              throw {
                code: 'deadline-exceeded',
                message: 'private coordinates -33.4,-70.6 user@example.com',
              };
            }),
          })
        ),
      };
      const repository = createFirestoreGpsCleanupRepository({ firestore });
      const logs = [];
      const cleanup = createGpsCleanup({
        repository,
        authorizer: {
          authorizeMatchCleanup: async (matchId) => ({
            authorized: true,
            matchId,
            owner: { field: 'driverId', uid: 'verified-driver' },
          }),
          getAuthorizedDriverId: async () => 'verified-driver',
        },
        logger: (entry) => logs.push(entry),
      });

      const result = await cleanup.cleanupMatchCurrentTracking('match-A');

      expect(result).toMatchObject({ status: 'failed', failedCount: 1 });
      expect(JSON.stringify({ result, logs })).not.toMatch(
        /-33\.4|-70\.6|user@example\.com|private coordinates/
      );
    }
  );
});
