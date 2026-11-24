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

const isDocumentIdField = (field) =>
  field === '__name__' ||
  (field &&
    typeof field === 'object' &&
    Array.isArray(field._segments) &&
    field._segments.join('.') === '__name__');

const makeMockFirestore = (initialData = {}) => {
  const documents = new Map(Object.entries(initialData));

  const makeRef = (path) => ({
    path,
    id: path.split('/').pop(),
    async get() {
      const data = documents.get(path);
      return {
        exists: data !== undefined,
        id: path.split('/').pop(),
        ref: makeRef(path),
        data: () => (data ? { ...data } : null),
        get: (field) => data?.[field],
      };
    },
    async set(data, options) {
      const existing = documents.get(path);
      documents.set(path, options?.merge && existing ? { ...existing, ...data } : { ...data });
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
      startAfterCursor = null,
      limitCount = 500
    ) => ({
      where(field, op, value) {
        return createQuery(
          [...filters, [field, op, value]],
          orderedBy,
          startAfterCursor,
          limitCount
        );
      },
      orderBy(field) {
        return createQuery(filters, field, startAfterCursor, limitCount);
      },
      startAfter(cursor) {
        return createQuery(filters, orderedBy, cursor, limitCount);
      },
      limit(count) {
        return createQuery(filters, orderedBy, startAfterCursor, count);
      },
      async get() {
        const docs = [];
        for (const [docPath, data] of documents.entries()) {
          if (!docPath.startsWith(`${path}/`) || docPath.slice(path.length + 1).includes('/')) {
            continue;
          }
          const docId = docPath.split('/').pop();
          const matches = filters.every(([f, op, expected]) => {
            const actual = isDocumentIdField(f) ? docId : data[f];
            if (op === '==') return actual === expected;
            if (op === '!=') return actual !== expected;
            if (op === 'in') return Array.isArray(expected) && expected.includes(actual);
            if (op === 'array-contains') {
              return Array.isArray(actual) && actual.includes(expected);
            }
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
        }

        docs.sort((a, b) => {
          if (!orderedBy || isDocumentIdField(orderedBy)) {
            return a.id.localeCompare(b.id);
          }
          const valA = a.data()[orderedBy];
          const valB = b.data()[orderedBy];
          return String(valA || '').localeCompare(String(valB || ''));
        });

        let finalDocs = docs;
        if (startAfterCursor) {
          const cursorId =
            typeof startAfterCursor === 'string' ? startAfterCursor : startAfterCursor.id;
          const index = docs.findIndex((d) => d.id === cursorId);
          if (index !== -1) {
            finalDocs = docs.slice(index + 1);
          }
        }

        const limited = finalDocs.slice(0, limitCount);
        return { docs: limited, empty: limited.length === 0, size: limited.length };
      },
    });

    return {
      path,
      doc(id) {
        const resolvedId = id || `auto_${Math.random().toString(36).slice(2)}`;
        return makeRef(`${path}/${resolvedId}`);
      },
      where(field, op, value) {
        return createQuery([[field, op, value]]);
      },
      orderBy(field) {
        return createQuery([], field);
      },
      limit(count) {
        return createQuery([], null, null, count);
      },
      async get() {
        return createQuery().get();
      },
    };
  };

  const applyUpdates = (existing, data) => {
    const next = { ...existing };
    for (const [k, v] of Object.entries(data)) {
      if (
        v &&
        typeof v === 'object' &&
        typeof v.isEqual === 'function' &&
        v.isEqual(FieldValue.delete())
      ) {
        delete next[k];
      } else if (
        v &&
        typeof v === 'object' &&
        v.constructor?.name === 'FieldTransform' &&
        v.methodName === 'DELETE'
      ) {
        delete next[k];
      } else if (v && typeof v === 'object' && Array.isArray(v.elements)) {
        next[k] = (next[k] || []).filter((item) => !v.elements.includes(item));
      } else if (v && typeof v === 'object' && v._arrayRemove) {
        next[k] = (next[k] || []).filter((item) => item !== v._arrayRemove);
      } else {
        next[k] = v;
      }
    }
    return next;
  };

  return {
    _documents: documents,
    collection(name) {
      return makeCollection(name);
    },
    batch: jest.fn(() => {
      const ops = [];
      return {
        delete(ref) {
          ops.push(() => documents.delete(ref.path || ref));
        },
        update(ref, data) {
          ops.push(() => {
            const path = ref.path || ref;
            const existing = documents.get(path) || {};
            documents.set(path, applyUpdates(existing, data));
          });
        },
        set(ref, data, options) {
          ops.push(() => {
            const path = ref.path || ref;
            const existing = documents.get(path);
            documents.set(
              path,
              options?.merge && existing ? { ...existing, ...data } : { ...data }
            );
          });
        },
        async commit() {
          for (const op of ops) op();
        },
      };
    }),
    async runTransaction(callback) {
      const transaction = {
        async get(ref) {
          const path = ref.path || ref;
          const data = documents.get(path);
          return {
            exists: data !== undefined,
            id: path.split('/').pop(),
            ref: makeRef(path),
            data: () => (data ? { ...data } : null),
            get: (field) => data?.[field],
          };
        },
        set(ref, data, options) {
          const path = ref.path || ref;
          const existing = documents.get(path);
          documents.set(path, options?.merge && existing ? { ...existing, ...data } : { ...data });
        },
        update(ref, data) {
          const path = ref.path || ref;
          const existing = documents.get(path) || {};
          documents.set(path, applyUpdates(existing, data));
        },
        create(ref, data) {
          const path = ref.path || ref;
          documents.set(path, { ...data });
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

const runUntilComplete = async (service, firestore, uid) => {
  for (let i = 0; i < 10; i += 1) {
    const res = await service.requestDeletion(uid);
    if (res.status === DELETION_STATUS.COMPLETED) return res;
    if (res.status === DELETION_STATUS.FAILED) {
      throw new Error(
        `Deletion failed: ${JSON.stringify(
          firestore._documents.get(`accountDeletionRequests/${uid}`)
        )}`
      );
    }
  }
  return service.getDeletionStatus(uid);
};

describe('accountDeletionService', () => {
  test('helpers, validators, error mapping and publicState', () => {
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

    expect(
      publicState({
        status: DELETION_STATUS.COMPLETED,
        phase: DELETION_PHASE.COMPLETED,
        updatedAt: { toDate: () => new Date() },
      }).status
    ).toBe('completed');

    expect(
      publicState({
        status: DELETION_STATUS.FAILED,
        lastErrorCode: 'active-match',
        updatedAt: { toDate: () => new Date() },
      }).errorCode
    ).toBe('active-match');
  });

  test('full lifecycle completes and cleans profile, collections, matches, chats, storage, auth and creates receipt', async () => {
    const firestore = makeMockFirestore({
      'users/uid-full': { role: 'driver', email: 'driver@test.com', name: 'Driver Test' },
      'routes/r1': { driverId: 'uid-full' },
      'requests/req1': { parentId: 'uid-full' },
      'requests/req2': { parentId: 'other-parent', activeMatchId: 'm-pending' },
      'vacancies/v1': { driverId: 'uid-full' },
      'vacancies/v2': { driverId: 'uid-full' },
      'notification_logs/nl1': { vacancyId: 'v1', driverId: 'uid-full' },
      'matches/m-completed': {
        parentId: 'uid-full',
        driverId: 'other-driver',
        status: 'completed',
        parentName: 'Secret',
      },
      'matches/m-pending': {
        driverId: 'uid-full',
        parentId: 'other-parent',
        status: 'pending',
        capacityReservationStatus: 'unreserved',
        reservedSeats: 0,
        requestId: 'req2',
        vacancyId: 'v2',
        driverName: 'Driver',
      },
      'matches/m-pending/tracking/current': { lat: -36.8 },
      'chats/c-solo': { participants: ['uid-full'] },
      'chats/c-solo/messages/msg1': { authorId: 'uid-full' },
      'chats/c-shared': { participants: ['uid-full', 'other-user'] },
      'chats/c-shared/messages/msg2': { senderId: 'uid-full' },
    });

    const auth = {
      getUser: jest.fn().mockResolvedValue({ uid: 'uid-full', email: 'driver@test.com' }),
      deleteUser: jest.fn().mockResolvedValue(),
    };

    const deleteFileMock = jest.fn().mockResolvedValue();
    let getFilesCall = 0;
    const storage = {
      bucket: jest.fn(() => ({
        getFiles: jest.fn(async () => {
          if (getFilesCall === 0) {
            getFilesCall += 1;
            return [
              [
                {
                  name: 'users/uid-full/avatar.jpg',
                  metadata: { generation: '1' },
                  delete: deleteFileMock,
                },
              ],
            ];
          }
          return [[]];
        }),
      })),
    };

    const service = createAccountDeletionService({
      firestore,
      auth,
      storage,
      serverTimestamp: FieldValue.serverTimestamp,
    });

    const res = await runUntilComplete(service, firestore, 'uid-full');
    expect(res.status).toBe(DELETION_STATUS.COMPLETED);
    expect(auth.deleteUser).toHaveBeenCalledWith('uid-full');
    expect(deleteFileMock).toHaveBeenCalled();
    expect(firestore._documents.has('accountDeletionReceipts/uid-full')).toBe(true);
    expect(firestore._documents.has('users/uid-full')).toBe(false);
    expect(firestore._documents.get('chats/c-shared').participants).toEqual(['other-user']);
  });

  test('resumePendingRequests processes only eligible pending, retryable failed and expired processing requests', async () => {
    const nowMs = Date.now();
    const firestore = makeMockFirestore({
      'accountDeletionRequests/u-pending': {
        requestId: 'req-p',
        status: DELETION_STATUS.PENDING,
        phase: DELETION_PHASE.AUTH,
        lease: null,
      },
      'accountDeletionRequests/u-failed-retry': {
        requestId: 'req-fr',
        status: DELETION_STATUS.FAILED,
        retryable: true,
        phase: DELETION_PHASE.AUTH,
        lease: null,
      },
      'accountDeletionRequests/u-failed-nonretry': {
        requestId: 'req-fnr',
        status: DELETION_STATUS.FAILED,
        retryable: false,
        phase: DELETION_PHASE.MATCHES,
        lease: null,
      },
      'accountDeletionRequests/u-expired': {
        requestId: 'req-exp',
        status: DELETION_STATUS.PROCESSING,
        phase: DELETION_PHASE.AUTH,
        lease: { ownerToken: 'old', expiresAt: nowMs - 10000 },
      },
      'accountDeletionRequests/u-active': {
        requestId: 'req-act',
        status: DELETION_STATUS.PROCESSING,
        phase: DELETION_PHASE.AUTH,
        lease: { ownerToken: 'live', expiresAt: nowMs + 60000 },
      },
    });

    const auth = {
      getUser: jest.fn().mockResolvedValue({}),
      deleteUser: jest.fn().mockResolvedValue(),
    };
    const storage = { bucket: jest.fn(() => ({ getFiles: jest.fn().mockResolvedValue([[]]) })) };

    const service = createAccountDeletionService({
      firestore,
      auth,
      storage,
      serverTimestamp: FieldValue.serverTimestamp,
    });

    const summary = await service.resumePendingRequests();
    expect(summary.processed).toBe(3);
    expect(auth.deleteUser).toHaveBeenCalledTimes(3);
    expect(auth.deleteUser).not.toHaveBeenCalledWith('u-failed-nonretry');
    expect(auth.deleteUser).not.toHaveBeenCalledWith('u-active');
  });

  test('edge & error branches: active lease, existing receipt, active/reserved matches, storage, auth and residual data', async () => {
    const auth = {
      getUser: jest.fn().mockResolvedValue({}),
      deleteUser: jest.fn().mockResolvedValue(),
    };
    const storage = {
      bucket: jest.fn(() => ({ getFiles: jest.fn().mockResolvedValue([[]]) })),
    };

    // 1. Active lease returns processing without running steps
    const fsActiveLease = makeMockFirestore({
      'accountDeletionRequests/u-lease': {
        requestId: 'r-lease',
        status: DELETION_STATUS.PROCESSING,
        phase: DELETION_PHASE.MATCHES,
        lease: { ownerToken: 'tok', expiresAt: Date.now() + 60000 },
      },
    });
    const svcLease = createAccountDeletionService({
      firestore: fsActiveLease,
      auth,
      storage,
      serverTimestamp: FieldValue.serverTimestamp,
    });
    const resLease = await svcLease.requestDeletion('u-lease');
    expect(resLease.status).toBe(DELETION_STATUS.PROCESSING);

    // 2. Existing receipt returns completed immediately
    const fsReceipt = makeMockFirestore({
      'accountDeletionReceipts/u-done': {
        requestId: 'r-done',
        status: DELETION_STATUS.COMPLETED,
        phase: DELETION_PHASE.COMPLETED,
      },
    });
    const svcReceipt = createAccountDeletionService({
      firestore: fsReceipt,
      auth,
      storage,
      serverTimestamp: FieldValue.serverTimestamp,
    });
    const resDone = await svcReceipt.requestDeletion('u-done');
    expect(resDone.status).toBe(DELETION_STATUS.COMPLETED);

    // 3. Active match blocks deletion with active-match
    const fsActiveMatch = makeMockFirestore({
      'users/u-act': { role: 'driver' },
      'matches/m-act': { driverId: 'u-act', status: 'active' },
    });
    const svcActiveMatch = createAccountDeletionService({
      firestore: fsActiveMatch,
      auth,
      storage,
      serverTimestamp: FieldValue.serverTimestamp,
    });
    await expect(svcActiveMatch.requestDeletion('u-act')).rejects.toMatchObject({
      code: 'active-match',
    });

    // 4. Pending match with reserved capacity fails with invalid-data
    const fsReservedMatch = makeMockFirestore({
      'users/u-res': { role: 'driver' },
      'requests/r1': { parentId: 'p1' },
      'vacancies/v1': { driverId: 'u-res' },
      'matches/m-res': {
        driverId: 'u-res',
        parentId: 'p1',
        requestId: 'r1',
        vacancyId: 'v1',
        status: 'pending',
        capacityReservationStatus: 'reserved',
        reservedSeats: 1,
      },
    });
    const svcReservedMatch = createAccountDeletionService({
      firestore: fsReservedMatch,
      auth,
      storage,
      serverTimestamp: FieldValue.serverTimestamp,
    });
    await expect(svcReservedMatch.requestDeletion('u-res')).rejects.toMatchObject({
      code: 'invalid-data',
    });

    // 5. Storage HTTP 412 ignored vs generic error throws storage-delete-failed
    const fsStorage = makeMockFirestore({
      'accountDeletionRequests/u-st': {
        lease: { ownerToken: 't-st', expiresAt: Date.now() + 60000 },
      },
    });
    const storage412 = {
      bucket: jest.fn(() => ({
        getFiles: jest.fn().mockResolvedValue([
          [
            {
              name: 'users/u-st/a.jpg',
              metadata: { generation: '1' },
              delete: jest.fn().mockRejectedValue({ code: 412 }),
            },
          ],
        ]),
      })),
    };
    const svcStorage412 = createAccountDeletionService({
      firestore: fsStorage,
      auth,
      storage: storage412,
      serverTimestamp: FieldValue.serverTimestamp,
    });
    await expect(svcStorage412.cleanupStorage('u-st', 't-st')).resolves.toMatchObject({
      completed: true,
    });

    const storageFail = {
      bucket: jest.fn(() => ({
        getFiles: jest
          .fn()
          .mockResolvedValue([
            [{ name: 'users/u-st/a.jpg', delete: jest.fn().mockRejectedValue(new Error('boom')) }],
          ]),
      })),
    };
    const svcStorageFail = createAccountDeletionService({
      firestore: fsStorage,
      auth,
      storage: storageFail,
      serverTimestamp: FieldValue.serverTimestamp,
    });
    await expect(svcStorageFail.cleanupStorage('u-st', 't-st')).rejects.toMatchObject({
      code: 'storage-delete-failed',
    });

    // 6. Auth user-not-found ignored vs generic error throws auth-delete-failed
    const svcAuthNotFound = createAccountDeletionService({
      firestore: fsStorage,
      auth: {
        getUser: jest.fn().mockResolvedValue({}),
        deleteUser: jest.fn().mockRejectedValue({ code: 'auth/user-not-found' }),
      },
      storage,
      serverTimestamp: FieldValue.serverTimestamp,
    });
    await expect(svcAuthNotFound.deleteAuthUser('u-st')).resolves.toBeUndefined();

    const svcAuthFail = createAccountDeletionService({
      firestore: fsStorage,
      auth: {
        getUser: jest.fn().mockResolvedValue({}),
        deleteUser: jest.fn().mockRejectedValue(new Error('auth down')),
      },
      storage,
      serverTimestamp: FieldValue.serverTimestamp,
    });
    await expect(svcAuthFail.deleteAuthUser('u-st')).rejects.toMatchObject({
      code: 'auth-delete-failed',
    });

    // 7. Residual data fails verification with cleanup-incomplete
    const fsResidual = makeMockFirestore({
      'accountDeletionRequests/u-resid': {
        requestId: 'r-resid',
        status: DELETION_STATUS.PENDING,
        phase: DELETION_PHASE.VERIFICATION,
        lease: null,
      },
      'routes/residual-route': { driverId: 'u-resid' },
    });
    const svcResidual = createAccountDeletionService({
      firestore: fsResidual,
      auth,
      storage,
      serverTimestamp: FieldValue.serverTimestamp,
    });
    const resResidual = await svcResidual.requestDeletion('u-resid');
    expect(resResidual.status).toBe(DELETION_STATUS.FAILED);
    expect(resResidual.errorCode).toBe('cleanup-incomplete');
  });
});
