const { FieldValue } = require('firebase-admin/firestore');
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
        uid: `${name}/${uid}`,
        id: uid,
        get: async () => snapshot(`${name}/${uid}`),
        collection: jest.fn((subName) => ({
          doc: jest.fn((subId) => ({
            uid: `${name}/${uid}/${subName}/${subId}`,
            id: subId,
            delete: jest.fn(async () => {
              documents.delete(`${name}/${uid}/${subName}/${subId}`);
            }),
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
                        collection: jest.fn((sName) => ({
                          doc: jest.fn((sId) => ({
                            uid: `${key}/${sName}/${sId}`,
                            id: sId,
                            delete: jest.fn(async () => {
                              documents.delete(`${key}/${sName}/${sId}`);
                            }),
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
              if (!key.startsWith(`${name}/`)) continue;
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
                const docId = key.split('/').pop();
                docs.push({
                  id: docId,
                  data: () => val,
                  ref: {
                    uid: key,
                    id: docId,
                    collection: jest.fn((subName) => ({
                      doc: jest.fn((subId) => ({
                        uid: `${key}/${subName}/${subId}`,
                        id: subId,
                        delete: jest.fn(async () => {
                          documents.delete(`${key}/${subName}/${subId}`);
                        }),
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
        get: jest.fn(async (reference) => {
          const u = reference.uid || reference;
          return snapshot(u);
        }),
        getAll: jest.fn(async (...references) =>
          references.map((reference) => {
            const u = reference.uid || reference;
            return snapshot(u);
          })
        ),
        create: jest.fn((reference, data) => {
          const u = reference.uid || reference;
          documents.set(u, { ...data });
        }),
        update: jest.fn((reference, data) => {
          const u = reference.uid || reference;
          const current = { ...(documents.get(u) || {}) };
          for (const [k, v] of Object.entries(data)) {
            if (
              v &&
              (v === FieldValue.delete() ||
                (typeof v.isEqual === 'function' && v.isEqual(FieldValue.delete())) ||
                v.constructor?.name === 'FieldPath' ||
                v.constructor?.name === 'FieldValue' ||
                v.constructor?.name === 'DeleteTransform' ||
                v.constructor?.name === 'FieldTransform' ||
                v.methodName === 'DELETE' ||
                v._method === 'DELETE' ||
                String(v).includes('FieldPath') ||
                String(v).includes('DELETE'))
            ) {
              delete current[k];
            } else {
              current[k] = v;
            }
          }
          documents.set(u, current);
        }),
        delete: jest.fn((reference) => {
          const u = reference.uid || reference;
          documents.delete(u);
        }),
      })
    ),
  };
  return { documents, firestore };
};

const seed = (documents, path, profile) => documents.set(path, profile);

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
    seed(documents, 'users/admin', { role: 'admin', approved: false });
    seed(documents, 'users/target', {
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

    expect(documents.get('users/target')).toMatchObject({
      role: 'driver',
      approved: true,
      driverRequestStatus: REQUEST_STATUS.APPROVED,
    });
  });

  test('revokes approval with multiple matches in same/different vacancies, capacity accumulation, and deduplicated parent push', async () => {
    seed(documents, 'users/admin', { role: 'admin', approved: false });
    seed(documents, 'users/target', {
      role: 'driver',
      approved: true,
      driverRequestStatus: REQUEST_STATUS.APPROVED,
    });
    seed(documents, 'vacancies/vacancy_1', {
      driverId: 'target',
      status: 'active',
      availableSeats: 4,
      reservedSeats: 3,
    });
    seed(documents, 'matches/match_1', {
      driverId: 'target',
      parentId: 'parent_1',
      requestId: 'req_1',
      vacancyId: 'vacancy_1',
      status: 'active',
      capacityReservationStatus: 'reserved',
      reservedSeats: 1,
    });
    seed(documents, 'matches/match_2', {
      driverId: 'target',
      parentId: 'parent_1',
      requestId: 'req_2',
      vacancyId: 'vacancy_1',
      status: 'active',
      capacityReservationStatus: 'reserved',
      reservedSeats: 2,
    });
    seed(documents, 'requests/req_1', { activeMatchId: 'match_1', status: 'active' });
    seed(documents, 'requests/req_2', { activeMatchId: 'match_2', status: 'active' });

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
    expect(documents.get('users/target')).toMatchObject({ role: 'parent', approved: false });
    expect(documents.get('vacancies/vacancy_1')).toMatchObject({
      status: 'cancelled',
      availableSeats: 7,
      reservedSeats: 0,
    });
    expect(documents.get('matches/match_1')).toMatchObject({
      status: 'cancelled',
      cancellationReason: 'driver_revoked',
      capacityReservationStatus: 'released',
    });
    expect(documents.get('matches/match_2')).toMatchObject({
      status: 'cancelled',
      cancellationReason: 'driver_revoked',
      capacityReservationStatus: 'released',
    });
    expect(documents.get('requests/req_1').activeMatchId).toBeUndefined();
    expect(documents.get('requests/req_2').activeMatchId).toBeUndefined();
    expect(getUserActiveDevices).toHaveBeenCalledTimes(1);
    expect(sendExpoPush).toHaveBeenCalledTimes(1);
  });

  test('rejects a pending driver request in cascade and cleans up residual matches/vacancies', async () => {
    seed(documents, 'users/admin', { role: 'admin', approved: false });
    seed(documents, 'users/target', {
      role: 'parent',
      approved: false,
      driverRequestStatus: REQUEST_STATUS.PENDING,
    });
    seed(documents, 'vacancies/vacancy_1', {
      driverId: 'target',
      status: 'active',
      availableSeats: 8,
      reservedSeats: 0,
    });
    seed(documents, 'matches/match_1', {
      driverId: 'target',
      parentId: 'parent_1',
      requestId: 'req_1',
      vacancyId: 'vacancy_1',
      status: 'pending',
      capacityReservationStatus: 'unreserved',
      reservedSeats: 0,
    });
    seed(documents, 'requests/req_1', { status: 'active' });

    const res = await repository.reviewDriverRequest({
      actorUid: 'admin',
      targetUid: 'target',
      decision: 'reject',
    });

    expect(res).toMatchObject({ status: REQUEST_STATUS.REJECTED, idempotent: false });
    expect(documents.get('users/target')).toMatchObject({ role: 'parent', approved: false });
    expect(documents.get('vacancies/vacancy_1').status).toBe('cancelled');
    expect(documents.get('matches/match_1').status).toBe('cancelled');
  });

  test('deletes live tracking document during revocation cascade', async () => {
    seed(documents, 'users/admin', { role: 'admin', approved: false });
    seed(documents, 'users/target', {
      role: 'driver',
      approved: true,
      driverRequestStatus: REQUEST_STATUS.APPROVED,
    });
    seed(documents, 'matches/match_1', {
      driverId: 'target',
      parentId: 'parent_1',
      requestId: 'req_1',
      vacancyId: 'vacancy_1',
      status: 'active',
    });
    seed(documents, 'matches/match_1/tracking/current', { latitude: -33, longitude: -70 });

    const transactionSpy = jest.spyOn(firestore, 'runTransaction');

    await repository.reviewDriverRequest({
      actorUid: 'admin',
      targetUid: 'target',
      decision: 'revoke',
    });

    expect(transactionSpy).toHaveBeenCalled();
    expect(documents.has('matches/match_1/tracking/current')).toBe(false);
  });

  test('idempotency: second invocation of revoke returns idempotent true without push', async () => {
    seed(documents, 'users/admin', { role: 'admin', approved: false });
    seed(documents, 'users/target', {
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
    seed(documents, 'users/admin', { role: 'admin', approved: false });
    seed(documents, 'users/target', {
      role: 'driver',
      approved: true,
      driverRequestStatus: REQUEST_STATUS.APPROVED,
    });
    seed(documents, 'matches/match_1', {
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

    expect(documents.get('users/target')).toMatchObject({ role: 'parent', approved: false });
  });
});
