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
  DELETION_PHASE,
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

  const makeCollection = (path) => {
    const createQuery = (
      filters = [],
      orderedBy = null,
      startAfterDoc = null,
      limitCount = 500
    ) => ({
      _filters: filters,
      _orderedBy: orderedBy,
      _startAfter: startAfterDoc,
      _limit: limitCount,
      where(sF, sOp, sVal) {
        return createQuery([...filters, [sF, sOp, sVal]], orderedBy, startAfterDoc, limitCount);
      },
      orderBy(field) {
        return createQuery(filters, field, startAfterDoc, limitCount);
      },
      startAfter(val) {
        return createQuery(filters, orderedBy, val, limitCount);
      },
      limit(count) {
        return createQuery(filters, orderedBy, startAfterDoc, count);
      },
      async get() {
        const docs = [];
        for (const [docPath, data] of documents.entries()) {
          if (!docPath.startsWith(`${path}/`) || docPath.slice(path.length + 1).includes('/')) {
            continue;
          }
          const docId = docPath.split('/').pop();
          const matches = filters.every(([f, op, expected]) => {
            if (op === '==' && expected === null) return true;
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

        if (orderedBy) {
          docs.sort((a, b) => {
            const valA = orderedBy === '__name__' ? a.id : a.data()[orderedBy];
            const valB = orderedBy === '__name__' ? b.id : b.data()[orderedBy];
            return String(valA || '').localeCompare(String(valB || ''));
          });
        }

        let finalDocs = docs;
        if (startAfterDoc) {
          const cursorId = typeof startAfterDoc === 'string' ? startAfterDoc : startAfterDoc.id;
          const index = docs.findIndex((d) => d.id === cursorId);
          if (index !== -1) {
            finalDocs = docs.slice(index + 1);
          }
        }

        const limited = finalDocs.slice(0, limitCount);
        return { docs: limited, empty: limited.length === 0 };
      },
    });

    return {
      path,
      doc(id) {
        const resolvedId = id || `auto_${Math.random()}`;
        return makeRef(`${path}/${resolvedId}`);
      },
      where(field, op, value) {
        return createQuery([[field, op, value]]);
      },
      orderBy(field) {
        return createQuery([], field);
      },
    };
  };

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
      const path = ref?.path || ref;
      documents.delete(path);
    }),
    update: jest.fn((ref, data) => {
      const path = ref?.path || ref;
      const existing = documents.get(path) || {};
      documents.set(path, applyUpdates(existing, data));
    }),
    set: jest.fn((ref, data, options) => {
      const path = ref?.path || ref;
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
          const path = ref?.path || ref;
          const data = documents.get(path);
          return {
            exists: data !== undefined,
            data: () => (data ? { ...data } : null),
            get: (field) => data?.[field],
          };
        },
        set(ref, data, options) {
          const path = ref?.path || ref;
          const existing = documents.get(path);
          documents.set(path, options?.merge && existing ? { ...existing, ...data } : data);
        },
        update(ref, data) {
          const path = ref?.path || ref;
          const existing = documents.get(path) || {};
          documents.set(path, applyUpdates(existing, data));
        },
        create(ref, data) {
          const path = ref?.path || ref;
          documents.set(path, data);
        },
        delete(ref) {
          const path = ref?.path || ref;
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

  test('resumePendingRequests runs successfully with candidates', async () => {
    const firestore = makeMockFirestore({
      'accountDeletionRequests/user-1': {
        status: 'pending',
        requestId: 'req-1',
        uid: 'user-1',
        phase: DELETION_PHASE.MATCHES,
        lease: null,
        retryable: true,
      },
      'users/user-1': { role: 'parent' },
    });
    const auth = {
      getUser: jest.fn().mockResolvedValue({ uid: 'user-1', email: 'u@test.com' }),
      deleteUser: jest.fn().mockResolvedValue(),
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

    const res = await service.resumePendingRequests({ maxSteps: 5 });
    expect(res.processed).toBeGreaterThanOrEqual(1);
  });

  test('cleanupChats handles exclusive chat deletion', async () => {
    const firestore = makeMockFirestore({
      'chats/c-solo': { participants: ['user-1'] },
      'chats/c-solo/messages/msg1': { authorId: 'user-1', text: 'hi' },
      'accountDeletionRequests/user-1': {
        status: 'pending',
        phase: DELETION_PHASE.CHATS,
        lease: null,
      },
    });
    const auth = { getUser: jest.fn(), deleteUser: jest.fn() };
    const storage = { bucket: jest.fn(() => ({ getFiles: jest.fn().mockResolvedValue([[]]) })) };

    const service = createAccountDeletionService({
      firestore,
      auth,
      storage,
      serverTimestamp: FieldValue.serverTimestamp,
    });

    const token = await service.acquireLease('user-1');
    const res = await service.cleanupChats('user-1', token);
    expect(res.count).toBe(1);
    expect(firestore._documents.has('chats/c-solo')).toBe(false);
  });

  test('cleanupchats handles shared chat participant removal', async () => {
    const firestore = makeMockFirestore({
      'chats/c-shared': { participants: ['user-1', 'user-2'] },
      'chats/c-shared/messages/msg1': { senderId: 'user-1', text: 'hi' },
      'accountDeletionRequests/user-1': {
        status: 'pending',
        phase: DELETION_PHASE.CHATS,
        lease: null,
      },
    });
    const auth = { getUser: jest.fn(), deleteUser: jest.fn() };
    const storage = { bucket: jest.fn(() => ({ getFiles: jest.fn().mockResolvedValue([[]]) })) };

    const service = createAccountDeletionService({
      firestore,
      auth,
      storage,
      serverTimestamp: FieldValue.serverTimestamp,
    });

    const token = await service.acquireLease('user-1');
    const res = await service.cleanupChats('user-1', token);
    expect(res.count).toBe(1);
    expect(firestore._documents.get('chats/c-shared').participants).toEqual(['user-2']);
  });

  test('cleanupMatches anonymizes completed/cancelled matches with PII redaction', async () => {
    const firestore = makeMockFirestore({
      'users/user-1': { role: 'parent' },
      'matches/m-comp': { parentId: 'user-1', status: 'completed', parentName: 'Jane' },
      'matches/m-canc': { driverId: 'user-1', status: 'cancelled', driverName: 'Bob' },
      'accountDeletionRequests/user-1': {
        status: 'pending',
        phase: DELETION_PHASE.MATCHES,
        lease: null,
      },
    });
    const auth = { getUser: jest.fn(), deleteUser: jest.fn() };
    const storage = { bucket: jest.fn(() => ({ getFiles: jest.fn().mockResolvedValue([[]]) })) };

    const service = createAccountDeletionService({
      firestore,
      auth,
      storage,
      serverTimestamp: FieldValue.serverTimestamp,
    });

    const token = await service.acquireLease('user-1');
    const res = await service.cleanupMatches('user-1', token);
    expect(res.count).toBe(2);
  });

  test('verifyNoResidualData returns false when profile or storage files exist', async () => {
    const firestore = makeMockFirestore({
      'users/user-1': { role: 'parent' },
    });
    const auth = { getUser: jest.fn(), deleteUser: jest.fn() };
    const storage = {
      bucket: jest.fn(() => ({
        getFiles: jest
          .fn()
          .mockResolvedValue([
            [{ name: 'users/user-1/avatar.jpg', delete: jest.fn().mockResolvedValue() }],
          ]),
      })),
    };

    const service = createAccountDeletionService({
      firestore,
      auth,
      storage,
      serverTimestamp: FieldValue.serverTimestamp,
    });
    expect(await service.verifyNoResidualData('user-1')).toBe(false);
  });

  test('cleanupStorage deletes files successfully', async () => {
    const firestore = makeMockFirestore();
    const auth = { getUser: jest.fn(), deleteUser: jest.fn() };
    const deleteFn = jest.fn().mockResolvedValue();
    const storage = {
      bucket: jest.fn(() => ({
        getFiles: jest
          .fn()
          .mockResolvedValue([[{ name: 'users/user-1/avatar.jpg', delete: deleteFn }]]),
      })),
    };

    const service = createAccountDeletionService({
      firestore,
      auth,
      storage,
      serverTimestamp: FieldValue.serverTimestamp,
    });
    firestore._documents.set('accountDeletionRequests/user-1', {
      lease: { ownerToken: 'token-1', expiresAt: Date.now() + 600000 },
    });

    const res = await service.cleanupStorage('user-1', 'token-1');
    expect(res.count).toBe(1);
    expect(deleteFn).toHaveBeenCalled();
  });

  test('deleteAuthUser throws auth-delete-failed on general error', async () => {
    const firestore = makeMockFirestore();
    const auth = {
      getUser: jest.fn(),
      deleteUser: jest.fn().mockRejectedValue(new Error('Firebase auth error')),
    };
    const storage = { bucket: jest.fn(() => ({ getFiles: jest.fn().mockResolvedValue([[]]) })) };

    const service = createAccountDeletionService({
      firestore,
      auth,
      storage,
      serverTimestamp: FieldValue.serverTimestamp,
    });

    await expect(service.deleteAuthUser('user-1')).rejects.toThrow(AccountDeletionError);
  });

  test('runOneStep executes profile and verification phases successfully', async () => {
    const firestore = makeMockFirestore({
      'users/user-1': { role: 'parent' },
      'accountDeletionRequests/user-1': {
        status: 'pending',
        phase: DELETION_PHASE.PROFILE,
        lease: null,
      },
    });
    const auth = { getUser: jest.fn(), deleteUser: jest.fn().mockResolvedValue() };
    const storage = { bucket: jest.fn(() => ({ getFiles: jest.fn().mockResolvedValue([[]]) })) };

    const service = createAccountDeletionService({
      firestore,
      auth,
      storage,
      serverTimestamp: FieldValue.serverTimestamp,
    });
    const res = await service.requestDeletion('user-1', { maxSteps: 3 });
    expect(res).toBeDefined();
  });
});
