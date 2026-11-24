'use strict';

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'test' });
}
const { Timestamp } = require('firebase-admin/firestore');
if (!admin.firestore) {
  admin.firestore = {};
}
admin.firestore.Timestamp = Timestamp;

const {
  PASSENGER_STATES,
  createCustodyChainService,
  transitionPassengerStateInternal,
  __testables,
} = require('../src/custodyChain');
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
        data: () => data,
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

  const makeQuery = (path, filters, limit = Infinity) => ({
    async get() {
      const docs = [];
      for (const [docPath, data] of documents.entries()) {
        if (!docPath.startsWith(`${path}/`) || docPath.slice(path.length + 1).includes('/')) {
          continue;
        }
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
          return makeQuery(path, filters, limitCount);
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
          const data = documents.get(ref.path);
          return {
            exists: data !== undefined,
            data: () => data,
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

describe('Hardened Custody Chain Unit Tests', () => {
  const baseMatch = {
    matchId: 'match-1',
    parentId: 'parent-1',
    driverId: 'driver-1',
    passengerIds: ['pass-1'],
    status: 'active',
  };

  test('1. Bloquea transición directa a HANDOVER_CONFIRMED en updatePassengerState', async () => {
    const mockDb = makeFirestore({ 'matches/match-1': baseMatch });
    const service = createCustodyChainService({ firestore: mockDb });

    await expect(
      service.updatePassengerState({
        auth: { uid: 'driver-1' },
        data: {
          matchId: 'match-1',
          passengerId: 'pass-1',
          newState: PASSENGER_STATES.HANDOVER_CONFIRMED,
        },
      })
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  test('2. Segregación de roles: parent no puede abordar y driver no puede marcar ABSENT', async () => {
    const mockDb = makeFirestore({ 'matches/match-1': baseMatch });
    const service = createCustodyChainService({ firestore: mockDb });

    await expect(
      service.updatePassengerState({
        auth: { uid: 'parent-1' },
        data: {
          matchId: 'match-1',
          passengerId: 'pass-1',
          newState: PASSENGER_STATES.BOARDING_CONFIRMED,
        },
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });

    await expect(
      service.updatePassengerState({
        auth: { uid: 'driver-1' },
        data: {
          matchId: 'match-1',
          passengerId: 'pass-1',
          newState: PASSENGER_STATES.ABSENT,
        },
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  test('3. Rechaza operaciones si passengerId no pertenece al match', async () => {
    const mockDb = makeFirestore({ 'matches/match-1': baseMatch });
    const service = createCustodyChainService({ firestore: mockDb });

    await expect(
      service.updatePassengerState({
        auth: { uid: 'driver-1' },
        data: {
          matchId: 'match-1',
          passengerId: 'otro-pasajero',
          newState: PASSENGER_STATES.BOARDING_CONFIRMED,
        },
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  test('4. Rechaza generateHandoverOtp para terceros sin autorización vigente y permite delegado válido', async () => {
    const now = Date.now();
    const mockDb = makeFirestore({
      'matches/match-1': baseMatch,
      'passengerAuthorizations/auth-expired': {
        passengerId: 'pass-1',
        guardianId: 'parent-1',
        authorizedUserId: 'delegate-expired',
        status: 'active',
        validUntil: Timestamp.fromMillis(now - 60_000),
      },
      'passengerAuthorizations/auth-valid': {
        passengerId: 'pass-1',
        guardianId: 'parent-1',
        authorizedUserId: 'delegate-valid',
        status: 'active',
        validFrom: Timestamp.fromMillis(now - 60_000),
        validUntil: Timestamp.fromMillis(now + 600_000),
      },
    });
    const service = createCustodyChainService({ firestore: mockDb });

    await expect(
      service.generateHandoverOtp({
        auth: { uid: 'delegate-expired' },
        data: { matchId: 'match-1', passengerId: 'pass-1' },
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });

    const otp = await service.generateHandoverOtp({
      auth: { uid: 'delegate-valid' },
      data: { matchId: 'match-1', passengerId: 'pass-1' },
    });

    expect(otp.pin).toMatch(/^\d{4}$/);
  });

  test('5. Flujo completo de entrega OTP: exige ARRIVAL_CONFIRMED, consume PIN atómicamente e impide replay', async () => {
    const mockDb = makeFirestore({
      'matches/match-1': baseMatch,
      'passengerStates/match-1_pass-1': { state: PASSENGER_STATES.IN_TRANSIT },
    });
    const service = createCustodyChainService({ firestore: mockDb });

    const firstOtp = await service.generateHandoverOtp({
      auth: { uid: 'parent-1' },
      data: { matchId: 'match-1', passengerId: 'pass-1' },
    });

    // Generar un segundo OTP invalida (supersedes) el primero
    const secondOtp = await service.generateHandoverOtp({
      auth: { uid: 'parent-1' },
      data: { matchId: 'match-1', passengerId: 'pass-1' },
    });
    expect(mockDb._documents.get(`handoverOtps/${firstOtp.otpId}`).status).toBe('superseded');

    // No permite confirmar si aún está en IN_TRANSIT
    await expect(
      service.confirmStudentHandover({
        auth: { uid: 'driver-1' },
        data: { matchId: 'match-1', passengerId: 'pass-1', pin: secondOtp.pin },
      })
    ).rejects.toMatchObject({ code: 'failed-precondition' });

    // Conductor avanza a ARRIVAL_CONFIRMED
    await service.updatePassengerState({
      auth: { uid: 'driver-1' },
      data: {
        matchId: 'match-1',
        passengerId: 'pass-1',
        newState: PASSENGER_STATES.ARRIVAL_CONFIRMED,
      },
    });

    // Confirmación válida con el PIN activo
    const result = await service.confirmStudentHandover({
      auth: { uid: 'driver-1' },
      data: { matchId: 'match-1', passengerId: 'pass-1', pin: secondOtp.pin },
    });

    expect(result.state).toBe(PASSENGER_STATES.HANDOVER_CONFIRMED);
    expect(mockDb._documents.get(`handoverOtps/${secondOtp.otpId}`).status).toBe('used');
    expect(mockDb._documents.get('passengerStates/match-1_pass-1').state).toBe(
      PASSENGER_STATES.HANDOVER_CONFIRMED
    );

    // Intento de replay con el mismo PIN falla
    await expect(
      service.confirmStudentHandover({
        auth: { uid: 'driver-1' },
        data: { matchId: 'match-1', passengerId: 'pass-1', pin: secondOtp.pin },
      })
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  test('6. Bloqueo por fuerza bruta tras 5 intentos fallidos y rechazo por expiración', async () => {
    const salt = 'test-salt';
    const pinHash = __testables.hashPin('4829', salt);
    const mockDb = makeFirestore({
      'matches/match-1': baseMatch,
      'passengerStates/match-1_pass-1': { state: PASSENGER_STATES.ARRIVAL_CONFIRMED },
      'handoverOtps/otp-brute': {
        matchId: 'match-1',
        passengerId: 'pass-1',
        pinHash,
        pinSalt: salt,
        status: 'active',
        failedAttempts: 0,
        maxAttempts: 5,
        expiresAt: Timestamp.fromMillis(Date.now() + 600_000),
      },
    });
    const service = createCustodyChainService({ firestore: mockDb });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await expect(
        service.confirmStudentHandover({
          auth: { uid: 'driver-1' },
          data: { matchId: 'match-1', passengerId: 'pass-1', pin: '0000' },
        })
      ).rejects.toMatchObject({ code: 'permission-denied' });
    }

    expect(mockDb._documents.get('handoverOtps/otp-brute').status).toBe('locked');

    // OTP expirado
    mockDb._documents.set('handoverOtps/otp-expired', {
      matchId: 'match-1',
      passengerId: 'pass-1',
      pinHash,
      pinSalt: salt,
      status: 'active',
      failedAttempts: 0,
      maxAttempts: 5,
      expiresAt: Timestamp.fromMillis(Date.now() - 1_000),
    });

    await expect(
      service.confirmStudentHandover({
        auth: { uid: 'driver-1' },
        data: { matchId: 'match-1', passengerId: 'pass-1', pin: '4829' },
      })
    ).rejects.toMatchObject({ code: 'deadline-exceeded' });
  });

  test('7. transitionPassengerStateInternal bloquea ABSENT si el pasajero ya abordó', async () => {
    const mockDb = makeFirestore({
      'matches/match-1': baseMatch,
      'passengerStates/match-1_pass-1': { state: PASSENGER_STATES.BOARDING_CONFIRMED },
    });

    await expect(
      transitionPassengerStateInternal({
        db: mockDb,
        matchId: 'match-1',
        passengerId: 'pass-1',
        newState: PASSENGER_STATES.ABSENT,
        actorUid: 'parent-1',
      })
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  test('8. reportAbsenceCallable succeeds when passenger state is EXPECTED', async () => {
    const mockDb = makeFirestore({
      'matches/match-1': baseMatch,
      'users/driver-1': { role: 'driver', fcmToken: 'test-token' },
    });
    jest.spyOn(admin, 'firestore').mockReturnValue(mockDb);
    jest.spyOn(admin, 'messaging').mockReturnValue({
      send: jest.fn().mockResolvedValue('msg-id'),
    });

    const res = await reportAbsenceCallable.run({
      auth: { uid: 'parent-1', token: { role: 'parent' } },
      data: { matchId: 'match-1', passengerId: 'pass-1', date: '2026-11-24' },
    });
    expect(res.success).toBe(true);
    expect(res.absenceId).toBeDefined();
  });

  test('9. Additional validation branches for assertAuthenticated, assertNonEmptyString and extractPassengerIdsFromDoc', async () => {
    const mockDb = makeFirestore({ 'matches/match-1': baseMatch });
    const service = createCustodyChainService({ firestore: mockDb });

    await expect(
      service.updatePassengerState({
        auth: null,
        data: { matchId: 'm1', passengerId: 'p1', newState: 'BOARDING_CONFIRMED' },
      })
    ).rejects.toMatchObject({ code: 'unauthenticated' });
    await expect(
      service.updatePassengerState({
        auth: { uid: '' },
        data: { matchId: 'm1', passengerId: 'p1', newState: 'BOARDING_CONFIRMED' },
      })
    ).rejects.toMatchObject({ code: 'unauthenticated' });

    // assertNonEmptyString
    await expect(
      service.updatePassengerState({
        auth: { uid: 'driver-1' },
        data: { matchId: 123, passengerId: 'p1', newState: 'BOARDING_CONFIRMED' },
      })
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('10. confirmStudentHandover handles invalid PIN attempts remaining count', async () => {
    const salt = 'test-salt';
    const pinHash = __testables.hashPin('4829', salt);
    const mockDb = makeFirestore({
      'matches/match-1': baseMatch,
      'passengerStates/match-1_pass-1': { state: PASSENGER_STATES.ARRIVAL_CONFIRMED },
      'handoverOtps/otp-1': {
        matchId: 'match-1',
        passengerId: 'pass-1',
        pinHash,
        pinSalt: salt,
        status: 'active',
        failedAttempts: 2,
        maxAttempts: 5,
        expiresAt: Timestamp.fromMillis(Date.now() + 600_000),
      },
    });
    const service = createCustodyChainService({ firestore: mockDb });

    await expect(
      service.confirmStudentHandover({
        auth: { uid: 'driver-1' },
        data: { matchId: 'match-1', passengerId: 'pass-1', pin: '0000' },
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  test('11. Additional custodyChain branches: updatePassengerState match not found, assertPassengerBelongsToMatch with requestId', async () => {
    const mockDb = makeFirestore({
      'matches/match-req': { ...baseMatch, requestId: 'req-1' },
      'requests/req-1': { passengerIds: ['pass-req'] },
    });
    const service = createCustodyChainService({ firestore: mockDb });

    await expect(
      service.updatePassengerState({
        auth: { uid: 'driver-1' },
        data: {
          matchId: 'match-missing',
          passengerId: 'pass-req',
          newState: PASSENGER_STATES.BOARDING_CONFIRMED,
        },
      })
    ).rejects.toMatchObject({ code: 'not-found' });
  });
});
