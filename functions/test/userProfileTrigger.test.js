const {
  buildInitialProfile,
  createEnsureUserProfileHandler,
  handleUserCreated,
  provisionProfileIfMissing,
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

  test('provisionProfileIfMissing validates inputs (uid, firestore, serverTimestamp)', async () => {
    await expect(
      provisionProfileIfMissing({ uid: '../bad', firestore: {}, serverTimestamp: () => {} })
    ).rejects.toThrow(TypeError);
    await expect(
      provisionProfileIfMissing({ uid: 'user-1', firestore: null, serverTimestamp: () => {} })
    ).rejects.toThrow(TypeError);
    await expect(
      provisionProfileIfMissing({
        uid: 'user-1',
        firestore: { collection: () => {} },
        serverTimestamp: null,
      })
    ).rejects.toThrow(TypeError);
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

  test('handles invalid event uid in handleUserCreated safely', async () => {
    const { firestore } = createFirestoreMock();
    const logger = jest.fn();

    await expect(
      handleUserCreated({ data: { uid: '../bad' } }, { firestore, logger })
    ).rejects.toThrow('Unable to provision the user profile.');

    expect(logger).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'provision_user_profile',
        result: 'failed',
        errorCode: 'invalid-argument',
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

  test('createEnsureUserProfileHandler validates firestore dependency', () => {
    expect(() => createEnsureUserProfileHandler({ firestore: null })).toThrow(TypeError);
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

  test('handles provisioning errors in createEnsureUserProfileHandler safely', async () => {
    const { firestore } = createFirestoreMock({ fail: true });
    const logger = jest.fn();
    const handler = createEnsureUserProfileHandler({
      firestore,
      serverTimestamp: () => 'server-time',
      logger,
    });

    await expect(handler({ auth: { uid: 'test-user' }, data: {} })).rejects.toMatchObject({
      code: 'internal',
    });
    expect(logger).toHaveBeenCalledWith(
      expect.objectContaining({ operation: 'ensure_user_profile', result: 'failed' })
    );
  });
});
