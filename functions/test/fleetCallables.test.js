'use strict';

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'test' });
}

const { upsertDriverFleetAsset, verifyDriverFleetAsset } = require('../src/fleetCallables');

const makeFirestore = (initial = {}) => {
  const documents = new Map(Object.entries(initial));
  let autoIdCounter = 0;

  const makeRef = (path) => ({
    path,
    id: path.split('/').pop(),
    collection(name) {
      return makeCollection(`${path}/${name}`);
    },
    async get() {
      const data = documents.get(path);
      return {
        exists: data !== undefined,
        data: () => (data ? { ...data } : null),
        get: (field) => data?.[field],
      };
    },
    async update(data) {
      const existing = documents.get(path) || {};
      documents.set(path, { ...existing, ...data });
    },
    async set(data, options) {
      const existing = documents.get(path);
      documents.set(path, options?.merge && existing ? { ...existing, ...data } : data);
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
          if (op === 'in') return Array.isArray(expected) && expected.includes(data[field]);
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
      return { docs, empty: docs.length === 0 };
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
  });

  return {
    _documents: documents,
    collection: makeCollection,
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
          documents.set(path, { ...existing, ...data });
        },
      };
      return callback(transaction);
    },
  };
};

const setupFirestoreSpy = (mockDb) => {
  const spy = jest.spyOn(admin, 'firestore').mockReturnValue(mockDb);
  spy.FieldValue = {
    serverTimestamp: () => 'server-timestamp',
  };
  return spy;
};

describe('fleetCallables Unit Tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('upsertDriverFleetAsset', () => {
    test('1. Throws unauthenticated if auth is missing', async () => {
      await expect(upsertDriverFleetAsset.run({})).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    test('2. Throws permission-denied if user is not a driver or doc does not exist', async () => {
      const mockDb = makeFirestore({
        'users/parent-1': { role: 'parent' },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        upsertDriverFleetAsset.run({
          auth: { uid: 'parent-1' },
          data: { assetType: 'vehicle', payload: { plate: 'AB1234' } },
        })
      ).rejects.toMatchObject({ code: 'permission-denied' });

      await expect(
        upsertDriverFleetAsset.run({
          auth: { uid: 'missing-driver' },
          data: { assetType: 'vehicle', payload: { plate: 'AB1234' } },
        })
      ).rejects.toMatchObject({ code: 'permission-denied' });
    });

    test('3. Throws invalid-argument for invalid assetType or payload', async () => {
      const mockDb = makeFirestore({
        'users/driver-1': { role: 'driver' },
      });
      setupFirestoreSpy(mockDb);
      const auth = { uid: 'driver-1' };

      await expect(
        upsertDriverFleetAsset.run({ auth, data: { assetType: 'unknown', payload: {} } })
      ).rejects.toMatchObject({ code: 'invalid-argument' });

      await expect(
        upsertDriverFleetAsset.run({ auth, data: { assetType: 'vehicle', payload: null } })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('4. Vehicle: Throws invalid-argument if plate is missing or empty', async () => {
      const mockDb = makeFirestore({
        'users/driver-1': { role: 'driver' },
      });
      setupFirestoreSpy(mockDb);
      const auth = { uid: 'driver-1' };

      await expect(
        upsertDriverFleetAsset.run({
          auth,
          data: { assetType: 'vehicle', payload: { plate: '   ' } },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('5. Vehicle: Successfully creates/updates vehicle asset with formatted plate and fields', async () => {
      const mockDb = makeFirestore({
        'users/driver-1': { role: 'driver' },
      });
      setupFirestoreSpy(mockDb);

      const res = await upsertDriverFleetAsset.run({
        auth: { uid: 'driver-1' },
        data: {
          assetType: 'vehicle',
          payload: {
            plate: '  ab-1234  ',
            brand: 'Mercedes',
            model: 'Sprinter',
            year: 2022,
            capacity: 15,
            technicalReviewExpiry: '2026-12-31',
            insuranceExpiry: '2026-12-31',
          },
        },
      });

      expect(res.success).toBe(true);
      expect(res.assetType).toBe('vehicle');
      expect(res.vehicleId).toBe('veh_AB1234');
      expect(res.status).toBe('PENDING');

      const vehicleDoc = mockDb._documents.get('driverFleets/driver-1/vehicles/veh_AB1234');
      expect(vehicleDoc).toBeDefined();
      expect(vehicleDoc.plate).toBe('AB-1234');
      expect(vehicleDoc.brand).toBe('Mercedes');
      expect(vehicleDoc.capacity).toBe(15);
      expect(vehicleDoc.status).toBe('PENDING');
    });

    test('6. Vehicle: Handles fallback parsing for string year and default capacity', async () => {
      const mockDb = makeFirestore({
        'users/driver-2': { role: 'driver' },
      });
      setupFirestoreSpy(mockDb);

      const res = await upsertDriverFleetAsset.run({
        auth: { uid: 'driver-2' },
        data: {
          assetType: 'vehicle',
          payload: {
            plate: 'CD5678',
            year: '2020',
            capacity: 'invalid',
          },
        },
      });

      expect(res.success).toBe(true);
      const vehicleDoc = mockDb._documents.get('driverFleets/driver-2/vehicles/veh_CD5678');
      expect(vehicleDoc.year).toBe(2020);
      expect(vehicleDoc.capacity).toBe(4);
    });

    test('7. Assistant: Throws invalid-argument if fullName or RUT are missing', async () => {
      const mockDb = makeFirestore({
        'users/driver-1': { role: 'driver' },
      });
      setupFirestoreSpy(mockDb);
      const auth = { uid: 'driver-1' };

      await expect(
        upsertDriverFleetAsset.run({
          auth,
          data: { assetType: 'assistant', payload: { fullName: '  ', rut: '12.345.678-9' } },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });

      await expect(
        upsertDriverFleetAsset.run({
          auth,
          data: { assetType: 'assistant', payload: { fullName: 'Jane Doe', rut: '  ' } },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('8. Assistant: Successfully creates/updates assistant asset with custom ID or generated ID', async () => {
      const mockDb = makeFirestore({
        'users/driver-1': { role: 'driver' },
      });
      setupFirestoreSpy(mockDb);

      const resAuto = await upsertDriverFleetAsset.run({
        auth: { uid: 'driver-1' },
        data: {
          assetType: 'assistant',
          payload: {
            fullName: 'Jane Doe',
            rut: '12.345.678-K',
            phone: '+56987654321',
          },
        },
      });

      expect(resAuto.success).toBe(true);
      expect(resAuto.assetType).toBe('assistant');
      expect(resAuto.assistantId).toBe('ast_12345678k');
      expect(resAuto.backgroundCheckStatus).toBe('PENDING');

      const assistantDoc = mockDb._documents.get('driverFleets/driver-1/assistants/ast_12345678k');
      expect(assistantDoc.fullName).toBe('Jane Doe');

      // Custom ID test
      const resCustom = await upsertDriverFleetAsset.run({
        auth: { uid: 'driver-1' },
        data: {
          assetType: 'assistant',
          payload: {
            fullName: 'Maria Perez',
            rut: '98.765.432-1',
            assistantId: 'custom_ast_id',
          },
        },
      });
      expect(resCustom.assistantId).toBe('custom_ast_id');
    });

    test('9. Rate limit enforcement (max 10 calls per 10 min window)', async () => {
      const mockDb = makeFirestore({
        'users/driver-1': { role: 'driver' },
      });
      setupFirestoreSpy(mockDb);

      const req = {
        auth: { uid: 'driver-1' },
        data: { assetType: 'vehicle', payload: { plate: 'RL1234' } },
      };

      for (let i = 0; i < 10; i++) {
        await upsertDriverFleetAsset.run(req);
      }

      await expect(upsertDriverFleetAsset.run(req)).rejects.toMatchObject({
        code: 'resource-exhausted',
      });
    });
  });

  describe('verifyDriverFleetAsset', () => {
    test('10. Throws unauthenticated if auth is missing', async () => {
      await expect(verifyDriverFleetAsset.run({})).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    test('11. Throws permission-denied if user is not admin or ops', async () => {
      const mockDb = makeFirestore({
        'users/driver-user': { role: 'driver' },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        verifyDriverFleetAsset.run({
          auth: { uid: 'driver-user' },
          data: {
            driverId: 'driver-target',
            assetType: 'vehicle',
            assetId: 'veh_123',
            decision: 'approve',
          },
        })
      ).rejects.toMatchObject({ code: 'permission-denied' });
    });

    test('12. Throws invalid-argument for bad driverId, assetId, assetType or decision', async () => {
      const mockDb = makeFirestore({
        'users/admin-1': { role: 'admin' },
      });
      setupFirestoreSpy(mockDb);
      const auth = { uid: 'admin-1' };

      await expect(
        verifyDriverFleetAsset.run({
          auth,
          data: { driverId: 'bad/id', assetType: 'vehicle', assetId: 'veh_1', decision: 'approve' },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });

      await expect(
        verifyDriverFleetAsset.run({
          auth,
          data: {
            driverId: 'drv1',
            assetType: 'invalid_type',
            assetId: 'veh_1',
            decision: 'approve',
          },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });

      await expect(
        verifyDriverFleetAsset.run({
          auth,
          data: { driverId: 'drv1', assetType: 'vehicle', assetId: 'veh_1', decision: 'unknown' },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('13. Throws not-found if vehicle or assistant document does not exist', async () => {
      const mockDb = makeFirestore({
        'users/admin-1': { role: 'admin' },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        verifyDriverFleetAsset.run({
          auth: { uid: 'admin-1' },
          data: {
            driverId: 'driver-target',
            assetType: 'vehicle',
            assetId: 'veh_missing',
            decision: 'approve',
          },
        })
      ).rejects.toMatchObject({ code: 'not-found' });
    });

    test('14. Admin/Ops approves or rejects vehicle asset', async () => {
      const mockDb = makeFirestore({
        'users/admin-1': { role: 'admin' },
        'driverFleets/driver-10/vehicles/veh_AB12': { status: 'PENDING', plate: 'AB12' },
      });
      setupFirestoreSpy(mockDb);

      const resApprove = await verifyDriverFleetAsset.run({
        auth: { uid: 'admin-1' },
        data: {
          driverId: 'driver-10',
          assetType: 'vehicle',
          assetId: 'veh_AB12',
          decision: 'approve',
        },
      });

      expect(resApprove.success).toBe(true);
      expect(resApprove.status).toBe('VERIFIED');

      const vehDoc = mockDb._documents.get('driverFleets/driver-10/vehicles/veh_AB12');
      expect(vehDoc.status).toBe('VERIFIED');
      expect(vehDoc.verifiedBy).toBe('admin-1');

      // Test reject decision
      const resReject = await verifyDriverFleetAsset.run({
        auth: { uid: 'admin-1' },
        data: {
          driverId: 'driver-10',
          assetType: 'vehicle',
          assetId: 'veh_AB12',
          decision: 'reject',
        },
      });

      expect(resReject.status).toBe('REJECTED');
    });

    test('15. Admin/Ops approves or rejects assistant asset', async () => {
      const mockDb = makeFirestore({
        'users/ops-1': { role: 'ops' },
        'driverFleets/driver-10/assistants/ast_jane': { backgroundCheckStatus: 'PENDING' },
      });
      setupFirestoreSpy(mockDb);

      const resApprove = await verifyDriverFleetAsset.run({
        auth: { uid: 'ops-1' },
        data: {
          driverId: 'driver-10',
          assetType: 'assistant',
          assetId: 'ast_jane',
          decision: 'approve',
        },
      });

      expect(resApprove.success).toBe(true);
      expect(resApprove.status).toBe('VERIFIED');

      const astDoc = mockDb._documents.get('driverFleets/driver-10/assistants/ast_jane');
      expect(astDoc.backgroundCheckStatus).toBe('VERIFIED');
      expect(astDoc.verifiedBy).toBe('ops-1');
    });
  });
});
