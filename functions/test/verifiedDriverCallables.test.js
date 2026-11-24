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

  const makeCollection = (path) => ({
    path,
    doc(id) {
      const resolvedId = id || `auto_inc_${++autoIdCounter}`;
      return makeRef(`${path}/${resolvedId}`);
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

    test('4. Successfully submits verification documents', async () => {
      const mockDb = makeFirestore({
        'users/driver-1': { role: 'driver', verifiedChecks: {} },
      });
      setupFirestoreSpy(mockDb);

      const res = await submitDriverVerificationDocs.run({
        auth: { uid: 'driver-1' },
        data: {
          documents: {
            professionalLicense: { path: 'lic.pdf' },
            criminalRecord: { path: 'crim.pdf' },
            childInabilityRegistry: { path: 'inab.pdf' },
          },
        },
      });

      expect(res.success).toBe(true);
      expect(res.driverVerificationStatus).toBe('pending_review');
      const driverDoc = mockDb._documents.get('users/driver-1');
      expect(driverDoc.verifiedChecks.professionalLicense.status).toBe('pending_review');
    });
  });

  describe('assignVerifiedVehicleDriver', () => {
    test('5. Throws unauthenticated if auth is missing', async () => {
      await expect(assignVerifiedVehicleDriver.run({})).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    test('6. Throws invalid-argument for bad parameters or assignmentType', async () => {
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

    test('7. Throws not-found if driver or match does not exist', async () => {
      const mockDb = makeFirestore({
        'users/owner-1': { role: 'driver' },
        'driverFleets/owner-1/vehicles/veh_1': { vehicleId: 'veh_1', plate: 'ABC' },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        assignVerifiedVehicleDriver.run({
          auth: { uid: 'owner-1' },
          data: {
            vehicleId: 'veh_1',
            matchId: 'match-missing',
            driverUid: 'driver-target',
            assignmentType: 'rental',
          },
        })
      ).rejects.toMatchObject({ code: 'not-found' });
    });

    test('8. Throws failed-precondition if driver is not approved or lacks verified checks', async () => {
      const mockDb = makeFirestore({
        'users/owner-1': { role: 'driver' },
        'driverFleets/owner-1/vehicles/veh_1': { vehicleId: 'veh_1', plate: 'ABC' },
        'users/driver-unverified': { role: 'driver', approved: true, verifiedChecks: {} },
        'matches/m1': { matchId: 'm1', parentId: 'parent-1' },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        assignVerifiedVehicleDriver.run({
          auth: { uid: 'owner-1' },
          data: {
            vehicleId: 'veh_1',
            matchId: 'm1',
            driverUid: 'driver-unverified',
            assignmentType: 'rental',
          },
        })
      ).rejects.toMatchObject({ code: 'failed-precondition' });
    });

    test('9. Successfully assigns verified driver and notifies parent', async () => {
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
        'matches/m1': { matchId: 'm1', parentId: 'parent-1' },
        'users/parent-1': { fcmToken: 'parent-token' },
      });
      setupFirestoreSpy(mockDb);

      const sendMessagingSpy = jest.fn().mockResolvedValue('msg-id-driver-assign');
      jest.spyOn(admin, 'messaging').mockReturnValue({ send: sendMessagingSpy });

      const res = await assignVerifiedVehicleDriver.run({
        auth: { uid: 'owner-1' },
        data: {
          vehicleId: 'veh_1',
          matchId: 'm1',
          driverUid: 'driver-verified',
          assignmentType: 'substitute',
          validUntil: '2026-12-31',
        },
      });

      expect(res.success).toBe(true);
      expect(res.driverUid).toBe('driver-verified');
      expect(res.assignmentType).toBe('substitute');

      const matchDoc = mockDb._documents.get('matches/m1');
      expect(matchDoc.activeDriverId).toBe('driver-verified');
      expect(matchDoc.activeDriverSnapshot.plate).toBe('ABCD12');
    });
  });
});
