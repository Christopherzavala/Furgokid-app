'use strict';

const crypto = require('node:crypto');
const { HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

const OTP_TTL_MS = 15 * 60 * 1000; // 15 minutos
const OTP_MAX_ATTEMPTS = 5;

const PASSENGER_STATES = Object.freeze({
  EXPECTED: 'EXPECTED',
  BOARDING_CONFIRMED: 'BOARDING_CONFIRMED',
  IN_TRANSIT: 'IN_TRANSIT',
  ARRIVAL_CONFIRMED: 'ARRIVAL_CONFIRMED',
  HANDOVER_CONFIRMED: 'HANDOVER_CONFIRMED',
  ABSENT: 'ABSENT',
  NO_SHOW: 'NO_SHOW',
  NOT_DELIVERED: 'NOT_DELIVERED',
});

const ALLOWED_PASSENGER_STATE_TRANSITIONS = Object.freeze({
  [PASSENGER_STATES.EXPECTED]: [
    PASSENGER_STATES.BOARDING_CONFIRMED,
    PASSENGER_STATES.ABSENT,
    PASSENGER_STATES.NO_SHOW,
  ],
  [PASSENGER_STATES.BOARDING_CONFIRMED]: [
    PASSENGER_STATES.IN_TRANSIT,
    PASSENGER_STATES.ARRIVAL_CONFIRMED,
    PASSENGER_STATES.NOT_DELIVERED,
  ],
  [PASSENGER_STATES.IN_TRANSIT]: [
    PASSENGER_STATES.ARRIVAL_CONFIRMED,
    PASSENGER_STATES.NOT_DELIVERED,
  ],
  [PASSENGER_STATES.ARRIVAL_CONFIRMED]: [
    PASSENGER_STATES.HANDOVER_CONFIRMED,
    PASSENGER_STATES.NOT_DELIVERED,
  ],
  [PASSENGER_STATES.HANDOVER_CONFIRMED]: [],
  [PASSENGER_STATES.ABSENT]: [],
  [PASSENGER_STATES.NO_SHOW]: [],
  [PASSENGER_STATES.NOT_DELIVERED]: [],
});

const ROLE_ALLOWED_TARGET_STATES = Object.freeze({
  driver: new Set([
    PASSENGER_STATES.BOARDING_CONFIRMED,
    PASSENGER_STATES.IN_TRANSIT,
    PASSENGER_STATES.ARRIVAL_CONFIRMED,
    PASSENGER_STATES.NO_SHOW,
    PASSENGER_STATES.NOT_DELIVERED,
  ]),
  parent: new Set([PASSENGER_STATES.ABSENT]),
});

function getPassengerStateDocId(matchId, passengerId) {
  return `${matchId}_${passengerId}`;
}

function assertAuthenticated(auth) {
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Se requiere autenticación para esta operación.');
  }
  return auth.uid;
}

function assertNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new HttpsError('invalid-argument', `El campo "${fieldName}" es obligatorio.`);
  }
  return value.trim();
}

function generateSecurePin() {
  return crypto.randomInt(1000, 10000).toString();
}

function hashPin(pin, salt) {
  return crypto.createHash('sha256').update(`${salt}:${pin}`).digest('hex');
}

function verifyPinHash(providedPin, storedHash, storedSalt = '') {
  if (typeof providedPin !== 'string' || typeof storedHash !== 'string') {
    return false;
  }
  const candidateHash = storedSalt
    ? hashPin(providedPin, storedSalt)
    : crypto.createHash('sha256').update(providedPin).digest('hex');

  const candidateBuf = Buffer.from(candidateHash, 'utf8');
  const storedBuf = Buffer.from(storedHash, 'utf8');

  if (candidateBuf.length !== storedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(candidateBuf, storedBuf);
}

function extractPassengerIdsFromDoc(docData) {
  if (!docData || typeof docData !== 'object') {
    return new Set();
  }
  const ids = new Set();

  if (Array.isArray(docData.passengerIds)) {
    docData.passengerIds.forEach((id) => {
      if (typeof id === 'string' && id.trim()) ids.add(id.trim());
    });
  }
  if (Array.isArray(docData.students)) {
    docData.students.forEach((item) => {
      if (typeof item === 'string' && item.trim()) ids.add(item.trim());
      if (item && typeof item === 'object') {
        const candidate = item.passengerId || item.studentId || item.id;
        if (typeof candidate === 'string' && candidate.trim()) ids.add(candidate.trim());
      }
    });
  }
  for (const key of ['passengerId', 'studentId', 'childId']) {
    if (typeof docData[key] === 'string' && docData[key].trim()) {
      ids.add(docData[key].trim());
    }
  }
  return ids;
}

/**
 * Verifica que el pasajero pertenezca al match o a su request asociado.
 */
async function assertPassengerBelongsToMatch(db, matchData, passengerId, tx = null) {
  const matchPassengerIds = extractPassengerIdsFromDoc(matchData);
  if (matchPassengerIds.has(passengerId)) {
    return;
  }

  if (typeof matchData.requestId === 'string' && matchData.requestId.trim()) {
    const requestRef = db.collection('requests').doc(matchData.requestId.trim());
    const requestSnap = tx ? await tx.get(requestRef) : await requestRef.get();
    if (requestSnap.exists) {
      const requestPassengerIds = extractPassengerIdsFromDoc(requestSnap.data());
      if (requestPassengerIds.has(passengerId)) {
        return;
      }
    }
  }

  throw new HttpsError('permission-denied', 'El pasajero indicado no pertenece a este viaje.');
}

function resolveActorRoleForMatch(matchData, actorUid) {
  if (matchData.driverId === actorUid) {
    return 'driver';
  }
  if (matchData.parentId === actorUid) {
    return 'parent';
  }
  return null;
}

function toMillisSafe(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  return null;
}

/**
 * Valida si el usuario es el apoderado titular del match o un tercero con
 * autorización activa y vigente para retirar al pasajero.
 */
async function assertCanRequestHandoverOtp(db, matchData, passengerId, actorUid) {
  if (matchData.parentId === actorUid) {
    return 'parent';
  }

  const authSnap = await db
    .collection('passengerAuthorizations')
    .where('passengerId', '==', passengerId)
    .where('status', '==', 'active')
    .get();

  const nowMillis = Date.now();

  const validAuthDoc = authSnap.docs.find((doc) => {
    const data = doc.data() || {};

    const authorizedUid =
      data.authorizedUserId || data.authorizedUid || data.delegateId || data.recipientUid;

    if (authorizedUid !== actorUid) {
      return false;
    }

    if (data.guardianId && matchData.parentId && data.guardianId !== matchData.parentId) {
      return false;
    }

    if (data.revokedAt) {
      return false;
    }

    const validFromMillis = toMillisSafe(data.validFrom);
    if (validFromMillis !== null && validFromMillis > nowMillis) {
      return false;
    }

    const validUntilMillis = toMillisSafe(data.validUntil);
    if (validUntilMillis !== null && validUntilMillis < nowMillis) {
      return false;
    }

    return true;
  });

  if (!validAuthDoc) {
    throw new HttpsError(
      'permission-denied',
      'No tienes una autorización activa y vigente para generar el PIN de entrega de este pasajero.'
    );
  }

  return 'authorized_delegate';
}

/**
 * Función interna para ejecutar transiciones de estado en passengerStates.
 * No expuesta directamente como callable para evitar bypass del flujo OTP.
 */
async function transitionPassengerStateInternal({
  db,
  matchId,
  passengerId,
  newState,
  actorUid,
  metadata = {},
  allowHandoverWithoutOtp = false,
}) {
  const activeDb = db || getFirestore();
  if (!Object.values(PASSENGER_STATES).includes(newState)) {
    throw new HttpsError('invalid-argument', `Estado de pasajero no válido: "${newState}".`);
  }

  if (newState === PASSENGER_STATES.HANDOVER_CONFIRMED && !allowHandoverWithoutOtp) {
    throw new HttpsError(
      'failed-precondition',
      'HANDOVER_CONFIRMED requiere verificación mediante confirmStudentHandover.'
    );
  }

  const matchRef = activeDb.collection('matches').doc(matchId);
  const stateRef = activeDb
    .collection('passengerStates')
    .doc(getPassengerStateDocId(matchId, passengerId));

  return activeDb.runTransaction(async (tx) => {
    const [matchSnap, stateSnap] = await Promise.all([tx.get(matchRef), tx.get(stateRef)]);

    if (!matchSnap.exists) {
      throw new HttpsError('not-found', 'El viaje (match) no existe.');
    }

    const matchData = matchSnap.data();
    await assertPassengerBelongsToMatch(activeDb, matchData, passengerId, tx);

    const actorRole = resolveActorRoleForMatch(matchData, actorUid);
    if (!actorRole) {
      throw new HttpsError(
        'permission-denied',
        'El usuario no participa como conductor ni apoderado en este viaje.'
      );
    }

    if (!allowHandoverWithoutOtp) {
      const allowedForRole = ROLE_ALLOWED_TARGET_STATES[actorRole];
      if (!allowedForRole || !allowedForRole.has(newState)) {
        throw new HttpsError(
          'permission-denied',
          `El rol "${actorRole}" no está autorizado para registrar el estado "${newState}".`
        );
      }
    }

    const currentData = stateSnap.exists ? stateSnap.data() : null;
    const currentState = currentData?.state || PASSENGER_STATES.EXPECTED;
    const idempotencyKey =
      typeof metadata?.idempotencyKey === 'string' ? metadata.idempotencyKey.trim() : null;

    if (idempotencyKey && currentData?.lastIdempotencyKey === idempotencyKey) {
      return {
        matchId,
        passengerId,
        previousState: currentData.previousState || PASSENGER_STATES.EXPECTED,
        state: currentState,
        idempotent: true,
      };
    }

    const allowedNextStates = ALLOWED_PASSENGER_STATE_TRANSITIONS[currentState] || [];
    if (!allowedNextStates.includes(newState)) {
      throw new HttpsError(
        'failed-precondition',
        `Transición de estado inválida: "${currentState}" -> "${newState}".`
      );
    }

    const now = FieldValue.serverTimestamp();
    const updatedStatePayload = {
      matchId,
      passengerId,
      state: newState,
      previousState: currentState,
      updatedAt: now,
      updatedBy: actorUid,
      updatedByRole: actorRole,
      ...(idempotencyKey ? { lastIdempotencyKey: idempotencyKey } : {}),
      ...(stateSnap.exists ? {} : { createdAt: now }),
    };

    tx.set(stateRef, updatedStatePayload, { merge: true });

    const eventRef = activeDb.collection('custodyEvents').doc();
    tx.set(eventRef, {
      matchId,
      passengerId,
      fromState: currentState,
      toState: newState,
      actorUid,
      actorRole,
      metadata,
      createdAt: now,
    });

    return {
      matchId,
      passengerId,
      previousState: currentState,
      state: newState,
    };
  });
}

const createCustodyChainService = ({ firestore } = {}) => {
  const getDb = () => firestore || getFirestore();

  const updatePassengerState = async (request) => {
    const actorUid = assertAuthenticated(request.auth);
    const data = request.data || {};

    const matchId = assertNonEmptyString(data.matchId, 'matchId');
    const passengerId = assertNonEmptyString(data.passengerId, 'passengerId');
    const newState = assertNonEmptyString(data.newState, 'newState');
    const metadata = data.metadata && typeof data.metadata === 'object' ? { ...data.metadata } : {};
    if (typeof data.idempotencyKey === 'string' && data.idempotencyKey.trim()) {
      metadata.idempotencyKey = data.idempotencyKey.trim();
    }

    if (newState === PASSENGER_STATES.HANDOVER_CONFIRMED) {
      throw new HttpsError(
        'failed-precondition',
        'HANDOVER_CONFIRMED solo puede confirmarse mediante confirmStudentHandover con PIN válido.'
      );
    }

    return transitionPassengerStateInternal({
      db: getDb(),
      matchId,
      passengerId,
      newState,
      actorUid,
      metadata,
      allowHandoverWithoutOtp: false,
    });
  };

  const generateHandoverOtp = async (request) => {
    const actorUid = assertAuthenticated(request.auth);
    const data = request.data || {};

    const matchId = assertNonEmptyString(data.matchId, 'matchId');
    const passengerId = assertNonEmptyString(data.passengerId, 'passengerId');

    const db = getDb();
    const matchRef = db.collection('matches').doc(matchId);
    const matchSnap = await matchRef.get();

    if (!matchSnap.exists) {
      throw new HttpsError('not-found', 'El viaje (match) no existe.');
    }

    const matchData = matchSnap.data();
    await assertPassengerBelongsToMatch(db, matchData, passengerId);
    const requesterRole = await assertCanRequestHandoverOtp(db, matchData, passengerId, actorUid);

    const pin = generateSecurePin();
    const pinSalt = crypto.randomBytes(16).toString('hex');
    const pinHash = hashPin(pin, pinSalt);

    const nowMillis = Date.now();
    const createdAt = Timestamp.fromMillis(nowMillis);
    const expiresAt = Timestamp.fromMillis(nowMillis + OTP_TTL_MS);

    const otpId = await db.runTransaction(async (tx) => {
      const activeOtpsQuery = db
        .collection('handoverOtps')
        .where('matchId', '==', matchId)
        .where('passengerId', '==', passengerId)
        .where('status', '==', 'active');

      const activeOtpsSnap = await tx.get(activeOtpsQuery);

      activeOtpsSnap.docs.forEach((doc) => {
        tx.update(doc.ref, {
          status: 'superseded',
          supersededAt: createdAt,
          supersededBy: actorUid,
        });
      });

      const newOtpRef = db.collection('handoverOtps').doc();
      tx.set(newOtpRef, {
        matchId,
        passengerId,
        pinHash,
        pinSalt,
        status: 'active',
        failedAttempts: 0,
        maxAttempts: OTP_MAX_ATTEMPTS,
        generatedBy: actorUid,
        generatedByRole: requesterRole,
        createdAt,
        expiresAt,
      });

      return newOtpRef.id;
    });

    return {
      otpId,
      matchId,
      passengerId,
      pin,
      expiresAt: expiresAt.toDate().toISOString(),
    };
  };

  const confirmStudentHandover = async (request) => {
    const actorUid = assertAuthenticated(request.auth);
    const data = request.data || {};

    const matchId = assertNonEmptyString(data.matchId, 'matchId');
    const passengerId = assertNonEmptyString(data.passengerId, 'passengerId');
    const rawPin = assertNonEmptyString(data.pin, 'pin');

    if (!/^\d{4}$/.test(rawPin)) {
      throw new HttpsError('invalid-argument', 'El PIN debe ser numérico de 4 dígitos.');
    }

    const db = getDb();
    const matchRef = db.collection('matches').doc(matchId);
    const stateRef = db
      .collection('passengerStates')
      .doc(getPassengerStateDocId(matchId, passengerId));

    const txResult = await db.runTransaction(async (tx) => {
      const activeOtpsQuery = db
        .collection('handoverOtps')
        .where('matchId', '==', matchId)
        .where('passengerId', '==', passengerId)
        .where('status', '==', 'active')
        .limit(1);

      const [matchSnap, stateSnap, activeOtpsSnap] = await Promise.all([
        tx.get(matchRef),
        tx.get(stateRef),
        tx.get(activeOtpsQuery),
      ]);

      if (!matchSnap.exists) {
        throw new HttpsError('not-found', 'El viaje (match) no existe.');
      }

      const matchData = matchSnap.data();
      if (matchData.driverId !== actorUid) {
        throw new HttpsError(
          'permission-denied',
          'Solo el conductor asignado al viaje puede confirmar la entrega del pasajero.'
        );
      }

      await assertPassengerBelongsToMatch(db, matchData, passengerId, tx);

      const currentState = stateSnap.exists ? stateSnap.data()?.state : PASSENGER_STATES.EXPECTED;

      if (currentState !== PASSENGER_STATES.ARRIVAL_CONFIRMED) {
        throw new HttpsError(
          'failed-precondition',
          `No se puede confirmar la entrega en estado "${currentState}". Se requiere "${PASSENGER_STATES.ARRIVAL_CONFIRMED}".`
        );
      }

      if (activeOtpsSnap.empty) {
        throw new HttpsError(
          'failed-precondition',
          'No existe un PIN OTP activo para este pasajero.'
        );
      }

      const otpDoc = activeOtpsSnap.docs[0];
      const otpData = otpDoc.data();
      const nowMillis = Date.now();
      const nowTimestamp = Timestamp.fromMillis(nowMillis);

      const expiresAtMillis = toMillisSafe(otpData.expiresAt);
      if (expiresAtMillis !== null && expiresAtMillis <= nowMillis) {
        tx.update(otpDoc.ref, {
          status: 'expired',
          expiredAt: nowTimestamp,
        });
        return { outcome: 'expired' };
      }

      const currentAttempts = Number(otpData.failedAttempts || 0);
      const maxAttempts = Number(otpData.maxAttempts || OTP_MAX_ATTEMPTS);

      if (currentAttempts >= maxAttempts) {
        tx.update(otpDoc.ref, {
          status: 'locked',
          lockedAt: nowTimestamp,
        });
        return { outcome: 'locked' };
      }

      const isPinValid = verifyPinHash(rawPin, otpData.pinHash, otpData.pinSalt || '');

      if (!isPinValid) {
        const nextAttempts = currentAttempts + 1;
        const isNowLocked = nextAttempts >= maxAttempts;

        tx.update(otpDoc.ref, {
          failedAttempts: nextAttempts,
          lastFailedAt: nowTimestamp,
          ...(isNowLocked ? { status: 'locked', lockedAt: nowTimestamp } : {}),
        });

        return {
          outcome: isNowLocked ? 'locked' : 'invalid_pin',
          remainingAttempts: Math.max(0, maxAttempts - nextAttempts),
        };
      }

      tx.update(otpDoc.ref, {
        status: 'used',
        usedAt: nowTimestamp,
        confirmedBy: actorUid,
      });

      const serverNow = FieldValue.serverTimestamp();
      tx.set(
        stateRef,
        {
          matchId,
          passengerId,
          state: PASSENGER_STATES.HANDOVER_CONFIRMED,
          previousState: PASSENGER_STATES.ARRIVAL_CONFIRMED,
          handoverOtpId: otpDoc.id,
          handoverConfirmedAt: serverNow,
          updatedAt: serverNow,
          updatedBy: actorUid,
          updatedByRole: 'driver',
        },
        { merge: true }
      );

      const eventRef = db.collection('custodyEvents').doc();
      tx.set(eventRef, {
        matchId,
        passengerId,
        fromState: PASSENGER_STATES.ARRIVAL_CONFIRMED,
        toState: PASSENGER_STATES.HANDOVER_CONFIRMED,
        actorUid,
        actorRole: 'driver',
        metadata: {
          handoverOtpId: otpDoc.id,
          authorizedBy: otpData.generatedBy || null,
          authorizedByRole: otpData.generatedByRole || null,
        },
        createdAt: serverNow,
      });

      return {
        outcome: 'confirmed',
        otpId: otpDoc.id,
      };
    });

    if (txResult.outcome === 'expired') {
      throw new HttpsError(
        'deadline-exceeded',
        'El PIN OTP ha expirado. Solicita un nuevo código.'
      );
    }

    if (txResult.outcome === 'locked') {
      throw new HttpsError(
        'permission-denied',
        'El PIN OTP fue bloqueado por exceder el máximo de intentos fallidos. Genera un nuevo código.'
      );
    }

    if (txResult.outcome === 'invalid_pin') {
      throw new HttpsError(
        'permission-denied',
        `PIN de entrega inválido. Intentos restantes: ${txResult.remainingAttempts}.`
      );
    }

    return {
      matchId,
      passengerId,
      previousState: PASSENGER_STATES.ARRIVAL_CONFIRMED,
      state: PASSENGER_STATES.HANDOVER_CONFIRMED,
      otpId: txResult.otpId,
    };
  };

  return {
    updatePassengerState,
    generateHandoverOtp,
    confirmStudentHandover,
  };
};

const defaultService = createCustodyChainService();

module.exports = {
  PASSENGER_STATES,
  ALLOWED_PASSENGER_STATE_TRANSITIONS,
  ROLE_ALLOWED_TARGET_STATES,
  updatePassengerStateCallable: defaultService.updatePassengerState,
  updatePassengerState: defaultService.updatePassengerState,
  generateHandoverOtp: defaultService.generateHandoverOtp,
  confirmStudentHandover: defaultService.confirmStudentHandover,
  transitionPassengerStateInternal,
  createCustodyChainService,
  __testables: {
    getPassengerStateDocId,
    generateSecurePin,
    hashPin,
    verifyPinHash,
    assertPassengerBelongsToMatch,
    assertCanRequestHandoverOtp,
    resolveActorRoleForMatch,
  },
};
