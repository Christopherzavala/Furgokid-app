/**
 * Unit tests for Custody Chain, State Machine & OTP Handover
 */

const {
  updatePassengerStateCallable,
  generateHandoverOtp,
  confirmStudentHandover,
} = require('../src/custodyChain');

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
        data: () => data,
        get: (field) => data?.[field],
      };
    },
    async update(data) {
      const existing = documents.get(path) || {};
      documents.set(path, { ...existing, ...data });
    },
    async set(data) {
      documents.set(path, data);
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
        limit(limitCount) {
          return makeQuery(path, filters, limitCount);
        },
        get: () => makeQuery(path, filters).get(),
      };
      return builder;
    },
    async add(data) {
      const id = `doc_${Date.now()}`;
      documents.set(`${path}/${id}`, data);
      return { id };
    },
  });

  const makeQuery = (path, filters, limit = Infinity) => ({
    async get() {
      const docs = [];
      for (const [docPath, data] of documents.entries()) {
        if (!docPath.startsWith(`${path}/`) || docPath.slice(path.length + 1).includes('/'))
          continue;
        const matches = filters.every(([field, op, expected]) => {
          if (op === '==') return data[field] === expected;
          if (op === '>') return data[field] > expected;
          return true;
        });
        if (matches) {
          docs.push({
            id: docPath.split('/').pop(),
            ref: makeRef(docPath),
            data: () => data,
          });
        }
        if (docs.length >= limit) break;
      }
      return { docs, empty: docs.length === 0 };
    },
  });

  return {
    collection: makeCollection,
    async runTransaction(callback) {
      const transaction = {
        async get(ref) {
          const data = documents.get(ref.path);
          return {
            exists: data !== undefined,
            data: () => data,
            get: (field) => data?.[field],
          };
        },
        set(ref, data, options) {
          const existing = documents.get(ref.path);
          documents.set(ref.path, options?.merge && existing ? { ...existing, ...data } : data);
        },
        update(ref, data) {
          const existing = documents.get(ref.path);
          documents.set(ref.path, { ...existing, ...data });
        },
        create(ref, data) {
          documents.set(ref.path, data);
        },
      };
      return callback(transaction);
    },
  };
};

describe('Custody Chain Unit Tests', () => {
  test('Valid state transitions work correctly', async () => {
    const admin = require('firebase-admin');
    const mockDb = makeFirestore({
      'matches/match-1': {
        matchId: 'match-1',
        parentId: 'parent-1',
        driverId: 'driver-1',
        status: 'active',
      },
    });
    jest.spyOn(admin, 'firestore').mockReturnValue(mockDb);

    // EXPECTED -> BOARDING_CONFIRMED
    const res1 = await updatePassengerStateCallable({
      auth: { uid: 'driver-1', token: { role: 'driver' } },
      data: { matchId: 'match-1', passengerId: 'pass-1', newState: 'BOARDING_CONFIRMED' },
    });
    expect(res1.currentState).toBe('BOARDING_CONFIRMED');

    // BOARDING_CONFIRMED -> IN_TRANSIT
    const res2 = await updatePassengerStateCallable({
      auth: { uid: 'driver-1', token: { role: 'driver' } },
      data: { matchId: 'match-1', passengerId: 'pass-1', newState: 'IN_TRANSIT' },
    });
    expect(res2.currentState).toBe('IN_TRANSIT');
  });

  test('Invalid transition EXPECTED -> HANDOVER_CONFIRMED fails', async () => {
    const admin = require('firebase-admin');
    const mockDb = makeFirestore({
      'matches/match-1': {
        matchId: 'match-1',
        parentId: 'parent-1',
        driverId: 'driver-1',
        status: 'active',
      },
    });
    jest.spyOn(admin, 'firestore').mockReturnValue(mockDb);

    await expect(
      updatePassengerStateCallable({
        auth: { uid: 'driver-1', token: { role: 'driver' } },
        data: { matchId: 'match-1', passengerId: 'pass-1', newState: 'HANDOVER_CONFIRMED' },
      })
    ).rejects.toThrow();
  });

  test('Generating OTP and confirming student handover succeeds', async () => {
    const admin = require('firebase-admin');
    const mockDb = makeFirestore({
      'matches/match-1': {
        matchId: 'match-1',
        parentId: 'parent-1',
        driverId: 'driver-1',
        status: 'active',
      },
      'matches/match-1/passengerStates/pass-1': { state: 'ARRIVAL_CONFIRMED' },
    });
    jest.spyOn(admin, 'firestore').mockReturnValue(mockDb);

    const otpRes = await generateHandoverOtp({
      auth: { uid: 'parent-1', token: { role: 'parent' } },
      data: { matchId: 'match-1', passengerId: 'pass-1' },
    });
    expect(otpRes.success).toBe(true);
    expect(otpRes.pin).toBeDefined();

    const confirmRes = await confirmStudentHandover({
      auth: { uid: 'driver-1', token: { role: 'driver' } },
      data: { matchId: 'match-1', passengerId: 'pass-1', pin: otpRes.pin },
    });
    expect(confirmRes.success).toBe(true);
    expect(confirmRes.state).toBe('HANDOVER_CONFIRMED');
  });
});
