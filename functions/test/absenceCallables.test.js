'use strict';

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'test' });
}

const { reportAbsenceCallable } = require('../src/absenceCallables');

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
        ref: makeRef(path),
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
      return {
        docs,
        empty: docs.length === 0,
        forEach(callback) {
          docs.forEach(callback);
        },
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
            ref: makeRef(path),
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
  spy.Timestamp = {
    now: () => ({
      toMillis: () => Date.now(),
    }),
    fromMillis: (ms) => ({
      toMillis: () => ms,
    }),
  };
  return spy;
};

describe('absenceCallables Unit Tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('reportAbsenceCallable', () => {
    test('1. Throws unauthenticated if auth is missing', async () => {
      await expect(reportAbsenceCallable.run({})).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    test('2. Throws invalid-argument if matchId, passengerId, or date are invalid or missing', async () => {
      const mockDb = makeFirestore();
      setupFirestoreSpy(mockDb);
      const auth = { uid: 'parent-1' };

      await expect(
        reportAbsenceCallable.run({
          auth,
          data: { matchId: 'bad/id', passengerId: 'p1', date: '2026-11-24' },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });

      await expect(
        reportAbsenceCallable.run({
          auth,
          data: { matchId: 'm1', passengerId: 'bad/id', date: '2026-11-24' },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });

      await expect(
        reportAbsenceCallable.run({
          auth,
          data: { matchId: 'm1', passengerId: 'p1', date: '   ' },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('3. Throws not-found when match record does not exist', async () => {
      const mockDb = makeFirestore();
      setupFirestoreSpy(mockDb);

      await expect(
        reportAbsenceCallable.run({
          auth: { uid: 'parent-1' },
          data: { matchId: 'match-missing', passengerId: 'p1', date: '2026-11-24' },
        })
      ).rejects.toMatchObject({ code: 'not-found' });
    });

    test('4. Throws permission-denied if caller is not the assigned parent in match', async () => {
      const mockDb = makeFirestore({
        'matches/m1': {
          matchId: 'm1',
          parentId: 'parent-real',
          driverId: 'driver-1',
          passengerId: 'p1',
        },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        reportAbsenceCallable.run({
          auth: { uid: 'parent-other' },
          data: { matchId: 'm1', passengerId: 'p1', date: '2026-11-24' },
        })
      ).rejects.toMatchObject({ code: 'permission-denied' });
    });

    test('5. Throws failed-precondition if student has already boarded or started transit', async () => {
      const mockDb = makeFirestore({
        'matches/m1': {
          matchId: 'm1',
          parentId: 'parent-1',
          driverId: 'driver-1',
          passengerId: 'p1',
        },
        'passengerStates/m1_p1': { matchId: 'm1', passengerId: 'p1', state: 'BOARDING_CONFIRMED' },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        reportAbsenceCallable.run({
          auth: { uid: 'parent-1' },
          data: { matchId: 'm1', passengerId: 'p1', date: '2026-11-24' },
        })
      ).rejects.toMatchObject({ code: 'failed-precondition' });
    });

    test('6. Successfully registers absence, transitions state, auto-skips route stops and sends push notification', async () => {
      const mockDb = makeFirestore({
        'matches/m1': {
          matchId: 'm1',
          parentId: 'parent-1',
          driverId: 'driver-1',
          passengerId: 'p1',
        },
        'passengerStates/m1_p1': { matchId: 'm1', passengerId: 'p1', state: 'EXPECTED' },
        'users/driver-1': { role: 'driver', fcmToken: 'driver-push-token' },
        'routes/r1': {
          routeId: 'r1',
          driverId: 'driver-1',
          status: 'ACTIVE',
          stops: [
            {
              stopId: 'stop-1',
              passengerId: 'p1',
              status: 'PENDING',
              location: { latitude: -33.4, longitude: -70.6 },
            },
            {
              stopId: 'stop-2',
              passengerId: 'p2',
              status: 'PENDING',
              location: { latitude: -33.41, longitude: -70.61 },
            },
          ],
        },
      });
      setupFirestoreSpy(mockDb);

      const sendMessagingSpy = jest.fn().mockResolvedValue('msg-id-absence');
      jest.spyOn(admin, 'messaging').mockReturnValue({ send: sendMessagingSpy });

      const res = await reportAbsenceCallable.run({
        auth: { uid: 'parent-1' },
        data: { matchId: 'm1', passengerId: 'p1', date: '  2026-11-24  ' },
      });

      expect(res.success).toBe(true);
      expect(res.absenceId).toBe('abs_m1_p1_2026-11-24');
      expect(res.date).toBe('2026-11-24');

      // Verify absence record stored in subcollection
      const absenceDoc = mockDb._documents.get('matches/m1/absences/abs_m1_p1_2026-11-24');
      expect(absenceDoc).toBeDefined();
      expect(absenceDoc.parentId).toBe('parent-1');
      expect(absenceDoc.status).toBe('active');

      // Verify passengerState updated to ABSENT
      const stateDoc = mockDb._documents.get('passengerStates/m1_p1');
      expect(stateDoc.state).toBe('ABSENT');

      // Verify route stop auto-skipped
      const routeDoc = mockDb._documents.get('routes/r1');
      expect(routeDoc.stops[0].status).toBe('SKIPPED');
      expect(routeDoc.stops[0].skipReason).toBe('ABSENT');

      // Verify FCM push sent
      expect(sendMessagingSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'driver-push-token',
        })
      );
    });

    test('7. Resilience: succeeds even if route auto-skip or FCM push fail', async () => {
      const mockDb = makeFirestore({
        'matches/m1': {
          matchId: 'm1',
          parentId: 'parent-1',
          driverId: 'driver-1',
          passengerId: 'p1',
        },
        'users/driver-1': { role: 'driver', fcmToken: 'driver-push-token' },
      });
      setupFirestoreSpy(mockDb);

      jest.spyOn(admin, 'messaging').mockReturnValue({
        send: jest.fn().mockRejectedValue(new Error('FCM Network Error')),
      });

      const res = await reportAbsenceCallable.run({
        auth: { uid: 'parent-1' },
        data: { matchId: 'm1', passengerId: 'p1', date: '2026-11-24' },
      });

      expect(res.success).toBe(true);
      expect(res.absenceId).toBe('abs_m1_p1_2026-11-24');
    });

    test('8. Propagates idempotencyKey and responds idempotently on duplicate retry', async () => {
      const mockDb = makeFirestore({
        'matches/m1': {
          matchId: 'm1',
          parentId: 'parent-1',
          driverId: 'driver-1',
          passengerId: 'p1',
        },
        'passengerStates/m1_p1': {
          matchId: 'm1',
          passengerId: 'p1',
          state: 'ABSENT',
          lastIdempotencyKey: 'm1_p1_2026-11-24_ABSENCE_2026-11-24',
        },
      });
      setupFirestoreSpy(mockDb);

      const res = await reportAbsenceCallable.run({
        auth: { uid: 'parent-1' },
        data: {
          matchId: 'm1',
          passengerId: 'p1',
          date: '2026-11-24',
          idempotencyKey: 'm1_p1_2026-11-24_ABSENCE_2026-11-24',
        },
      });

      expect(res.success).toBe(true);
      expect(res.idempotent).toBe(true);
    });
  });
});
