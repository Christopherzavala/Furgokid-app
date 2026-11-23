'use strict';

const { FieldValue } = require('firebase-admin/firestore');
const {
  createAccountDeletionService,
  AccountDeletionError,
  safeErrorCode,
  publicState,
  validUid,
  hashUid,
  redactedParticipant,
  DELETION_STATUS,
} = require('../src/accountDeletionService');

const makeMockFirestore = (initialData = {}) => {
  const documents = new Map(Object.entries(initialData));

  const makeRef = (path) => ({
    path,
    id: path.split('/').pop(),
    async get() {
      const data = documents.get(path);
      return {
        exists: data !== undefined,
        data: () => (data ? { ...data } : null),
        get: (field) => data?.[field],
      };
    },
    async set(data, options) {
      const existing = documents.get(path);
      documents.set(path, options?.merge && existing ? { ...existing, ...data } : data);
    },
    async delete() {
      documents.delete(path);
    },
  });

  return {
    _documents: documents,
    collection(name) {
      return {
        doc(id) {
          return makeRef(`${name}/${id}`);
        },
        where() {
          return {
            limit() {
              return {
                async get() {
                  const docs = [];
                  for (const [docPath, data] of documents.entries()) {
                    if (docPath.startsWith(`${name}/`)) {
                      docs.push({
                        id: docPath.split('/').pop(),
                        ref: makeRef(docPath),
                        data: () => ({ ...data }),
                        get: (field) => data?.[field],
                      });
                    }
                  }
                  return { docs, empty: docs.length === 0 };
                },
              };
            },
            async get() {
              const docs = [];
              for (const [docPath, data] of documents.entries()) {
                if (docPath.startsWith(`${name}/`)) {
                  docs.push({
                    id: docPath.split('/').pop(),
                    ref: makeRef(docPath),
                    data: () => ({ ...data }),
                    get: (field) => data?.[field],
                  });
                }
              }
              return { docs, empty: docs.length === 0 };
            },
          };
        },
      };
    },
    async runTransaction(callback) {
      const transaction = {
        async get(ref) {
          const path = ref.path || ref;
          const data = documents.get(path);
          return {
            exists: data !== undefined,
            data: () => (data ? { ...data } : null),
            get: (field) => data?.[field],
          };
        },
        set(ref, data, options) {
          const path = ref.path || ref;
          const existing = documents.get(path);
          documents.set(path, options?.merge && existing ? { ...existing, ...data } : data);
        },
        update(ref, data) {
          const path = ref.path || ref;
          const existing = documents.get(path);
          documents.set(path, { ...existing, ...data });
        },
        create(ref, data) {
          const path = ref.path || ref;
          documents.set(path, data);
        },
        delete(ref) {
          const path = ref.path || ref;
          documents.delete(path);
        },
      };
      return callback(transaction);
    },
  };
};

describe('accountDeletionService Unit Tests', () => {
  test('constructor validates required dependencies (firestore, auth, storage)', () => {
    const validFirestore = { collection: jest.fn() };
    const validAuth = { getUser: jest.fn(), deleteUser: jest.fn() };
    const validStorage = { bucket: jest.fn() };

    expect(() =>
      createAccountDeletionService({ firestore: null, auth: validAuth, storage: validStorage })
    ).toThrow(TypeError);
    expect(() =>
      createAccountDeletionService({ firestore: validFirestore, auth: null, storage: validStorage })
    ).toThrow(TypeError);
    expect(() =>
      createAccountDeletionService({ firestore: validFirestore, auth: validAuth, storage: null })
    ).toThrow(TypeError);
  });

  test('utility helpers (validUid, hashUid, redactedParticipant, safeErrorCode, publicState)', () => {
    expect(validUid('valid-uid')).toBe(true);
    expect(validUid('../invalid')).toBe(false);

    const hashed = hashUid('user-1');
    expect(typeof hashed).toBe('string');

    const redacted = redactedParticipant('user-1');
    expect(redacted.startsWith('deleted:')).toBe(true);

    expect(safeErrorCode(new AccountDeletionError('active-match'))).toBe('active-match');
    expect(safeErrorCode({ code: 'auth/user-not-found' })).toBe('not-found');
    expect(safeErrorCode({ code: 'unknown' })).toBe('internal');

    const state = {
      status: DELETION_STATUS.COMPLETED,
      phase: 'completed',
      updatedAt: { toDate: () => new Date() },
    };
    const pub = publicState(state);
    expect(pub.status).toBe('completed');
  });

  test('getDeletionStatus returns none if state and receipt do not exist', async () => {
    const firestore = makeMockFirestore();
    const auth = { getUser: jest.fn(), deleteUser: jest.fn() };
    const storage = { bucket: jest.fn() };

    const service = createAccountDeletionService({
      firestore,
      auth,
      storage,
      serverTimestamp: FieldValue.serverTimestamp,
    });

    const status = await service.getDeletionStatus('user-1');
    expect(status).toEqual({ status: 'none' });
  });

  test('getDeletionStatus returns status from state document', async () => {
    const firestore = makeMockFirestore({
      'accountDeletionRequests/user-1': {
        status: 'pending',
        phase: 'matches',
        updatedAt: { toDate: () => new Date('2026-11-24T00:00:00Z') },
      },
    });
    const auth = { getUser: jest.fn(), deleteUser: jest.fn() };
    const storage = { bucket: jest.fn() };

    const service = createAccountDeletionService({
      firestore,
      auth,
      storage,
      serverTimestamp: FieldValue.serverTimestamp,
    });

    const status = await service.getDeletionStatus('user-1');
    expect(status.status).toBe('pending');
    expect(status.phase).toBe('matches');
    expect(status.updatedAt).toBeDefined();
  });

  test('getDeletionStatus returns status from receipt document if state is missing', async () => {
    const firestore = makeMockFirestore({
      'accountDeletionReceipts/user-1': {
        status: 'completed',
        phase: 'completed',
        updatedAt: { toDate: () => new Date('2026-11-24T00:00:00Z') },
      },
    });
    const auth = { getUser: jest.fn(), deleteUser: jest.fn() };
    const storage = { bucket: jest.fn() };

    const service = createAccountDeletionService({
      firestore,
      auth,
      storage,
      serverTimestamp: FieldValue.serverTimestamp,
    });

    const status = await service.getDeletionStatus('user-1');
    expect(status.status).toBe('completed');
  });

  test('isDeletionPending returns true when pending, false otherwise', async () => {
    const firestore = makeMockFirestore({
      'accountDeletionRequests/user-pending': {
        status: 'pending',
      },
    });
    const auth = { getUser: jest.fn(), deleteUser: jest.fn() };
    const storage = { bucket: jest.fn() };

    const service = createAccountDeletionService({
      firestore,
      auth,
      storage,
      serverTimestamp: FieldValue.serverTimestamp,
    });

    expect(await service.isDeletionPending('user-pending')).toBe(true);
    expect(Boolean(await service.isDeletionPending('user-missing'))).toBe(false);
  });

  test('requestDeletion blocks when active match exists', async () => {
    const firestore = makeMockFirestore({
      'users/driver-1': { role: 'driver' },
      'matches/match-1': { driverId: 'driver-1', status: 'active' },
    });
    const auth = {
      getUser: jest.fn().mockResolvedValue({ uid: 'driver-1', email: 'driver@example.com' }),
      deleteUser: jest.fn(),
    };
    const storage = {
      bucket: jest.fn(() => ({
        getFiles: jest.fn().mockResolvedValue([[]]),
      })),
    };

    const service = createAccountDeletionService({
      firestore,
      auth,
      storage,
      serverTimestamp: FieldValue.serverTimestamp,
    });

    await expect(service.requestDeletion('driver-1')).rejects.toThrow(AccountDeletionError);
  });

  test('resumePendingRequests runs successfully with no candidates', async () => {
    const firestore = makeMockFirestore();
    const auth = { getUser: jest.fn(), deleteUser: jest.fn() };
    const storage = { bucket: jest.fn() };

    const service = createAccountDeletionService({
      firestore,
      auth,
      storage,
      serverTimestamp: FieldValue.serverTimestamp,
    });

    const res = await service.resumePendingRequests();
    expect(res.processed).toBe(0);
  });
});
