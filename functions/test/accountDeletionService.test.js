'use strict';

const { FieldValue } = require('firebase-admin/firestore');
const { createAccountDeletionService } = require('../src/accountDeletionService');

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

  test('service initializes successfully with valid adapters', () => {
    const validFirestore = { collection: jest.fn() };
    const validAuth = { getUser: jest.fn(), deleteUser: jest.fn() };
    const validStorage = { bucket: jest.fn() };

    const service = createAccountDeletionService({
      firestore: validFirestore,
      auth: validAuth,
      storage: validStorage,
      serverTimestamp: FieldValue.serverTimestamp,
    });

    expect(service).toBeDefined();
    expect(typeof service.requestDeletion).toBe('function');
    expect(typeof service.getDeletionStatus).toBe('function');
    expect(typeof service.resumePendingRequests).toBe('function');
  });
});
