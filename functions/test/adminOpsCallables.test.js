'use strict';

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'test' });
}

const { assertAdminOrOps, getOpsDashboardSnapshot } = require('../src/adminOpsCallables');

const makeFirestore = (initial = {}) => {
  const documents = new Map(Object.entries(initial));
  let autoIdCounter = 0;

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
  });

  const makeQuery = (path, filters = [], limit = Infinity) => ({
    async get() {
      const docs = [];
      for (const [docPath, data] of documents.entries()) {
        if (!docPath.startsWith(`${path}/`) || docPath.slice(path.length + 1).includes('/')) {
          continue;
        }
        const matches = filters.every(([field, op, expected]) => {
          if (op === '==') return data[field] === expected;
          return true;
        });
        if (matches) {
          docs.push({
            id: docPath.split('/').pop(),
            ref: makeRef(docPath),
            data: () => ({ ...data }),
          });
        }
        if (docs.length >= limit) break;
      }
      return {
        docs,
        empty: docs.length === 0,
      };
    },
  });

  const makeCollection = (path) => ({
    path,
    doc(id) {
      const resolvedId = id || `auto_inc_${++autoIdCounter}`;
      return makeRef(`${path}/${resolvedId}`);
    },
    where(field, op, value) {
      const filters = [[field, op, value]];
      const builder = {
        where(sF, sOp, sVal) {
          filters.push([sF, sOp, sVal]);
          return builder;
        },
        limit(limitCount) {
          return {
            get: () => makeQuery(path, filters, limitCount).get(),
          };
        },
        get: () => makeQuery(path, filters).get(),
      };
      return builder;
    },
    limit(limitCount) {
      return {
        get: () => makeQuery(path, [], limitCount).get(),
      };
    },
    get: () => makeQuery(path).get(),
  });

  return {
    _documents: documents,
    collection: makeCollection,
  };
};

const setupFirestoreSpy = (mockDb) => {
  return jest.spyOn(admin, 'firestore').mockReturnValue(mockDb);
};

describe('adminOpsCallables Unit Tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('assertAdminOrOps', () => {
    test('1. Throws unauthenticated if auth or uid is missing', async () => {
      const mockDb = makeFirestore();
      await expect(assertAdminOrOps({}, mockDb)).rejects.toMatchObject({
        code: 'unauthenticated',
      });
      await expect(assertAdminOrOps({ auth: {} }, mockDb)).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    test('2. Allows access via custom token claim role (admin or ops)', async () => {
      const mockDb = makeFirestore();
      const adminReq = { auth: { uid: 'admin-1', token: { role: 'admin' } } };
      const opsReq = { auth: { uid: 'ops-1', token: { role: 'ops' } } };

      await expect(assertAdminOrOps(adminReq, mockDb)).resolves.toBe('admin-1');
      await expect(assertAdminOrOps(opsReq, mockDb)).resolves.toBe('ops-1');
    });

    test('3. Allows access via Firestore user document role if token claim is absent', async () => {
      const mockDb = makeFirestore({
        'users/user-admin': { role: 'admin' },
        'users/user-ops': { role: 'ops' },
      });
      setupFirestoreSpy(mockDb);

      const reqAdmin = { auth: { uid: 'user-admin', token: {} } };
      const reqOps = { auth: { uid: 'user-ops', token: {} } };

      await expect(assertAdminOrOps(reqAdmin, mockDb)).resolves.toBe('user-admin');
      await expect(assertAdminOrOps(reqOps, mockDb)).resolves.toBe('user-ops');
    });

    test('4. Throws permission-denied if user is neither admin nor ops', async () => {
      const mockDb = makeFirestore({
        'users/user-parent': { role: 'parent' },
      });
      setupFirestoreSpy(mockDb);

      const req = { auth: { uid: 'user-parent', token: {} } };
      await expect(assertAdminOrOps(req, mockDb)).rejects.toMatchObject({
        code: 'permission-denied',
      });
    });
  });

  describe('getOpsDashboardSnapshot', () => {
    test('5. Successfully retrieves ops dashboard snapshot for authorized admin/ops', async () => {
      const mockDb = makeFirestore({
        'users/admin-1': { role: 'admin' },
        'users/driver-pending': { driverRequestStatus: 'pending', name: 'Driver A' },
        'emergencyIncidents/inc-1': { status: 'ACTIVE', reason: 'Emergency' },
        'custodyEvents/ev-1': { eventType: 'HANDOVER' },
      });
      setupFirestoreSpy(mockDb);

      const res = await getOpsDashboardSnapshot.run({
        auth: { uid: 'admin-1', token: { role: 'admin' } },
      });

      expect(res.pendingDrivers.length).toBe(1);
      expect(res.pendingDrivers[0].uid).toBe('driver-pending');
      expect(res.activeEmergencies.length).toBe(1);
      expect(res.activeEmergencies[0].incidentId).toBe('inc-1');
      expect(res.recentCustodyEvents.length).toBe(1);
      expect(res.recentCustodyEvents[0].eventId).toBe('ev-1');
      expect(res.retrievedAt).toBeDefined();
    });
  });
});
