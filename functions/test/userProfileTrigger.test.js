const {
  buildInitialProfile,
  createEnsureUserProfileHandler,
  handleUserCreated,
} = require('../src/userProfileTrigger');

const createFirestoreMock = ({ snapshot, fail = false } = {}) => {
  const reference = { path: 'users/test-user' };
  const transaction = {
    get: jest.fn().mockResolvedValue({
      exists: Boolean(snapshot),
      data: () => snapshot,
    }),
    create: jest.fn(),
  };
  const firestore = {
    collection: jest.fn(() => ({
      doc: jest.fn(() => reference),
    })),
    runTransaction: jest.fn(async (callback) => {
      if (fail) {
        const error = new Error('users/private-user-id');
        error.code = 'unavailable';
        throw error;
      }
      return callback(transaction);
    }),
  };
  return { firestore, reference, transaction };
};

describe('user profile provisioning', () => {
  test('builds only the safe parent profile defaults', () => {
    const timestamp = jest.fn(() => 'server-time');

    expect(buildInitialProfile(timestamp)).toEqual({
      role: 'parent',
      approved: false,
      createdAt: 'server-time',
      updatedAt: 'server-time',
    });
    expect(timestamp).toHaveBeenCalledTimes(2);
  });

  test('creates one initial profile for a new Auth user', async () => {
    const { firestore, transaction } = createFirestoreMock();
    const logger = jest.fn();

    await expect(
      handleUserCreated(
        {
          data: {
            uid: 'test-user',
            email: 'private@example.test',
            displayName: 'Private Name',
          },
        },
        {
          firestore,
          serverTimestamp: () => 'server-time',
          logger,
        }
      )
    ).resolves.toEqual({ created: true });

    expect(transaction.create).toHaveBeenCalledTimes(1);
    expect(transaction.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        role: 'parent',
        approved: false,
      })
    );
  });

  test('does not overwrite or duplicate an existing profile', async () => {
    const existing = {
      role: 'driver',
      approved: true,
      customField: 'keep-me',
    };
    const { firestore, transaction } = createFirestoreMock({ snapshot: existing });
    const logger = jest.fn();

    await expect(
      handleUserCreated(
        { data: { uid: 'test-user' } },
        {
          firestore,
          serverTimestamp: () => 'server-time',
          logger,
        }
      )
    ).resolves.toEqual({ created: false });

    expect(transaction.create).not.toHaveBeenCalled();
  });

  test('fails safely without exposing Firestore details', async () => {
    const { firestore } = createFirestoreMock({ fail: true });
    const logger = jest.fn();

    await expect(
      handleUserCreated(
        { data: { uid: 'private-user-id' } },
        {
          firestore,
          serverTimestamp: () => 'server-time',
          logger,
        }
      )
    ).rejects.toThrow('Unable to provision the user profile.');

    expect(logger).toHaveBeenCalledWith({
      operation: 'provision_user_profile',
      result: 'failed',
      errorCode: 'unavailable',
    });
  });

  test('logs no UID, email, display name, token, or credential', async () => {
    const { firestore } = createFirestoreMock();
    const logger = jest.fn();

    await handleUserCreated(
      {
        data: {
          uid: 'private-user-id',
          email: 'private@example.test',
          displayName: 'Private Name',
          token: 'private-token',
          password: 'private-password',
        },
      },
      {
        firestore,
        serverTimestamp: () => 'server-time',
        logger,
      }
    );

    const serializedLogs = JSON.stringify(logger.mock.calls);
    expect(serializedLogs).not.toContain('private-user-id');
    expect(serializedLogs).not.toContain('private@example.test');
    expect(serializedLogs).not.toContain('Private Name');
    expect(serializedLogs).not.toContain('private-token');
    expect(serializedLogs).not.toContain('private-password');
  });

  test('recovers a missing profile through the authenticated callable', async () => {
    const { firestore, transaction } = createFirestoreMock();
    const handler = createEnsureUserProfileHandler({
      firestore,
      serverTimestamp: () => 'server-time',
      logger: jest.fn(),
    });

    await expect(handler({ auth: { uid: 'test-user' }, data: {} })).resolves.toEqual({
      created: true,
    });
    expect(transaction.create).toHaveBeenCalledTimes(1);
  });

  test('rejects unauthenticated recovery requests', async () => {
    const { firestore } = createFirestoreMock();
    const handler = createEnsureUserProfileHandler({
      firestore,
      serverTimestamp: () => 'server-time',
      logger: jest.fn(),
    });

    await expect(handler({ data: {} })).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });
});
