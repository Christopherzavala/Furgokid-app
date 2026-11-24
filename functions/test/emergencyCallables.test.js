'use strict';

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'test' });
}

const { triggerSosAlert, resolveSosAlert } = require('../src/emergencyCallables');

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
          if (ref && typeof ref.get === 'function') {
            return ref.get();
          }
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

describe('emergencyCallables Unit Tests', () => {
  const baseMatch = {
    matchId: 'match-100',
    driverId: 'driver-100',
    parentId: 'parent-100',
    status: 'active',
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('triggerSosAlert', () => {
    test('1. Throws unauthenticated if auth is missing', async () => {
      await expect(triggerSosAlert.run({})).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    test('2. Throws invalid-argument if matchId is missing or invalid', async () => {
      const mockDb = makeFirestore({});
      setupFirestoreSpy(mockDb);
      const auth = { uid: 'driver-100' };

      await expect(triggerSosAlert.run({ auth, data: {} })).rejects.toMatchObject({
        code: 'invalid-argument',
      });

      await expect(
        triggerSosAlert.run({ auth, data: { matchId: 'bad/id' } })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('3. Enforces rate limit (max 3 calls per 15 min window)', async () => {
      const mockDb = makeFirestore({
        'matches/match-100': baseMatch,
      });
      setupFirestoreSpy(mockDb);

      const auth = { uid: 'driver-100' };
      const req = { auth, data: { matchId: 'match-100' } };

      await triggerSosAlert.run(req);
      await triggerSosAlert.run(req);
      await triggerSosAlert.run(req);

      await expect(triggerSosAlert.run(req)).rejects.toMatchObject({
        code: 'resource-exhausted',
      });
    });

    test('4. Throws not-found when match record does not exist', async () => {
      const mockDb = makeFirestore({});
      setupFirestoreSpy(mockDb);

      await expect(
        triggerSosAlert.run({
          auth: { uid: 'driver-100' },
          data: { matchId: 'match-missing' },
        })
      ).rejects.toMatchObject({ code: 'not-found' });
    });

    test('5. Throws permission-denied when caller is neither driver nor parent in match', async () => {
      const mockDb = makeFirestore({
        'matches/match-100': baseMatch,
      });
      setupFirestoreSpy(mockDb);

      await expect(
        triggerSosAlert.run({
          auth: { uid: 'unauthorized-user' },
          data: { matchId: 'match-100' },
        })
      ).rejects.toMatchObject({ code: 'permission-denied' });
    });

    test('6. Successfully triggers SOS alert as driver, updating match and sending push to recipients', async () => {
      const mockDb = makeFirestore({
        'matches/match-100': baseMatch,
        'users/parent-100': { role: 'parent', pushToken: 'parent-push-token' },
        'users/ops-1': { role: 'ops', fcmToken: 'ops-fcm-token' },
      });
      setupFirestoreSpy(mockDb);

      const sendMessagingSpy = jest.fn().mockResolvedValue('msg-id-1');
      jest.spyOn(admin, 'messaging').mockReturnValue({ send: sendMessagingSpy });

      const res = await triggerSosAlert.run({
        auth: { uid: 'driver-100' },
        data: {
          matchId: 'match-100',
          location: { latitude: -33.45, longitude: -70.66 },
          reason: '  Vehicle breakdown  ',
        },
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('ACTIVE');
      expect(res.incidentId).toBeDefined();

      const incidentDoc = mockDb._documents.get(`emergencyIncidents/${res.incidentId}`);
      expect(incidentDoc).toBeDefined();
      expect(incidentDoc.triggeredBy).toBe('driver-100');
      expect(incidentDoc.role).toBe('driver');
      expect(incidentDoc.reason).toBe('Vehicle breakdown');
      expect(incidentDoc.status).toBe('ACTIVE');

      const updatedMatch = mockDb._documents.get('matches/match-100');
      expect(updatedMatch.emergencyActive).toBe(true);
      expect(updatedMatch.activeIncidentId).toBe(res.incidentId);

      expect(sendMessagingSpy).toHaveBeenCalled();
    });

    test('7. Successfully triggers SOS alert as parent with default reason fallback', async () => {
      const mockDb = makeFirestore({
        'matches/match-100': baseMatch,
        'users/driver-100': { role: 'driver', fcmToken: 'driver-fcm-token' },
      });
      setupFirestoreSpy(mockDb);

      const sendMessagingSpy = jest.fn().mockResolvedValue('msg-id-2');
      jest.spyOn(admin, 'messaging').mockReturnValue({ send: sendMessagingSpy });

      const res = await triggerSosAlert.run({
        auth: { uid: 'parent-100' },
        data: { matchId: 'match-100' },
      });

      expect(res.success).toBe(true);
      const incidentDoc = mockDb._documents.get(`emergencyIncidents/${res.incidentId}`);
      expect(incidentDoc.role).toBe('parent');
      expect(incidentDoc.reason).toBe('Emergencia en ruta');
    });

    test('8. Resilience: succeeds even if querying admin users or sending push fails', async () => {
      const mockDb = makeFirestore({
        'matches/match-100': baseMatch,
        'users/parent-100': { role: 'parent', pushToken: 'parent-push-token' },
      });
      setupFirestoreSpy(mockDb);

      // Force failure on messaging send
      jest.spyOn(admin, 'messaging').mockReturnValue({
        send: jest.fn().mockRejectedValue(new Error('FCM Push Error')),
      });

      const res = await triggerSosAlert.run({
        auth: { uid: 'driver-100' },
        data: { matchId: 'match-100' },
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('ACTIVE');
    });
  });

  describe('resolveSosAlert', () => {
    const activeIncident = {
      incidentId: 'inc-100',
      matchId: 'match-100',
      triggeredBy: 'driver-100',
      role: 'driver',
      status: 'ACTIVE',
    };

    test('9. Throws unauthenticated if auth is missing', async () => {
      await expect(resolveSosAlert.run({})).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    test('10. Throws invalid-argument if incidentId is missing or invalid', async () => {
      const mockDb = makeFirestore({});
      setupFirestoreSpy(mockDb);
      const auth = { uid: 'driver-100' };

      await expect(resolveSosAlert.run({ auth, data: {} })).rejects.toMatchObject({
        code: 'invalid-argument',
      });

      await expect(
        resolveSosAlert.run({ auth, data: { incidentId: 'bad/id' } })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('11. Throws not-found when incident record does not exist', async () => {
      const mockDb = makeFirestore({});
      setupFirestoreSpy(mockDb);

      await expect(
        resolveSosAlert.run({
          auth: { uid: 'driver-100' },
          data: { incidentId: 'inc-missing' },
        })
      ).rejects.toMatchObject({ code: 'not-found' });
    });

    test('12. Throws permission-denied when caller is neither participant nor admin/ops', async () => {
      const mockDb = makeFirestore({
        'emergencyIncidents/inc-100': activeIncident,
        'matches/match-100': baseMatch,
        'users/foreign-user': { role: 'parent' },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        resolveSosAlert.run({
          auth: { uid: 'foreign-user' },
          data: { incidentId: 'inc-100' },
        })
      ).rejects.toMatchObject({ code: 'permission-denied' });
    });

    test('13. Allows match participant (parent or driver) to resolve SOS alert', async () => {
      const mockDb = makeFirestore({
        'emergencyIncidents/inc-100': activeIncident,
        'matches/match-100': { ...baseMatch, emergencyActive: true, activeIncidentId: 'inc-100' },
        'users/driver-100': { role: 'driver' },
      });
      setupFirestoreSpy(mockDb);

      const res = await resolveSosAlert.run({
        auth: { uid: 'driver-100' },
        data: { incidentId: 'inc-100', resolutionNotes: '  Resolved by driver  ' },
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('RESOLVED');

      const incidentDoc = mockDb._documents.get('emergencyIncidents/inc-100');
      expect(incidentDoc.status).toBe('RESOLVED');
      expect(incidentDoc.resolvedBy).toBe('driver-100');
      expect(incidentDoc.resolutionNotes).toBe('Resolved by driver');

      const updatedMatch = mockDb._documents.get('matches/match-100');
      expect(updatedMatch.emergencyActive).toBe(false);
      expect(updatedMatch.activeIncidentId).toBeNull();
    });

    test('14. Allows ops / admin user to resolve SOS alert', async () => {
      const mockDb = makeFirestore({
        'emergencyIncidents/inc-100': activeIncident,
        'matches/match-100': { ...baseMatch, emergencyActive: true, activeIncidentId: 'inc-100' },
        'users/admin-1': { role: 'admin' },
      });
      setupFirestoreSpy(mockDb);

      const res = await resolveSosAlert.run({
        auth: { uid: 'admin-1' },
        data: { incidentId: 'inc-100' },
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe('RESOLVED');

      const incidentDoc = mockDb._documents.get('emergencyIncidents/inc-100');
      expect(incidentDoc.status).toBe('RESOLVED');
      expect(incidentDoc.resolvedBy).toBe('admin-1');
      expect(incidentDoc.resolutionNotes).toBe('');
    });
  });
});
