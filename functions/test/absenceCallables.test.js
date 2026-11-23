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
      const resolvedId = id || `auto_${++autoIdCounter}`;
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
        async getAll(...refs) {
          return Promise.all(
            refs.map(async (ref) => {
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
            })
          );
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

describe('absenceCallables Unit Tests', () => {
  const baseMatch = {
    matchId: 'match-1',
    parentId: 'parent-1',
    driverId: 'driver-1',
    passengerIds: ['pass-1'],
    status: 'active',
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('1. Throws unauthenticated if auth is missing', async () => {
    await expect(reportAbsenceCallable.run({})).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  test('2. Throws invalid-argument for missing or malformed inputs', async () => {
    const auth = { uid: 'parent-1' };

    await expect(
      reportAbsenceCallable.run({
        auth,
        data: { matchId: '', passengerId: 'pass-1', date: '2026-11-24' },
      })
    ).rejects.toMatchObject({ code: 'invalid-argument' });

    await expect(
      reportAbsenceCallable.run({
        auth,
        data: { matchId: 'match-1', passengerId: '', date: '2026-11-24' },
      })
    ).rejects.toMatchObject({ code: 'invalid-argument' });

    await expect(
      reportAbsenceCallable.run({
        auth,
        data: { matchId: 'match-1', passengerId: 'pass-1', date: '  ' },
      })
    ).rejects.toMatchObject({ code: 'invalid-argument' });

    await expect(
      reportAbsenceCallable.run({
        auth,
        data: { matchId: 'bad/id', passengerId: 'pass-1', date: '2026-11-24' },
      })
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('3. Throws not-found when match does not exist', async () => {
    const mockDb = makeFirestore({});
    setupFirestoreSpy(mockDb);

    await expect(
      reportAbsenceCallable.run({
        auth: { uid: 'parent-1' },
        data: { matchId: 'match-missing', passengerId: 'pass-1', date: '2026-11-24' },
      })
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  test('4. Throws permission-denied when caller is not the match parent', async () => {
    const mockDb = makeFirestore({
      'matches/match-1': baseMatch,
    });
    setupFirestoreSpy(mockDb);

    await expect(
      reportAbsenceCallable.run({
        auth: { uid: 'other-parent' },
        data: { matchId: 'match-1', passengerId: 'pass-1', date: '2026-11-24' },
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  test('5. Throws failed-precondition if student has already boarded or started transit', async () => {
    const mockDb = makeFirestore({
      'matches/match-1': baseMatch,
      'passengerStates/match-1_pass-1': { state: 'BOARDING_CONFIRMED' },
    });
    setupFirestoreSpy(mockDb);

    await expect(
      reportAbsenceCallable.run({
        auth: { uid: 'parent-1' },
        data: { matchId: 'match-1', passengerId: 'pass-1', date: '2026-11-24' },
      })
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  test('6. Successfully processes absence, auto-skips route stops, and sends driver push notification', async () => {
    const mockDb = makeFirestore({
      'matches/match-1': baseMatch,
      'passengerStates/match-1_pass-1': { state: 'EXPECTED' },
      'users/driver-1': { role: 'driver', fcmToken: 'driver-fcm-token' },
      'routes/route-1': {
        driverId: 'driver-1',
        status: 'ACTIVE',
        stops: [
          {
            stopId: 'stop-1',
            passengerId: 'pass-1',
            status: 'PENDING',
            order: 1,
            location: { latitude: -33.4, longitude: -70.6 },
          },
          {
            stopId: 'stop-2',
            passengerId: 'pass-2',
            status: 'PENDING',
            order: 2,
            location: { latitude: -33.5, longitude: -70.7 },
          },
        ],
      },
    });

    const sendMessagingSpy = jest.fn().mockResolvedValue('msg-id-123');
    setupFirestoreSpy(mockDb);
    jest.spyOn(admin, 'messaging').mockReturnValue({ send: sendMessagingSpy });

    const result = await reportAbsenceCallable.run({
      auth: { uid: 'parent-1' },
      data: { matchId: 'match-1', passengerId: 'pass-1', date: '2026-11-24' },
    });

    expect(result.success).toBe(true);
    expect(result.absenceId).toBe('abs_match-1_pass-1_2026-11-24');
    expect(sendMessagingSpy).toHaveBeenCalledWith({
      token: 'driver-fcm-token',
      notification: {
        title: '⚠️ Aviso de ausencia escolar',
        body: 'El pasajero no viajará el día 2026-11-24. Parada omitida.',
      },
      data: { matchId: 'match-1', passengerId: 'pass-1', type: 'STUDENT_ABSENCE' },
    });

    const updatedRoute = mockDb._documents.get('routes/route-1');
    expect(updatedRoute.stops[0].status).toBe('SKIPPED');
    expect(updatedRoute.stops[0].skipReason).toBe('ABSENT');
  });

  test('7. Resilience: succeeds even if FCM notification fails or route updates encounter errors', async () => {
    const mockDb = makeFirestore({
      'matches/match-1': baseMatch,
      'users/driver-1': { role: 'driver', fcmToken: 'driver-fcm-token' },
    });

    const sendMessagingSpy = jest.fn().mockRejectedValue(new Error('FCM Network Failure'));
    setupFirestoreSpy(mockDb);
    jest.spyOn(admin, 'messaging').mockReturnValue({ send: sendMessagingSpy });

    const result = await reportAbsenceCallable.run({
      auth: { uid: 'parent-1' },
      data: { matchId: 'match-1', passengerId: 'pass-1', date: '2026-11-24' },
    });

    expect(result.success).toBe(true);
  });
});
