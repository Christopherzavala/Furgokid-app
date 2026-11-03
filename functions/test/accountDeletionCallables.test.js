const { createAccountDeletionCallables } = require('../src/accountDeletionCallables');
const { AccountDeletionError } = require('../src/accountDeletionService');

const createHarness = ({ requestDeletion, getDeletionStatus } = {}) => {
  const service = {
    requestDeletion:
      requestDeletion ||
      jest.fn(async (uid) => ({
        status: 'pending',
        uid,
      })),
    getDeletionStatus:
      getDeletionStatus ||
      jest.fn(async (uid) => ({
        status: 'processing',
        uid,
      })),
  };
  const logger = jest.fn();
  const callables = createAccountDeletionCallables({ service, logger });

  return { ...callables, logger, service };
};

describe('account deletion callables', () => {
  test('requires an authenticated caller', async () => {
    const { requestAccountDeletion, getAccountDeletionStatus } = createHarness();

    await expect(requestAccountDeletion({ data: {} })).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    await expect(getAccountDeletionStatus({ data: {} })).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  test('uses only request.auth.uid and ignores client-selected identities', async () => {
    const { requestAccountDeletion, getAccountDeletionStatus, service } = createHarness();

    await expect(
      requestAccountDeletion({
        auth: { uid: 'authenticated-user' },
        data: {
          uid: 'victim-user',
          userId: 'victim-user',
          targetUid: 'victim-user',
        },
      })
    ).resolves.toEqual({ status: 'pending', uid: 'authenticated-user' });
    await expect(
      getAccountDeletionStatus({
        auth: { uid: 'authenticated-user' },
        data: { uid: 'victim-user' },
      })
    ).resolves.toEqual({ status: 'processing', uid: 'authenticated-user' });

    expect(service.requestDeletion).toHaveBeenCalledWith('authenticated-user');
    expect(service.getDeletionStatus).toHaveBeenCalledWith('authenticated-user');
  });

  test.each([
    ['active-match', 'failed-precondition'],
    ['already-completed', 'failed-precondition'],
    ['in-progress', 'aborted'],
    ['invalid-data', 'invalid-argument'],
    ['reservation-exists', 'failed-precondition'],
    ['unavailable', 'unavailable'],
  ])('maps %s to the safe HTTP error %s', async (serviceCode, httpCode) => {
    const { requestAccountDeletion } = createHarness({
      requestDeletion: jest.fn(async () => {
        throw new AccountDeletionError(serviceCode, false);
      }),
    });

    await expect(
      requestAccountDeletion({ auth: { uid: 'authenticated-user' }, data: {} })
    ).rejects.toMatchObject({
      code: httpCode,
      message: 'Unable to process the account deletion request.',
    });
  });

  test('does not expose internal error details', async () => {
    const privateFailure = new Error('private@example.test / internal detail');
    const { requestAccountDeletion, logger } = createHarness({
      requestDeletion: jest.fn(async () => {
        throw privateFailure;
      }),
    });

    await expect(
      requestAccountDeletion({ auth: { uid: 'authenticated-user' }, data: {} })
    ).rejects.toMatchObject({
      code: 'internal',
      message: 'Unable to process the account deletion request.',
    });
    expect(JSON.stringify(logger.mock.calls)).not.toContain('private@example.test');
  });
});
