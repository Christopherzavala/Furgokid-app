'use strict';

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'test' });
}

const {
  submitDriverVerificationDocs,
  assignVerifiedVehicleDriver,
} = require('../src/verifiedDriverCallables');

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
        id: path.split('/').pop(),
        data: () => (data ? { ...data } : null),
        get: (field) => data?.[field],
      };
    },
    async set(data, options) {
      const existing = documents.get(path);
      documents.set(path, options?.merge && existing ? { ...existing, ...data } : data);
    },
    async update(data) {
      const existing = documents.get(path) || {};
      documents.set(path, { ...existing, ...data });
    },
  });

  const makeCollection = (path) => {
    const createQuery = (filters = [], limitCount = 500) => ({
      limit(count) {
        return createQuery(filters, count);
      },
      async get() {
        const docs = [];
        for (const [docPath, data] of documents.entries()) {
          if (!docPath.startsWith(`${path}/`) || docPath.slice(path.length + 1).includes('/')) {
            continue;
          }
          docs.push({
            id: docPath.split('/').pop(),
            ref: makeRef(docPath),
            data: () => (data ? { ...data } : null),
          });
          if (docs.length >= limitCount) break;
        }
        return { docs, empty: docs.length === 0 };
      },
    });

    return {
      path,
      doc(id) {
        const resolvedId = id || `auto_inc_${++autoIdCounter}`;
        return makeRef(`${path}/${resolvedId}`);
      },
      collection(sub) {
        return makeCollection(`${path}/${sub}`);
      },
      limit(count) {
        return createQuery([], count);
      },
      get: () => createQuery([]).get(),
    };
  };

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
            id: path.split('/').pop(),
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

describe('verifiedDriverCallables Unit Tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('submitDriverVerificationDocs', () => {
    test('1. Throws unauthenticated if auth is missing', async () => {
      await expect(submitDriverVerificationDocs.run({})).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    test('2. Throws invalid-argument if documents object is missing', async () => {
      const mockDb = makeFirestore({ 'users/driver-1': { role: 'driver' } });
      setupFirestoreSpy(mockDb);

      await expect(
        submitDriverVerificationDocs.run({
          auth: { uid: 'driver-1' },
          data: { documents: null },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('3. Throws not-found if driver user record does not exist', async () => {
      const mockDb = makeFirestore();
      setupFirestoreSpy(mockDb);

      await expect(
        submitDriverVerificationDocs.run({
          auth: { uid: 'driver-1' },
          data: { documents: { professionalLicense: { path: 'lic.pdf' } } },
        })
      ).rejects.toMatchObject({ code: 'not-found' });
    });

    test('4. Throws permission-denied if non-admin non-fleet-owner submits for another driver', async () => {
      const mockDb = makeFirestore({
        'users/parent-1': { role: 'parent' },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        submitDriverVerificationDocs.run({
          auth: { uid: 'parent-1' },
          data: {
            targetDriverUid: 'driver-2',
            documents: { professionalLicense: { path: 'lic.pdf' } },
          },
        })
      ).rejects.toMatchObject({ code: 'permission-denied' });
    });

    test('5. Successfully submits verification documents for fleet owner and self', async () => {
      const mockDb = makeFirestore({
        'users/owner-1': { role: 'driver' },
        'driverFleets/owner-1/vehicles/veh_1': { plate: 'XYZ' },
        'users/driver-target': { role: 'driver', verifiedChecks: {} },
      });
      setupFirestoreSpy(mockDb);

      const res = await submitDriverVerificationDocs.run({
        auth: { uid: 'owner-1' },
        data: {
          targetDriverUid: 'driver-target',
          documents: {
            professionalLicense: { path: 'lic.pdf' },
            criminalRecord: { path: 'crim.pdf' },
            childInabilityRegistry: { path: 'inab.pdf' },
          },
        },
      });

      expect(res.success).toBe(true);
      expect(res.driverVerificationStatus).toBe('pending_review');
      expect(
        mockDb._documents.get('driverFleets/owner-1/authorizedDrivers/driver-target')
      ).toMatchObject({
        driverUid: 'driver-target',
        authorizedBy: 'owner-1',
      });
    });
  });

  describe('assignVerifiedVehicleDriver', () => {
    test('6. Throws unauthenticated if auth is missing', async () => {
      await expect(assignVerifiedVehicleDriver.run({})).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    test('7. Throws invalid-argument for bad parameters or assignmentType', async () => {
      const mockDb = makeFirestore();
      setupFirestoreSpy(mockDb);

      await expect(
        assignVerifiedVehicleDriver.run({
          auth: { uid: 'owner-1' },
          data: { vehicleId: 'bad/id', matchId: 'm1', driverUid: 'd1', assignmentType: 'rental' },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });

      await expect(
        assignVerifiedVehicleDriver.run({
          auth: { uid: 'owner-1' },
          data: {
            vehicleId: 'veh_1',
            matchId: 'm1',
            driverUid: 'd1',
            assignmentType: 'invalid_type',
          },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('8. Throws permission-denied if non-owner non-admin attempts assignment', async () => {
      const mockDb = makeFirestore({
        'users/stranger-1': { role: 'driver' },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        assignVerifiedVehicleDriver.run({
          auth: { uid: 'stranger-1' },
          data: {
            vehicleId: 'veh_1',
            matchId: 'm1',
            driverUid: 'driver-target',
            assignmentType: 'rental',
          },
        })
      ).rejects.toMatchObject({ code: 'permission-denied' });
    });

    test('9. Throws failed-precondition if validUntil or verifiedChecks are expired', async () => {
      const mockDb = makeFirestore({
        'users/owner-1': { role: 'driver' },
        'driverFleets/owner-1/vehicles/veh_1': { vehicleId: 'veh_1', plate: 'ABC' },
        'users/driver-expired': {
          role: 'driver',
          approved: true,
          verifiedChecks: {
            professionalLicense: { status: 'verified', expiresAt: '2020-01-01' },
            criminalRecord: { status: 'verified' },
            childInabilityRegistry: { status: 'verified' },
          },
        },
        'matches/m1': { matchId: 'm1', parentId: 'parent-1' },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        assignVerifiedVehicleDriver.run({
          auth: { uid: 'owner-1' },
          data: {
            vehicleId: 'veh_1',
            matchId: 'm1',
            driverUid: 'driver-expired',
            assignmentType: 'rental',
            validUntil: '2020-01-01',
          },
        })
      ).rejects.toMatchObject({ code: 'failed-precondition' });
    });

    test('10. Successfully assigns verified driver without failing if parent has no token', async () => {
      const mockDb = makeFirestore({
        'users/owner-1': { role: 'driver' },
        'driverFleets/owner-1/vehicles/veh_1': { vehicleId: 'veh_1', plate: 'ABCD12' },
        'users/driver-verified': {
          role: 'driver',
          approved: true,
          displayName: 'Conductor Pro',
          verifiedChecks: {
            professionalLicense: { status: 'verified' },
            criminalRecord: { status: 'verified' },
            childInabilityRegistry: { status: 'verified' },
          },
        },
        'matches/m1': { matchId: 'm1', parentId: 'parent-notoken' },
        'users/parent-notoken': { role: 'parent' },
      });
      setupFirestoreSpy(mockDb);

      const res = await assignVerifiedVehicleDriver.run({
        auth: { uid: 'owner-1' },
        data: {
          vehicleId: 'veh_1',
          matchId: 'm1',
          driverUid: 'driver-verified',
          assignmentType: 'rental',
        },
      });

      expect(res.success).toBe(true);
      expect(res.driverUid).toBe('driver-verified');
      expect(
        mockDb._documents.get('driverFleets/owner-1/authorizedDrivers/driver-verified')
      ).toMatchObject({
        driverUid: 'driver-verified',
        authorizedBy: 'owner-1',
      });
    });
  });
});
