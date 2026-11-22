/**
 * Custody Chain, State Machine & OTP Handover Service
 *
 * Implements strict transacted state machine transitions:
 * EXPECTED -> BOARDING_CONFIRMED -> IN_TRANSIT -> ARRIVAL_CONFIRMED -> HANDOVER_CONFIRMED
 * with exceptional states: ABSENT, NO_SHOW, NOT_DELIVERED, INCIDENT.
 * Also manages single-use SHA-256 hashed OTPs for secure student handover.
 */

const { HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const crypto = require('crypto');

const VALID_DOCUMENT_ID = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 1500 &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/');

const VALID_PASSENGER_STATES = new Set([
  'EXPECTED',
  'BOARDING_CONFIRMED',
  'IN_TRANSIT',
  'ARRIVAL_CONFIRMED',
  'HANDOVER_CONFIRMED',
  'ABSENT',
  'NO_SHOW',
  'NOT_DELIVERED',
  'INCIDENT',
]);

const ALLOWED_PASSENGER_STATE_TRANSITIONS = {
  EXPECTED: new Set(['BOARDING_CONFIRMED', 'ABSENT', 'NO_SHOW', 'INCIDENT']),
  BOARDING_CONFIRMED: new Set(['IN_TRANSIT', 'NOT_DELIVERED', 'INCIDENT']),
  IN_TRANSIT: new Set(['ARRIVAL_CONFIRMED', 'NOT_DELIVERED', 'INCIDENT']),
  ARRIVAL_CONFIRMED: new Set(['HANDOVER_CONFIRMED', 'NOT_DELIVERED', 'INCIDENT']),
  HANDOVER_CONFIRMED: new Set([]), // terminal
  ABSENT: new Set([]), // terminal
  NO_SHOW: new Set([]), // terminal
  NOT_DELIVERED: new Set(['EXPECTED', 'HANDOVER_CONFIRMED', 'INCIDENT']),
  INCIDENT: new Set(['EXPECTED', 'HANDOVER_CONFIRMED', 'NOT_DELIVERED']),
};

const createCustodyChainService = ({ firestore }) => {
  const db = firestore || admin.firestore();
  const getNow = () =>
    admin.firestore?.Timestamp?.now ? admin.firestore.Timestamp.now() : new Date();

  const updatePassengerState = async (request) => {
    const actorUid = request?.auth?.uid;
    if (!actorUid) {
      throw new HttpsError('unauthenticated', 'Authentication is required.');
    }

    const { matchId, passengerId, newState } = request?.data || {};
    const actorRole = request?.auth?.token?.role || 'parent';

    if (
      !VALID_DOCUMENT_ID(matchId) ||
      !VALID_DOCUMENT_ID(passengerId) ||
      !VALID_PASSENGER_STATES.has(newState)
    ) {
      throw new HttpsError('invalid-argument', 'Invalid matchId, passengerId, or newState.');
    }

    const matchRef = db.collection('matches').doc(matchId);
    const stateRef = matchRef.collection('passengerStates').doc(passengerId);
    const now = getNow();

    let previousState = 'EXPECTED';

    await db.runTransaction(async (transaction) => {
      const matchSnap = await transaction.get(matchRef);
      if (!matchSnap.exists) {
        throw new HttpsError('not-found', 'Match record not found.');
      }
      const match = matchSnap.data();

      if (match.driverId !== actorUid && match.parentId !== actorUid && actorRole !== 'admin') {
        throw new HttpsError(
          'permission-denied',
          'Actor lacks permission to update passenger state.'
        );
      }

      const stateSnap = await transaction.get(stateRef);
      if (stateSnap.exists) {
        previousState = stateSnap.data().state || 'EXPECTED';
      }

      if (previousState === newState) {
        return; // Idempotent no-op
      }

      const allowed = ALLOWED_PASSENGER_STATE_TRANSITIONS[previousState];
      if (!allowed || !allowed.has(newState)) {
        throw new HttpsError(
          'failed-precondition',
          `Invalid state transition from '${previousState}' to '${newState}'.`
        );
      }

      transaction.set(
        stateRef,
        {
          matchId,
          passengerId,
          parentId: match.parentId,
          driverId: match.driverId,
          state: newState,
          previousState,
          updatedAt: now,
          updatedBy: actorUid,
        },
        { merge: true }
      );

      const eventRef = db
        .collection('authorizationEvents')
        .doc(`evt_st_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
      transaction.set(eventRef, {
        eventId: eventRef.id,
        matchId,
        passengerId,
        actorUid,
        actorRole: actorRole || (match.driverId === actorUid ? 'driver' : 'parent'),
        previousState,
        nextState: newState,
        action: 'PASSENGER_STATE_TRANSITION',
        timestamp: now,
      });
    });

    return { success: true, passengerId, previousState, currentState: newState };
  };

  const generateHandoverOtp = async (request) => {
    const actorUid = request?.auth?.uid;
    if (!actorUid) {
      throw new HttpsError('unauthenticated', 'Authentication is required.');
    }

    const { matchId, passengerId } = request?.data || {};
    if (!VALID_DOCUMENT_ID(matchId) || !VALID_DOCUMENT_ID(passengerId)) {
      throw new HttpsError('invalid-argument', 'Valid matchId and passengerId are required.');
    }

    const matchRef = db.collection('matches').doc(matchId);
    const matchSnap = await matchRef.get();

    if (!matchSnap.exists) {
      throw new HttpsError('not-found', 'Match record not found.');
    }
    const match = matchSnap.data();

    if (match.parentId !== actorUid) {
      const authQuery = await db
        .collection('passengerAuthorizations')
        .where('passengerId', '==', passengerId)
        .where('guardianId', '==', match.parentId)
        .where('status', '==', 'active')
        .get();

      const now = getNow();
      const nowMs = typeof now.toMillis === 'function' ? now.toMillis() : new Date(now).getTime();
      let authorized = false;
      for (const doc of authQuery.docs) {
        const data = doc.data();
        const validFrom = data.validFrom;
        const validUntil = data.validUntil;
        const revokedAt = data.revokedAt;

        if (revokedAt) continue;
        if (
          validFrom &&
          (typeof validFrom.toMillis === 'function'
            ? validFrom.toMillis()
            : new Date(validFrom).getTime()) > nowMs
        )
          continue;
        if (
          validUntil &&
          (typeof validUntil.toMillis === 'function'
            ? validUntil.toMillis()
            : new Date(validUntil).getTime()) < nowMs
        )
          continue;
        authorized = true;
        break;
      }

      if (!authorized) {
        throw new HttpsError(
          'permission-denied',
          'Only the authorized parent or valid proxy can generate handover OTP.'
        );
      }
    }

    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    const pinHash = crypto.createHash('sha256').update(pin).digest('hex');
    const otpId = `otp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const nowMs = Date.now();
    const expiresAt = admin.firestore?.Timestamp?.fromMillis
      ? admin.firestore.Timestamp.fromMillis(nowMs + 15 * 60 * 1000)
      : new Date(nowMs + 15 * 60 * 1000);

    const otpRef = matchRef.collection('handoverOtps').doc(otpId);
    await otpRef.set({
      otpId,
      matchId,
      passengerId,
      creatorId: actorUid,
      pinHash,
      status: 'active',
      createdAt: admin.firestore?.FieldValue?.serverTimestamp
        ? admin.firestore.FieldValue.serverTimestamp()
        : new Date(),
      expiresAt,
    });

    await db.collection('authorizationEvents').add({
      matchId,
      passengerId,
      actorUid,
      action: 'HANDOVER_OTP_GENERATED',
      timestamp: admin.firestore?.FieldValue?.serverTimestamp
        ? admin.firestore.FieldValue.serverTimestamp()
        : new Date(),
    });

    return {
      success: true,
      otpId,
      pin,
      expiresAt:
        typeof expiresAt?.toDate === 'function'
          ? expiresAt.toDate().toISOString()
          : new Date(expiresAt).toISOString(),
    };
  };

  const confirmStudentHandover = async (request) => {
    const driverUid = request?.auth?.uid;
    if (!driverUid) {
      throw new HttpsError('unauthenticated', 'Authentication is required.');
    }

    const { matchId, passengerId, pin } = request?.data || {};
    if (
      !VALID_DOCUMENT_ID(matchId) ||
      !VALID_DOCUMENT_ID(passengerId) ||
      typeof pin !== 'string' ||
      !pin.trim()
    ) {
      throw new HttpsError('invalid-argument', 'Valid matchId, passengerId, and pin are required.');
    }

    const matchRef = db.collection('matches').doc(matchId);
    const matchSnap = await matchRef.get();

    if (!matchSnap.exists) {
      throw new HttpsError('not-found', 'Match record not found.');
    }
    const match = matchSnap.data();

    if (match.driverId !== driverUid) {
      throw new HttpsError(
        'permission-denied',
        'Authenticated driver is not assigned to this match.'
      );
    }

    const pinHash = crypto.createHash('sha256').update(pin.trim()).digest('hex');
    const now = getNow();

    const otpsQuery = await matchRef
      .collection('handoverOtps')
      .where('passengerId', '==', passengerId)
      .where('status', '==', 'active')
      .where('expiresAt', '>', now)
      .get();

    let validOtpDoc = null;
    for (const doc of otpsQuery.docs) {
      if (doc.data().pinHash === pinHash) {
        validOtpDoc = doc;
        break;
      }
    }

    if (!validOtpDoc) {
      throw new HttpsError('invalid-argument', 'Invalid, expired, or already used handover PIN.');
    }

    await validOtpDoc.ref.update({
      status: 'used',
      usedAt: admin.firestore?.FieldValue?.serverTimestamp
        ? admin.firestore.FieldValue.serverTimestamp()
        : new Date(),
      usedBy: driverUid,
    });

    await updatePassengerState({
      auth: request.auth,
      data: { matchId, passengerId, newState: 'HANDOVER_CONFIRMED' },
    });

    return {
      success: true,
      message: 'Student handover successfully confirmed.',
      passengerId,
      state: 'HANDOVER_CONFIRMED',
    };
  };

  return {
    updatePassengerState,
    generateHandoverOtp,
    confirmStudentHandover,
  };
};

module.exports = {
  createCustodyChainService,
  updatePassengerStateCallable: async (req) =>
    createCustodyChainService({}).updatePassengerState(req),
  generateHandoverOtp: async (req) => createCustodyChainService({}).generateHandoverOtp(req),
  confirmStudentHandover: async (req) => createCustodyChainService({}).confirmStudentHandover(req),
};
