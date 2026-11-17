const { createMatchDeletionGpsCleanup } = require('../src/matchDeletionGpsCleanup');

describe('match deletion GPS cleanup trigger', () => {
  test('deletes only the current point for the deleted match', async () => {
    const repository = { deleteCurrentTrackingByMatchId: jest.fn(async () => 'deleted') };
    const logger = jest.fn();
    const trigger = createMatchDeletionGpsCleanup({ repository, logger });

    await expect(trigger({ params: { matchId: 'match-1' } })).resolves.toEqual({
      status: 'deleted',
    });
    expect(repository.deleteCurrentTrackingByMatchId).toHaveBeenCalledWith('match-1');
  });

  test('is idempotent when the current point is absent', async () => {
    const repository = { deleteCurrentTrackingByMatchId: jest.fn(async () => 'missing') };
    const trigger = createMatchDeletionGpsCleanup({ repository, logger: jest.fn() });

    await expect(trigger({ params: { matchId: 'match-1' } })).resolves.toEqual({
      status: 'missing',
    });
  });

  test('rejects an invalid match ID', async () => {
    const repository = { deleteCurrentTrackingByMatchId: jest.fn() };
    const trigger = createMatchDeletionGpsCleanup({ repository, logger: jest.fn() });

    await expect(trigger({ params: { matchId: '../match' } })).rejects.toThrow('valid matchId');
    expect(repository.deleteCurrentTrackingByMatchId).not.toHaveBeenCalled();
  });
});
