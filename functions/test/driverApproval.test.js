const { REQUEST_STATUS, createDriverApprovalRepository } = require('../src/driverApproval');
const { createDriverApprovalCallables } = require('../src/driverApprovalCallables');

const createMemoryFirestore = (seedData = {}) => {
  const documents = new Map(Object.entries(seedData));
  const snapshot = (uid) => ({
    exists: documents.has(uid),
    data: () => ({ ...(documents.get(uid) || {}) }),
    id: uid,
  });

  const firestore = {
    collection: jest.fn((name) => ({
      doc: jest.fn((uid) => ({
        uid,
        id: uid,
        get: async () => snapshot(uid),
        collection: jest.fn((subName) => ({
          doc: jest.fn(() => ({
            delete: jest.fn(async () => {}),
          })),
          where: jest.fn(() => ({
            get: async () => {
              const docs = [];
              if (subName === 'devices') {
                for (const [key, val] of documents.entries()) {
                  if (key.includes(`users/${uid}/devices/`)) {
                    docs.push({
                      id: key.split('/').pop(),
                      data: () => val,
                      ref: {
                        uid: key,
                        id: key,
                        collection: jest.fn(() => ({
                          doc: jest.fn(() => ({
                            delete: jest.fn(async () => {}),
                          })),
                        })),
                      },
                    });
                  }
                }
              }
              return { docs, empty: docs.length === 0, size: docs.length };
            },
          })),
        })),
      })),
      where: jest.fn((field, op, value) => {
        const filters = [{ field, op, value }];
        const queryObj = {
          where: (f2, op2, v2) => {
            filters.push({ field: f2, op: op2, value: v2 });
            return queryObj;
          },
          get: async () => {
            const docs = [];
            for (const [key, val] of documents.entries()) {
              let matches = true;
              for (const f of filters) {
                if (!val) {
                  matches = false;
                  break;
                }
                const docVal = val[f.field];
                if (f.op === '==' && docVal !== f.value) {
                  matches = false;
                }
                if (f.op === 'in' && (!Array.isArray(f.value) || !f.value.includes(docVal))) {
                  matches = false;
                }
              }
              if (matches) {
                docs.push({
                  id: key,
                  data: () => val,
                  ref: {
                    uid: key,
                    id: key,
                    collection: jest.fn(() => ({
                      doc: jest.fn(() => ({
                        delete: jest.fn(async () => {}),
                      })),
                    })),
                  },
                });
              }
            }
            return { docs, empty: docs.length === 0, size: docs.length };
          },
        };
        return queryObj;
      }),
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
          const current = { ...(documents.get(reference.uid) || {}) };
          for (const [k, v] of Object.entries(data)) {
            if (
              v &&
              (v.constructor?.name === 'FieldPath' ||
                v.constructor?.name === 'FieldValue' ||
                String(v).includes('FieldPath') ||
                String(v).includes('DELETE') ||
                k === 'activeMatchId')
            ) {
              delete current[k];
            } else {
              current[k] = v;
            }
          }
          documents.set(reference.uid, current);
        }),
        delete: jest.fn((reference) => {
          documents.delete(reference.uid);
        }),
      })
    ),
  };
  return { documents, firestore };
};

const seed = (documents, uid, profile) => documents.set(uid, profile);

describe('driver approval backend & cascade', () => {
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
      getUserActiveDevices: jest.fn(async () => [
        { deviceId: 'dev1', expoPushToken: 'ExponentPushToken[test]' },
      ]),
      sendExpoPush: jest.fn(async () => ({
        ok: true,
        json: async () => ({ data: [{ status: 'ok' }] }),
      })),
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

  test('revokes approval, cancels active vacancies and matches, and notifies affected parents', async () => {
    seed(documents, 'admin', { role: 'admin', approved: false });
    seed(documents, 'target', {
      role: 'driver',
      approved: true,
      driverRequestStatus: REQUEST_STATUS.APPROVED,
    });
    seed(documents, 'vacancy_1', {
      driverId: 'target',
      status: 'active',
      availableSeats: 5,
      reservedSeats: 2,
    });
    seed(documents, 'match_1', {
      driverId: 'target',
      parentId: 'parent_1',
      requestId: 'req_1',
      vacancyId: 'vacancy_1',
      status: 'active',
      capacityReservationStatus: 'reserved',
      reservedSeats: 2,
    });
    seed(documents, 'req_1', { activeMatchId: 'match_1', status: 'active' });
    seed(documents, 'users/parent_1/devices/dev1', {
      deviceId: 'dev1',
      userId: 'parent_1',
      expoPushToken: 'ExponentPushToken[parent1]',
      status: 'active',
    });

    const getUserActiveDevices = jest.fn(async () => [
      { deviceId: 'dev1', expoPushToken: 'ExponentPushToken[parent1]' },
    ]);
    const sendExpoPush = jest.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ status: 'ok' }] }),
    }));

    const localCallables = createDriverApprovalCallables({
      repository,
      logger: jest.fn(),
      getUserActiveDevices,
      sendExpoPush,
    });

    const res = await localCallables.reviewDriverRequest({
      auth: { uid: 'admin' },
      data: { targetUid: 'target', decision: 'revoke' },
    });

    expect(res).toMatchObject({ status: REQUEST_STATUS.REVOKED, idempotent: false });
    expect(documents.get('target')).toMatchObject({ role: 'parent', approved: false });
    expect(documents.get('vacancy_1')).toMatchObject({
      status: 'cancelled',
      availableSeats: 7,
      reservedSeats: 0,
    });
    expect(documents.get('match_1')).toMatchObject({
      status: 'cancelled',
      capacityReservationStatus: 'released',
    });
    expect(documents.get('req_1').activeMatchId).toBeUndefined();
    expect(sendExpoPush).toHaveBeenCalled();
  });

  test('idempotency: second invocation of revoke returns idempotent true without push', async () => {
    seed(documents, 'admin', { role: 'admin', approved: false });
    seed(documents, 'target', {
      role: 'parent',
      approved: false,
      driverRequestStatus: REQUEST_STATUS.REVOKED,
    });

    const sendExpoPush = jest.fn();
    const localCallables = createDriverApprovalCallables({
      repository,
      logger: jest.fn(),
      sendExpoPush,
    });

    const res = await localCallables.reviewDriverRequest({
      auth: { uid: 'admin' },
      data: { targetUid: 'target', decision: 'revoke' },
    });

    expect(res).toEqual({ status: REQUEST_STATUS.REVOKED, idempotent: true });
    expect(sendExpoPush).not.toHaveBeenCalled();
  });

  test('resilience: if sendExpoPush fails, reviewDriverRequest still succeeds', async () => {
    seed(documents, 'admin', { role: 'admin', approved: false });
    seed(documents, 'target', {
      role: 'driver',
      approved: true,
      driverRequestStatus: REQUEST_STATUS.APPROVED,
    });
    seed(documents, 'match_1', {
      driverId: 'target',
      parentId: 'parent_1',
      requestId: 'req_1',
      vacancyId: 'vacancy_1',
      status: 'active',
      capacityReservationStatus: 'unreserved',
    });
    seed(documents, 'users/parent_1/devices/dev1', {
      deviceId: 'dev1',
      userId: 'parent_1',
      expoPushToken: 'ExponentPushToken[parent1]',
      status: 'active',
    });

    const sendExpoPush = jest.fn(async () => {
      throw new Error('Expo Push network failure');
    });

    const localCallables = createDriverApprovalCallables({
      repository,
      logger: jest.fn(),
      getUserActiveDevices: jest.fn(async () => [{ deviceId: 'd1', expoPushToken: 'token' }]),
      sendExpoPush,
    });

    await expect(
      localCallables.reviewDriverRequest({
        auth: { uid: 'admin' },
        data: { targetUid: 'target', decision: 'revoke' },
      })
    ).resolves.toMatchObject({ status: REQUEST_STATUS.REVOKED, idempotent: false });

    expect(documents.get('target')).toMatchObject({ role: 'parent', approved: false });
  });
});
