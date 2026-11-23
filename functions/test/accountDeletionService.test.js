'use strict';

const { FieldValue } = require('firebase-admin/firestore');
const {
  createAccountDeletionService,
  safeErrorCode,
  publicState,
  validUid,
  hashUid,
  redactedParticipant,
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
      };
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

    expect(safeErrorCode({ code: 'auth/user-not-found' })).toBe('not-found');
    expect(safeErrorCode({ code: 'active-match' })).toBe('active-match');
    expect(safeErrorCode({ code: 'unknown-err' })).toBe('internal');

    expect(publicState(null)).toEqual({ status: 'none' });
    expect(publicState({ status: 'completed', phase: 'completed' })).toEqual({
      status: 'completed',
      phase: 'completed',
      errorCode: null,
      updatedAt: null,
    });
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
});
