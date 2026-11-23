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
    collection(subName) {
      return makeCollection(`${path}/${subName}`);
    },
  });

  const makeCollection = (path) => ({
    path,
    doc(id) {
      const resolvedId = id || `auto_${Math.random()}`;
      return makeRef(`${path}/${resolvedId}`);
    },
    where(field, op, value) {
      const filters = [[field, op, value]];
      let limitCount = 500;

      const builder = {
        where(sF, sOp, sVal) {
          filters.push([sF, sOp, sVal]);
          return builder;
        },
        orderBy() {
          return builder;
        },
        startAfter() {
          return builder;
        },
        limit(count) {
          limitCount = count;
          return builder;
        },
        async get() {
          const docs = [];
          for (const [docPath, data] of documents.entries()) {
            if (!docPath.startsWith(`${path}/`) || docPath.slice(path.length + 1).includes('/')) {
              continue;
            }
            const docId = docPath.split('/').pop();
            const matches = filters.every(([f, op, expected]) => {
              if (op === '==') return data[f] === expected;
              if (op === 'array-contains')
                return Array.isArray(data[f]) && data[f].includes(expected);
              return true;
            });
            if (matches) {
              docs.push({
                id: docId,
                ref: makeRef(docPath),
                data: () => ({ ...data }),
                get: (field) => data?.[field],
              });
            }
            if (docs.length >= limitCount) break;
          }
          return { docs, empty: docs.length === 0 };
        },
      };
      return builder;
    },
    orderBy() {
      return this.where('__name__', '==', null);
    },
  });

  const applyUpdates = (existing, data) => {
    const next = { ...existing };
    for (const [k, v] of Object.entries(data)) {
      if (
        v &&
        typeof v === 'object' &&
        v.constructor?.name === 'FieldTransform' &&
        v.methodName === 'DELETE'
      ) {
        delete next[k];
      } else if (v && typeof v === 'object' && v._arrayRemove) {
        next[k] = (next[k] || []).filter((item) => item !== v._arrayRemove);
      } else if (v && typeof v === 'object' && v.isEqual && v.isEqual(FieldValue.delete())) {
        delete next[k];
      } else {
        next[k] = v;
      }
    }
    return next;
  };

  const batch = {
    delete: jest.fn((ref) => {
      const path = ref.path || ref;
      documents.delete(path);
    }),
    update: jest.fn((ref, data) => {
      const path = ref.path || ref;
      const existing = documents.get(path) || {};
      documents.set(path, applyUpdates(existing, data));
    }),
    set: jest.fn((ref, data, options) => {
      const path = ref.path || ref;
      const existing = documents.get(path);
      documents.set(path, options?.merge && existing ? { ...existing, ...data } : data);
    }),
    commit: jest.fn(async () => {}),
  };

  return {
    _documents: documents,
    collection(name) {
      return makeCollection(name);
    },
    batch: jest.fn(() => batch),
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
          const existing = documents.get(path) || {};
          documents.set(path, applyUpdates(existing, data));
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

describe('accountDeletionService Extended Unit Tests', () => {
  test('constants and helper functions', () => {
    expect(validUid('valid-uid')).toBe(true);
    expect(validUid('../invalid')).toBe(false);
    expect(hashUid('user-1')).toBeDefined();
    expect(redactedParticipant('user-1')).toContain('deleted:');
    expect(safeErrorCode(new AccountDeletionError('active-match'))).toBe('active-match');
    expect(safeErrorCode(new AccountDeletionError('already-completed'))).toBe('already-completed');
    expect(safeErrorCode(new AccountDeletionError('auth-delete-failed'))).toBe(
      'auth-delete-failed'
    );
    expect(safeErrorCode(new AccountDeletionError('cleanup-incomplete'))).toBe(
      'cleanup-incomplete'
    );
    expect(safeErrorCode(new AccountDeletionError('in-progress'))).toBe('in-progress');
    expect(safeErrorCode(new AccountDeletionError('invalid-data'))).toBe('invalid-data');
    expect(safeErrorCode(new AccountDeletionError('lease-lost'))).toBe('lease-lost');
    expect(safeErrorCode(new AccountDeletionError('reservation-exists'))).toBe(
      'reservation-exists'
    );
    expect(safeErrorCode(new AccountDeletionError('storage-delete-failed'))).toBe(
      'storage-delete-failed'
    );
    expect(safeErrorCode({ code: 'auth/user-not-found' })).toBe('not-found');
    expect(safeErrorCode({ code: 'unavailable' })).toBe('unavailable');
    expect(safeErrorCode({ code: 'unknown' })).toBe('internal');

    const state1 = {
      status: DELETION_STATUS.COMPLETED,
      phase: 'completed',
      updatedAt: { toDate: () => new Date() },
    };
    expect(publicState(state1).status).toBe('completed');

    const state2 = {
      status: DELETION_STATUS.FAILED,
      lastErrorCode: 'active-match',
      updatedAt: { toDate: () => new Date() },
    };
    expect(publicState(state2).errorCode).toBe('active-match');
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

  test('deleteAuthUser handles auth/user-not-found gracefully and throws auth-delete-failed on other errors', async () => {
    const firestore = makeMockFirestore({
      'users/user-1': { role: 'parent' },
    });
    const authNotFound = {
      getUser: jest.fn(),
      deleteUser: jest.fn().mockRejectedValue({ code: 'auth/user-not-found' }),
    };
    const authFail = {
      getUser: jest.fn(),
      deleteUser: jest.fn().mockRejectedValue(new Error('Network error')),
    };
    const storage = { bucket: jest.fn(() => ({ getFiles: jest.fn().mockResolvedValue([[]]) })) };

    const service1 = createAccountDeletionService({
      firestore,
      auth: authNotFound,
      storage,
      serverTimestamp: FieldValue.serverTimestamp,
    });
    await expect(service1.deleteAuthUser('user-1')).resolves.toBeUndefined();

    const service2 = createAccountDeletionService({
      firestore,
      auth: authFail,
      storage,
      serverTimestamp: FieldValue.serverTimestamp,
    });
    await expect(service2.deleteAuthUser('user-1')).rejects.toThrow(AccountDeletionError);
  });
});
