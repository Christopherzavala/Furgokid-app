const { createDriverTrackingCleanup } = require('../src/driverTrackingCleanup');

const createHarness = ({ pages, deletion = 'deleted' } = {}) => {
  const repository = {
    listMatchesByDriver: jest.fn(async ({ pageToken }) => {
      if (pageToken === null) return pages[0];
      return pages[1] || { matches: [], nextPageToken: null };
    }),
    deleteDriverCurrentTrackingIfAssigned: jest.fn(async () => deletion),
  };
  const logger = jest.fn();
  const cleanup = createDriverTrackingCleanup({ repository, logger });
  return { cleanup, repository, logger };
};

describe('driver tracking cleanup', () => {
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

  test('reports a sanitized Firestore error code', async () => {
    const { cleanup, repository } = createHarness({
      pages: [{ matches: [{ id: 'match-1' }], nextPageToken: null }],
    });
    repository.listMatchesByDriver.mockRejectedValueOnce({ code: 'failed-precondition' });
    const { cleanup: retryCleanup, repository: retryRepository } = createHarness({
      pages: [{ matches: [{ id: 'match-1' }], nextPageToken: null }],
    });
    retryRepository.listMatchesByDriver.mockRejectedValueOnce(new Error('private error'));

    await expect(cleanup('driver-1')).resolves.toMatchObject({
      complete: false,
      errorCode: 'failed-precondition',
    });
    await expect(retryCleanup('driver-1')).resolves.toMatchObject({
      complete: false,
      errorCode: 'unknown',
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
