const { createMatchFinalizationCleanup } = require('../src/matchFinalizationCleanup');

const makeEvent = (beforeStatus, afterStatus, matchId = 'match-A') => ({
  params: { matchId },
  data: {
    before: { data: () => ({ status: beforeStatus }) },
    after: { data: () => ({ status: afterStatus }) },
  },
});

const createHarness = (deleteResult = 'deleted') => {
  const repository = {
    deleteMatchCurrentTrackingIfTerminal: jest.fn(async () => deleteResult),
  };
  const logger = jest.fn();
  const handleUpdate = createMatchFinalizationCleanup({ repository, logger });
  return { handleUpdate, repository, logger };
};

describe('match finalization GPS cleanup', () => {
  test.each([
    ['active', 'completed'],
    ['active', 'cancelled'],
    ['pending', 'cancelled'],
  ])('cleans on %s -> %s', async (beforeStatus, terminalStatus) => {
    const { handleUpdate, repository, logger } = createHarness();

    await expect(handleUpdate(makeEvent(beforeStatus, terminalStatus))).resolves.toEqual({
      status: 'deleted',
    });
    expect(repository.deleteMatchCurrentTrackingIfTerminal).toHaveBeenCalledWith('match-A');
    expect(logger).toHaveBeenCalledWith({
      operation: 'cleanup_finalized_match_current_tracking',
      result: 'deleted',
    });
    expect(JSON.stringify(logger.mock.calls)).not.toContain('match-A');
  });

  test.each([
    ['active', 'active'],
    ['completed', 'cancelled'],
    ['pending', 'completed'],
    ['pending', 'pending'],
    ['active', 'pending'],
  ])('ignores transition %s -> %s', async (beforeStatus, afterStatus) => {
    const { handleUpdate, repository, logger } = createHarness();

    await expect(handleUpdate(makeEvent(beforeStatus, afterStatus))).resolves.toEqual({
      status: 'ignored',
    });
    expect(repository.deleteMatchCurrentTrackingIfTerminal).not.toHaveBeenCalled();
    expect(logger).not.toHaveBeenCalled();
  });

  test.each(['missing', 'match-missing', 'skipped'])(
    'returns idempotent repository outcome %s',
    async (deleteResult) => {
      const { handleUpdate } = createHarness(deleteResult);

      await expect(handleUpdate(makeEvent('active', 'completed'))).resolves.toEqual({
        status: deleteResult,
      });
    }
  );

  test('logs a sanitized error and propagates it for platform retry', async () => {
    const firestoreError = {
      code: 14,
      message: 'coordinates 41.8,-87.6 user@example.test private-token',
    };
    const { handleUpdate, repository, logger } = createHarness();
    repository.deleteMatchCurrentTrackingIfTerminal.mockRejectedValueOnce(firestoreError);

    await expect(handleUpdate(makeEvent('active', 'cancelled'))).rejects.toBe(firestoreError);
    expect(logger).toHaveBeenCalledWith({
      operation: 'cleanup_finalized_match_current_tracking',
      result: 'failed',
      errorCode: 'unavailable',
    });
    expect(JSON.stringify(logger.mock.calls)).not.toMatch(
      /41\.8|-87\.6|user@example\.test|private-token|match-A/
    );
  });

  test('does not log arbitrary error codes', async () => {
    const { handleUpdate, repository, logger } = createHarness();
    repository.deleteMatchCurrentTrackingIfTerminal.mockRejectedValueOnce({
      code: 'private-token',
    });

    await expect(handleUpdate(makeEvent('active', 'completed'))).rejects.toMatchObject({
      code: 'private-token',
    });
    expect(logger).toHaveBeenCalledWith({
      operation: 'cleanup_finalized_match_current_tracking',
      result: 'failed',
      errorCode: 'unknown',
    });
  });

  test('validates the event match identifier', async () => {
    const { handleUpdate, repository } = createHarness();

    await expect(handleUpdate(makeEvent('active', 'completed', 'invalid/match'))).rejects.toThrow(
      'valid matchId'
    );
    expect(repository.deleteMatchCurrentTrackingIfTerminal).not.toHaveBeenCalled();
  });
});
