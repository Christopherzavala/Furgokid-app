const { MatchLifecycleError } = require('../src/matchLifecycle');
const { createMatchLifecycleCallables } = require('../src/matchLifecycleCallables');

class TestHttpsError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const createHarness = () => {
  const repository = {
    createOrAddMatch: jest.fn(async (input) => input),
    acceptMatch: jest.fn(async (input) => input),
    cancelMatch: jest.fn(async (input) => input),
    completeMatch: jest.fn(async (input) => input),
    closeRequest: jest.fn(async (input) => input),
    deleteRequests: jest.fn(async (input) => input),
    updateVacancyCapacity: jest.fn(async (input) => input),
    initializeVacancyCapacity: jest.fn(async (input) => input),
  };
  const logger = jest.fn();
  return {
    repository,
    logger,
    callables: createMatchLifecycleCallables({
      repository,
      logger,
      HttpsErrorClass: TestHttpsError,
    }),
  };
};

describe('match lifecycle callable adapters', () => {
  test('requires verified Firebase authentication context', async () => {
    const { callables, repository } = createHarness();
    await expect(
      callables.acceptMatch({ data: { matchId: 'match-1', actorUid: 'spoofed-user' } })
    ).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(repository.acceptMatch).not.toHaveBeenCalled();
  });

  test('uses auth uid, not client identity, and derives driver only from the request payload vacancy ID', async () => {
    const { callables, repository } = createHarness();
    const response = await callables.createMatch({
      auth: { uid: 'verified-parent' },
      data: {
        requestId: 'request-1',
        vacancyId: 'selected-vacancy',
        driverId: 'forged-driver',
        parentId: 'forged-parent',
        requestData: { school: 'School', childrenCount: 1 },
      },
    });

    expect(response).toMatchObject({
      actorUid: 'verified-parent',
      requestId: 'request-1',
      vacancyId: 'selected-vacancy',
    });
    expect(repository.createOrAddMatch).toHaveBeenCalledWith(
      expect.objectContaining({ actorUid: 'verified-parent', vacancyId: 'selected-vacancy' })
    );
    expect(repository.createOrAddMatch.mock.calls[0][0]).not.toHaveProperty('driverId');
  });

  test('maps lifecycle validation errors to callable errors without exposing details', async () => {
    const { callables, repository, logger } = createHarness();
    repository.acceptMatch.mockRejectedValueOnce(
      new MatchLifecycleError('failed-precondition', 'private details')
    );

    await expect(
      callables.acceptMatch({
        auth: { uid: 'verified-driver' },
        data: { matchId: 'match-1' },
      })
    ).rejects.toMatchObject({
      code: 'failed-precondition',
      message: 'The requested match operation is not allowed.',
    });
    expect(JSON.stringify(logger.mock.calls)).not.toContain('private details');
  });

  test('uses authenticated identity for request deletion and returns a clear match-blocked error', async () => {
    const { callables, repository } = createHarness();
    repository.deleteRequests.mockRejectedValueOnce(
      new MatchLifecycleError('failed-precondition', 'request-has-matches')
    );

    await expect(
      callables.deleteRequests({
        auth: { uid: 'verified-parent' },
        data: { requestIds: ['request-1'], actorUid: 'spoofed-user' },
      })
    ).rejects.toMatchObject({
      code: 'failed-precondition',
      message: 'No se puede eliminar la solicitud porque tiene matches asociados.',
    });
    expect(repository.deleteRequests).toHaveBeenCalledWith({
      actorUid: 'verified-parent',
      requestIds: ['request-1'],
    });
  });

  test.each([null, '', '../match', 'match/path', 4])(
    'rejects invalid match IDs: %p',
    async (matchId) => {
      const { callables, repository } = createHarness();
      await expect(
        callables.cancelMatch({ auth: { uid: 'parent-1' }, data: { matchId } })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
      expect(repository.cancelMatch).not.toHaveBeenCalled();
    }
  );
});
