'use strict';

const { createDriverTrackingCleanup } = require('../src/driverTrackingCleanup');

const createHarness = ({ pages, deletion = 'deleted', deleteFailure, pageSize } = {}) => {
  const repository = {
    deleteDriverCurrentTrackingIfAssigned: jest.fn(async (matchId) => {
      if (deleteFailure) throw deleteFailure;
      if (matchId === 'match-missing') return 'match-missing';
      if (matchId === 'match-denied') return 'denied';
      return deletion;
    }),
    listMatchesByDriver: jest.fn(async ({ pageToken }) => {
      if (!pages || pages.length === 0) return { matches: [], nextPageToken: null };
      if (pageToken === null) return pages[0];
      return pages[1] || { matches: [], nextPageToken: null };
    }),
    deleteDriverCurrentTrackingIfActiveMatch: jest.fn(async () => 'deleted'),
  };
  const logger = jest.fn();
  const cleanup = createDriverTrackingCleanup({
    repository,
    logger,
    ...(pageSize ? { pageSize } : {}),
  });
  return { cleanup, repository, logger };
};

describe('driver tracking cleanup', () => {
  test('constructor validates required dependencies and pageSize', () => {
    const validRepo = {
      listMatchesByDriver: jest.fn(),
      deleteDriverCurrentTrackingIfAssigned: jest.fn(),
    };
    const validLogger = jest.fn();

    expect(() => createDriverTrackingCleanup({ repository: null, logger: validLogger })).toThrow(
      TypeError
    );
    expect(() => createDriverTrackingCleanup({ repository: validRepo, logger: null })).toThrow(
      TypeError
    );
    expect(() =>
      createDriverTrackingCleanup({ repository: validRepo, logger: validLogger, pageSize: 0 })
    ).toThrow(RangeError);
    expect(() =>
      createDriverTrackingCleanup({ repository: validRepo, logger: validLogger, pageSize: 600 })
    ).toThrow(RangeError);
  });

  test('cleans every assigned match without changing match state', async () => {
    const { cleanup, repository } = createHarness({
      pages: [
        {
          matches: [{ id: 'match-1' }, { id: 'match-2' }],
          nextPageToken: 'match-2',
        },
        { matches: [{ id: 'match-3' }], nextPageToken: null },
      ],
    });

    await expect(cleanup('driver-1')).resolves.toMatchObject({
      complete: true,
      scannedCount: 3,
      deletedCount: 3,
      failedCount: 0,
    });
    expect(repository.deleteDriverCurrentTrackingIfAssigned).toHaveBeenCalledTimes(3);
    expect(repository.listMatchesByDriver).toHaveBeenCalledWith({
      driverId: 'driver-1',
      pageToken: null,
      pageSize: 400,
    });
  });

  test('is idempotent when current points are already absent', async () => {
    const { cleanup } = createHarness({
      pages: [{ matches: [{ id: 'match-1' }], nextPageToken: null }],
      deletion: 'missing',
    });

    await expect(cleanup('driver-1')).resolves.toMatchObject({
      complete: true,
      deletedCount: 0,
      missingCount: 1,
    });
  });

  test('handles denied, match-missing, unknown deletion results and deletion errors', async () => {
    const { cleanup, repository } = createHarness({
      pages: [
        {
          matches: [
            { id: 'match-1' },
            { id: 'match-missing' },
            { id: 'match-denied' },
            { id: 'match-unknown' },
            { id: 'match-error' },
          ],
          nextPageToken: null,
        },
      ],
    });
    repository.deleteDriverCurrentTrackingIfAssigned
      .mockResolvedValueOnce('deleted')
      .mockResolvedValueOnce('match-missing')
      .mockResolvedValueOnce('denied')
      .mockResolvedValueOnce('unknown-status')
      .mockRejectedValueOnce(new Error('Deletion exception'));

    const res = await cleanup('driver-1');
    expect(res.complete).toBe(false);
    expect(res.deletedCount).toBe(1);
    expect(res.deniedCount).toBe(1);
    expect(res.failedCount).toBe(2);
  });

  test('handles invalid match page response from repository', async () => {
    const repository = {
      listMatchesByDriver: jest.fn(async () => ({ matches: 'not-an-array', nextPageToken: null })),
      deleteDriverCurrentTrackingIfAssigned: jest.fn(),
    };
    const cleanup = createDriverTrackingCleanup({ repository, logger: jest.fn() });

    await expect(cleanup('driver-1')).resolves.toMatchObject({
      complete: false,
      failedCount: 1,
    });
  });

  test('handles invalid candidate match ID in page', async () => {
    const { cleanup } = createHarness({
      pages: [{ matches: [{ id: '../bad-id' }], nextPageToken: null }],
    });

    const res = await cleanup('driver-1');
    expect(res.complete).toBe(false);
    expect(res.failedCount).toBe(1);
  });

  test('handles null or invalid candidates in matches array', async () => {
    const { cleanup } = createHarness({
      pages: [{ matches: [null, { id: 'match-1' }, {}], nextPageToken: null }],
      deletion: 'deleted',
    });

    const res = await cleanup('driver-1');
    expect(res.complete).toBe(false);
    expect(res.scannedCount).toBe(3);
    expect(res.deletedCount).toBe(1);
    expect(res.failedCount).toBe(2);
  });

  test('detects infinite pagination token loops', async () => {
    const repository = {
      listMatchesByDriver: jest.fn(async () => ({
        matches: [{ id: 'match-1' }],
        nextPageToken: 'loop-token',
      })),
      deleteDriverCurrentTrackingIfAssigned: jest.fn(async () => 'deleted'),
    };
    const cleanup = createDriverTrackingCleanup({ repository, logger: jest.fn() });

    const res = await cleanup('driver-1');
    expect(res.complete).toBe(false);
    expect(res.failedCount).toBe(1);
  });

  test('reports a partial result when a repository page fails', async () => {
    const { cleanup, repository } = createHarness({
      pages: [{ matches: [{ id: 'match-1' }], nextPageToken: null }],
    });
    repository.listMatchesByDriver.mockRejectedValueOnce(new Error('private error'));

    await expect(cleanup('driver-1')).resolves.toMatchObject({
      complete: false,
      failedCount: 1,
      errorCode: 'unknown',
    });
  });

  test('reports a numeric Firestore error as a sanitized code', async () => {
    const { cleanup, repository } = createHarness({
      pages: [{ matches: [{ id: 'match-1' }], nextPageToken: null }],
    });
    repository.listMatchesByDriver.mockRejectedValueOnce({ code: 9 });

    await expect(cleanup('driver-1')).resolves.toMatchObject({
      complete: false,
      errorCode: 'failed-precondition',
    });
  });

  test('reports a sanitized Firestore error code and string-encoded numeric code', async () => {
    const { cleanup, repository } = createHarness({
      pages: [{ matches: [{ id: 'match-1' }], nextPageToken: null }],
    });
    repository.listMatchesByDriver.mockRejectedValueOnce({ code: 'failed-precondition' });
    const { cleanup: retryCleanup, repository: retryRepository } = createHarness({
      pages: [{ matches: [{ id: 'match-1' }], nextPageToken: null }],
    });
    retryRepository.listMatchesByDriver.mockRejectedValueOnce({ code: '16' });

    await expect(cleanup('driver-1')).resolves.toMatchObject({
      complete: false,
      errorCode: 'failed-precondition',
    });
    await expect(retryCleanup('driver-1')).resolves.toMatchObject({
      complete: false,
      errorCode: 'unauthenticated',
    });
  });

  test('does not expose the driver ID or private error in logs', async () => {
    const { cleanup, logger } = createHarness({
      pages: [{ matches: [{ id: 'match-1' }], nextPageToken: null }],
    });

    await cleanup('private-driver-id');
    expect(JSON.stringify(logger.mock.calls)).not.toContain('private-driver-id');
    expect(JSON.stringify(logger.mock.calls)).not.toContain('match-1');
  });

  test('rejects an invalid driver ID', async () => {
    const { cleanup } = createHarness({ pages: [] });
    await expect(cleanup('../driver')).rejects.toThrow('valid driver document ID');
  });
});
