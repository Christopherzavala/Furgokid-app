const { REQUEST_STATUS, createDriverApprovalRepository } = require('../src/driverApproval');
const { createDriverApprovalCallables } = require('../src/driverApprovalCallables');

const createMemoryFirestore = () => {
  const documents = new Map();
  const snapshot = (uid) => ({
    exists: documents.has(uid),
    data: () => ({ ...(documents.get(uid) || {}) }),
  });
  const firestore = {
    collection: jest.fn(() => ({
      doc: jest.fn((uid) => ({ uid })),
    })),
    runTransaction: jest.fn(async (callback) =>
      callback({
        get: jest.fn(async (reference) => snapshot(reference.uid)),
        getAll: jest.fn(async (...references) =>
          references.map((reference) => snapshot(reference.uid))
        ),
        create: jest.fn((reference, data) => {
          documents.set(reference.uid, { ...data });
        }),
        update: jest.fn((reference, data) => {
          documents.set(reference.uid, {
            ...(documents.get(reference.uid) || {}),
            ...data,
          });
        }),
      })
    ),
  };
  return { documents, firestore };
};

const seed = (documents, uid, profile) => documents.set(uid, profile);

describe('driver approval backend', () => {
  let documents;
  let firestore;
  let repository;
  let callables;

  beforeEach(() => {
    ({ documents, firestore } = createMemoryFirestore());
    repository = createDriverApprovalRepository({
      firestore,
      serverTimestamp: () => 'server-time',
    });
    callables = createDriverApprovalCallables({
      repository,
      logger: jest.fn(),
    });
  });

  test('requires authentication to request or review a driver role', async () => {
    await expect(callables.requestDriverApproval({ data: {} })).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    await expect(
      callables.reviewDriverRequest({
        data: { targetUid: 'parent', decision: 'approve' },
      })
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  test('allows a parent to request approval idempotently', async () => {
    seed(documents, 'parent', { role: 'parent', approved: false });

    await expect(repository.requestDriverApproval({ actorUid: 'parent' })).resolves.toEqual({
      status: REQUEST_STATUS.PENDING,
      idempotent: false,
    });
    await expect(repository.requestDriverApproval({ actorUid: 'parent' })).resolves.toEqual({
      status: REQUEST_STATUS.PENDING,
      idempotent: true,
    });

    expect(documents.get('parent')).toMatchObject({
      role: 'parent',
      approved: false,
      driverRequestStatus: REQUEST_STATUS.PENDING,
    });
  });

  test('does not let a normal user approve themselves', async () => {
    seed(documents, 'parent', {
      role: 'parent',
      approved: false,
      driverRequestStatus: REQUEST_STATUS.PENDING,
    });

    await expect(
      repository.reviewDriverRequest({
        actorUid: 'parent',
        targetUid: 'parent',
        decision: 'approve',
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  test('does not let a normal user approve another user', async () => {
    seed(documents, 'normal', { role: 'parent', approved: false });
    seed(documents, 'target', {
      role: 'parent',
      approved: false,
      driverRequestStatus: REQUEST_STATUS.PENDING,
    });

    await expect(
      repository.reviewDriverRequest({
        actorUid: 'normal',
        targetUid: 'target',
        decision: 'approve',
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(documents.get('target')).toMatchObject({
      role: 'parent',
      approved: false,
    });
  });

  test('allows an authorized administrator to approve a pending request', async () => {
    seed(documents, 'admin', { role: 'admin', approved: false });
    seed(documents, 'target', {
      role: 'parent',
      approved: false,
      driverRequestStatus: REQUEST_STATUS.PENDING,
    });

    await expect(
      repository.reviewDriverRequest({
        actorUid: 'admin',
        targetUid: 'target',
        decision: 'approve',
      })
    ).resolves.toEqual({ status: REQUEST_STATUS.APPROVED, idempotent: false });

    expect(documents.get('target')).toMatchObject({
      role: 'driver',
      approved: true,
      driverRequestStatus: REQUEST_STATUS.APPROVED,
    });
  });

  test('does not duplicate an already completed approval', async () => {
    seed(documents, 'admin', { role: 'admin', approved: false });
    seed(documents, 'target', {
      role: 'driver',
      approved: true,
      driverRequestStatus: REQUEST_STATUS.APPROVED,
    });

    await expect(
      repository.reviewDriverRequest({
        actorUid: 'admin',
        targetUid: 'target',
        decision: 'approve',
      })
    ).resolves.toEqual({ status: REQUEST_STATUS.APPROVED, idempotent: true });
  });

  test('rejects invalid transitions', async () => {
    seed(documents, 'admin', { role: 'admin', approved: false });
    seed(documents, 'target', {
      role: 'parent',
      approved: false,
      driverRequestStatus: REQUEST_STATUS.REJECTED,
    });

    await expect(
      repository.reviewDriverRequest({
        actorUid: 'admin',
        targetUid: 'target',
        decision: 'approve',
      })
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  test('keeps a rejected driver as an unapproved parent', async () => {
    seed(documents, 'admin', { role: 'admin', approved: false });
    seed(documents, 'target', {
      role: 'parent',
      approved: false,
      driverRequestStatus: REQUEST_STATUS.PENDING,
    });

    await expect(
      repository.reviewDriverRequest({
        actorUid: 'admin',
        targetUid: 'target',
        decision: 'reject',
      })
    ).resolves.toEqual({ status: REQUEST_STATUS.REJECTED, idempotent: false });
    expect(documents.get('target')).toMatchObject({
      role: 'parent',
      approved: false,
      driverRequestStatus: REQUEST_STATUS.REJECTED,
    });
  });

  test('revokes approval and returns the driver to an unapproved parent', async () => {
    seed(documents, 'admin', { role: 'admin', approved: false });
    seed(documents, 'target', {
      role: 'driver',
      approved: true,
      driverRequestStatus: REQUEST_STATUS.APPROVED,
    });

    await expect(
      repository.reviewDriverRequest({
        actorUid: 'admin',
        targetUid: 'target',
        decision: 'revoke',
      })
    ).resolves.toEqual({ status: REQUEST_STATUS.REVOKED, idempotent: false });
    expect(documents.get('target')).toMatchObject({
      role: 'parent',
      approved: false,
      driverRequestStatus: REQUEST_STATUS.REVOKED,
    });
  });

  test('rejects non-object request data', async () => {
    await expect(
      callables.requestDriverApproval({ auth: { uid: 'parent' }, data: false })
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('validates callable input and forwards only trusted identity', async () => {
    seed(documents, 'admin', { role: 'admin', approved: false });
    seed(documents, 'target', {
      role: 'parent',
      approved: false,
      driverRequestStatus: REQUEST_STATUS.PENDING,
    });

    await expect(
      callables.reviewDriverRequest({
        auth: { uid: 'admin' },
        data: { targetUid: 'target', decision: 'approve', role: 'admin' },
      })
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(
      callables.reviewDriverRequest({
        auth: { uid: 'admin' },
        data: { targetUid: '../target', decision: 'approve' },
      })
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});
