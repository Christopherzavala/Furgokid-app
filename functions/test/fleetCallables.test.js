'use strict';

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'test' });
}

const { upsertDriverFleetAsset, verifyDriverFleetAsset } = require('../src/fleetCallables');

const makeFirestore = (initial = {}) => {
  const documents = new Map(Object.entries(initial));

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

  const makeCollection = (path) => ({
    path,
    doc(id) {
      return makeRef(`${path}/${id}`);
    },
    where(field, op, value) {
      const filters = [[field, op, value]];
      const builder = {
        where(sF, sOp, sVal) {
          filters.push([sF, sOp, sVal]);
          return builder;
        },
        async get() {
          const matchedDocs = [];
          for (const [docPath, data] of documents.entries()) {
            if (!docPath.startsWith(`${path}/`)) continue;
            const matches = filters.every(([f, _op, v]) => data[f] === v);
            if (matches) {
              matchedDocs.push({
                id: docPath.split('/').pop(),
                ref: makeRef(docPath),
                data: () => ({ ...data }),
              });
            }
          }
          return { docs: matchedDocs, empty: matchedDocs.length === 0 };
        },
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
          };
        },
        set(ref, data, options) {
          const path = ref.path || ref;
          const existing = documents.get(path);
          documents.set(path, options?.merge && existing ? { ...existing, ...data } : data);
        },
        update(ref, data) {
          const path = ref.path || ref;
          const existing = documents.get(path);
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

    test('2. Throws permission-denied if user profile is missing or is not driver', async () => {
      const mockDb = makeFirestore({
        'users/user-parent': { role: 'parent' },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        upsertDriverFleetAsset.run({
          auth: { uid: 'user-parent' },
          data: { assetType: 'vehicle', payload: { plate: 'ABCD12' } },
        })
      ).rejects.toMatchObject({ code: 'permission-denied' });
    });

    test('3. Throws invalid-argument for invalid assetType or payload', async () => {
      const mockDb = makeFirestore({
        'users/driver-1': { role: 'driver' },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        upsertDriverFleetAsset.run({
          auth: { uid: 'driver-1' },
          data: { assetType: 'invalid_type', payload: {} },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });

      await expect(
        upsertDriverFleetAsset.run({
          auth: { uid: 'driver-1' },
          data: { assetType: 'vehicle', payload: 'not-an-object' },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('4. Throws invalid-argument when vehicle plate is missing or invalid', async () => {
      const mockDb = makeFirestore({
        'users/driver-1': { role: 'driver' },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        upsertDriverFleetAsset.run({
          auth: { uid: 'driver-1' },
          data: { assetType: 'vehicle', payload: { plate: '   ' } },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('5. Successfully upserts vehicle asset with fallback defaults', async () => {
      const mockDb = makeFirestore({
        'users/driver-1': { role: 'driver' },
      });
      setupFirestoreSpy(mockDb);

      const res = await upsertDriverFleetAsset.run({
        auth: { uid: 'driver-1' },
        data: {
          assetType: 'vehicle',
          payload: {
            plate: '  CL-99-99 ',
            brand: '  Toyota ',
            model: ' HiAce ',
            year: 2022,
            capacity: 12,
          },
        },
      });

      expect(res.success).toBe(true);
      expect(res.assetType).toBe('vehicle');
      expect(res.vehicleId).toBe('veh_CL9999');

      const savedDoc = mockDb._documents.get('driverFleets/driver-1/vehicles/veh_CL9999');
      expect(savedDoc).toBeDefined();
      expect(savedDoc.plate).toBe('CL-99-99');
      expect(savedDoc.brand).toBe('Toyota');
      expect(savedDoc.model).toBe('HiAce');
      expect(savedDoc.capacity).toBe(12);
      expect(savedDoc.status).toBe('PENDING');
    });

    test('6. Throws invalid-argument when assistant fullName or rut is missing', async () => {
      const mockDb = makeFirestore({
        'users/driver-1': { role: 'driver' },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        upsertDriverFleetAsset.run({
          auth: { uid: 'driver-1' },
          data: { assetType: 'assistant', payload: { fullName: '', rut: '12345678-9' } },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });

      await expect(
        upsertDriverFleetAsset.run({
          auth: { uid: 'driver-1' },
          data: { assetType: 'assistant', payload: { fullName: 'Juan Perez', rut: '  ' } },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('7. Successfully upserts assistant asset with custom or generated ID', async () => {
      const mockDb = makeFirestore({
        'users/driver-1': { role: 'driver' },
      });
      setupFirestoreSpy(mockDb);

      const res = await upsertDriverFleetAsset.run({
        auth: { uid: 'driver-1' },
        data: {
          assetType: 'assistant',
          payload: {
            fullName: '  María González  ',
            rut: ' 12.345.678-9 ',
            phone: ' +56912345678 ',
            assistantId: 'ast_custom_1',
          },
        },
      });

      expect(res.success).toBe(true);
      expect(res.assetType).toBe('assistant');
      expect(res.assistantId).toBe('ast_custom_1');

      const savedDoc = mockDb._documents.get('driverFleets/driver-1/assistants/ast_custom_1');
      expect(savedDoc).toBeDefined();
      expect(savedDoc.fullName).toBe('María González');
      expect(savedDoc.rut).toBe('12.345.678-9');
      expect(savedDoc.backgroundCheckStatus).toBe('PENDING');
    });
  });

  describe('verifyDriverFleetAsset', () => {
    test('8. Throws unauthenticated / permission-denied for non-admin/ops users', async () => {
      const mockDb = makeFirestore({
        'users/driver-1': { role: 'driver' },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        verifyDriverFleetAsset.run({
          auth: { uid: 'driver-1' },
          data: {
            driverId: 'driver-1',
            assetType: 'vehicle',
            assetId: 'veh_1',
            decision: 'approve',
          },
        })
      ).rejects.toMatchObject({ code: 'permission-denied' });
    });

    test('9. Throws invalid-argument for malformed inputs or invalid decision', async () => {
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
            driverId: 'driver-1',
            assetType: 'unknown',
            assetId: 'veh_1',
            decision: 'approve',
          },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });

      await expect(
        verifyDriverFleetAsset.run({
          auth,
          data: {
            driverId: 'driver-1',
            assetType: 'vehicle',
            assetId: 'veh_1',
            decision: 'invalid',
          },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('10. Throws not-found when target vehicle or assistant record does not exist', async () => {
      const mockDb = makeFirestore({
        'users/admin-1': { role: 'admin' },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        verifyDriverFleetAsset.run({
          auth: { uid: 'admin-1' },
          data: {
            driverId: 'driver-1',
            assetType: 'vehicle',
            assetId: 'veh_missing',
            decision: 'approve',
          },
        })
      ).rejects.toMatchObject({ code: 'not-found' });
    });

    test('11. Successfully approves vehicle asset as admin/ops', async () => {
      const mockDb = makeFirestore({
        'users/admin-1': { role: 'admin' },
        'driverFleets/driver-1/vehicles/veh_CL9999': {
          vehicleId: 'veh_CL9999',
          driverId: 'driver-1',
          status: 'PENDING',
        },
      });
      setupFirestoreSpy(mockDb);

      const res = await verifyDriverFleetAsset.run({
        auth: { uid: 'admin-1' },
        data: {
          driverId: 'driver-1',
          assetType: 'vehicle',
          assetId: 'veh_CL9999',
          decision: 'approve',
        },
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('VERIFIED');

      const updatedDoc = mockDb._documents.get('driverFleets/driver-1/vehicles/veh_CL9999');
      expect(updatedDoc.status).toBe('VERIFIED');
      expect(updatedDoc.verifiedBy).toBe('admin-1');
    });

    test('12. Successfully rejects assistant asset as ops user', async () => {
      const mockDb = makeFirestore({
        'users/ops-1': { role: 'ops' },
        'driverFleets/driver-1/assistants/ast_1': {
          assistantId: 'ast_1',
          driverId: 'driver-1',
          backgroundCheckStatus: 'PENDING',
        },
      });
      setupFirestoreSpy(mockDb);

      const res = await verifyDriverFleetAsset.run({
        auth: { uid: 'ops-1' },
        data: {
          driverId: 'driver-1',
          assetType: 'assistant',
          assetId: 'ast_1',
          decision: 'reject',
        },
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('REJECTED');

      const updatedDoc = mockDb._documents.get('driverFleets/driver-1/assistants/ast_1');
      expect(updatedDoc.backgroundCheckStatus).toBe('REJECTED');
      expect(updatedDoc.verifiedBy).toBe('ops-1');
    });
  });
});
