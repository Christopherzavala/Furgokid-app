const crypto = require('crypto');
const admin = require('firebase-admin');

const TERMINAL_STATUSES = new Set(['completed', 'cancelled']);

class MatchLifecycleError extends Error {
  constructor(code, reason = code) {
    super(reason);
    this.code = code;
    this.reason = reason;
  }
}

const fail = (code, reason) => {
  throw new MatchLifecycleError(code, reason);
};

const validId = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 1500 &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/');

const deterministicMatchId = (requestId, vacancyId) =>
  `m_${crypto.createHash('sha256').update(`${requestId}\0${vacancyId}`).digest('hex')}`;

const validCount = (value) => Number.isSafeInteger(value) && value >= 0;

const isVacancyCompatible = (request, vacancy) =>
  request.zone === vacancy.zone &&
  (request.schedule === 'Ambas' ||
    vacancy.schedule === 'Ambas' ||
    request.schedule === vacancy.schedule);

const assertVacancyCapacity = (vacancy) => {
  if (
    !Number.isSafeInteger(vacancy.totalSeats) ||
    vacancy.totalSeats < 1 ||
    !Number.isSafeInteger(vacancy.availableSeats) ||
    !Number.isSafeInteger(vacancy.reservedSeats) ||
    vacancy.reservedSeats < 0 ||
    vacancy.availableSeats < 0 ||
    vacancy.totalSeats !== vacancy.availableSeats + vacancy.reservedSeats
  ) {
    fail('failed-precondition');
  }
};

const createMatchLifecycleRepository = ({ firestore }) => {
  if (
    !firestore ||
    typeof firestore.collection !== 'function' ||
    typeof firestore.runTransaction !== 'function'
  ) {
    throw new TypeError('A Firebase Admin Firestore instance is required.');
  }

  const requests = firestore.collection('requests');
  const vacancies = firestore.collection('vacancies');
  const matches = firestore.collection('matches');
  const users = firestore.collection('users');
  const fieldValue = admin.firestore.FieldValue;

  const getProfile = async (transaction, uid) => {
    const profile = await transaction.get(users.doc(uid));
    return profile.exists ? profile.data() : null;
  };

  const createOrAddMatch = async ({ actorUid, requestId, vacancyId, requestData }) => {
    if (!validId(actorUid) || !validId(requestId) || !validId(vacancyId)) {
      fail('invalid-argument');
    }
    const isNewRequest = requestData !== undefined && requestData !== null;
    if (isNewRequest && (typeof requestData !== 'object' || Array.isArray(requestData))) {
      fail('invalid-argument');
    }
    const requestRef = requests.doc(requestId);
    const vacancyRef = vacancies.doc(vacancyId);
    const matchId = deterministicMatchId(requestId, vacancyId);
    const matchRef = matches.doc(matchId);

    return firestore.runTransaction(async (transaction) => {
      const [profile, requestSnapshot, vacancySnapshot, matchSnapshot] = await Promise.all([
        getProfile(transaction, actorUid),
        transaction.get(requestRef),
        transaction.get(vacancyRef),
        transaction.get(matchRef),
      ]);
      if (profile?.role !== 'parent') fail('permission-denied');
      if (!vacancySnapshot.exists) fail('not-found');
      const vacancy = vacancySnapshot.data();
      if (vacancy.status !== 'active') fail('failed-precondition');
      assertVacancyCapacity(vacancy);

      const driverId = vacancy.driverId;
      const driverProfile = driverId ? await transaction.get(users.doc(driverId)) : null;
      if (!driverId || !driverProfile?.exists || driverProfile.get('role') !== 'driver') {
        fail('failed-precondition');
      }

      if (matchSnapshot.exists) {
        const existing = matchSnapshot.data();
        if (
          existing.requestId !== requestId ||
          existing.vacancyId !== vacancyId ||
          existing.parentId !== actorUid ||
          existing.driverId !== driverId ||
          (requestSnapshot.exists && requestSnapshot.get('parentId') !== actorUid)
        ) {
          fail('already-exists');
        }
        return { requestId, matchId, status: existing.status, idempotent: true };
      }

      let request;
      if (!requestSnapshot.exists) {
        if (!isNewRequest) fail('not-found');
        if (
          typeof requestData.school !== 'string' ||
          !requestData.school.trim() ||
          typeof requestData.zone !== 'string' ||
          !requestData.zone.trim() ||
          typeof requestData.schedule !== 'string' ||
          !requestData.schedule.trim() ||
          !Number.isSafeInteger(requestData.childrenCount) ||
          requestData.childrenCount < 1 ||
          requestData.childrenCount > vacancy.totalSeats ||
          (requestData.ages !== undefined && typeof requestData.ages !== 'string') ||
          (requestData.specialNeeds !== undefined && typeof requestData.specialNeeds !== 'string')
        ) {
          fail('invalid-argument');
        }
        if (!isVacancyCompatible(requestData, vacancy)) fail('failed-precondition');
        if (vacancy.availableSeats < requestData.childrenCount) fail('resource-exhausted');
        request = {
          parentId: actorUid,
          parentName: profile.displayName || '',
          parentPhone: profile.whatsapp || '',
          school: requestData.school.trim(),
          zone: requestData.zone.trim(),
          schedule: requestData.schedule.trim(),
          childrenCount: requestData.childrenCount,
          ages: requestData.ages?.trim() || '',
          specialNeeds: requestData.specialNeeds?.trim() || '',
          createdAt: fieldValue.serverTimestamp(),
          status: 'active',
          activeMatchId: null,
        };
      } else {
        request = requestSnapshot.data();
        if (request.parentId !== actorUid) fail('permission-denied');
        if (
          request.status !== 'active' ||
          (request.activeMatchId !== undefined && request.activeMatchId !== null)
        ) {
          fail('failed-precondition');
        }
        if (!isVacancyCompatible(request, vacancy)) fail('failed-precondition');
      }

      if (
        requestSnapshot.exists &&
        requestData &&
        (request.school !== requestData.school ||
          request.childrenCount !== requestData.childrenCount)
      ) {
        fail('already-exists');
      }
      if (
        !Number.isSafeInteger(request.childrenCount) ||
        request.childrenCount < 1 ||
        request.childrenCount > vacancy.totalSeats ||
        vacancy.availableSeats < request.childrenCount
      ) {
        fail('resource-exhausted');
      }

      if (!requestSnapshot.exists) transaction.create(requestRef, request);
      else transaction.update(requestRef, { updatedAt: fieldValue.serverTimestamp() });
      transaction.create(matchRef, {
        requestId,
        vacancyId,
        parentId: actorUid,
        driverId,
        parentName: request.parentName || '',
        driverName: vacancy.driverName || '',
        driverPhone: vacancy.driverPhone || '',
        school: request.school,
        zone: request.zone,
        schedule: request.schedule,
        childrenCount: request.childrenCount,
        ages: request.ages || '',
        specialNeeds: request.specialNeeds || '',
        status: 'pending',
        capacityReservationStatus: 'unreserved',
        reservedSeats: 0,
        createdAt: fieldValue.serverTimestamp(),
        updatedAt: fieldValue.serverTimestamp(),
      });
      return { requestId, matchId, status: 'pending', idempotent: false };
    });
  };

  const acceptMatch = async ({ actorUid, matchId }) => {
    if (!validId(actorUid) || !validId(matchId)) fail('invalid-argument');
    const matchRef = matches.doc(matchId);

    return firestore.runTransaction(async (transaction) => {
      const matchSnapshot = await transaction.get(matchRef);
      if (!matchSnapshot.exists) fail('not-found');
      const match = matchSnapshot.data();
      const requestRef = requests.doc(match.requestId);
      const vacancyRef = vacancies.doc(match.vacancyId);
      const [profile, requestSnapshot, vacancySnapshot] = await Promise.all([
        getProfile(transaction, actorUid),
        transaction.get(requestRef),
        transaction.get(vacancyRef),
      ]);
      if (profile?.role !== 'driver' || match.driverId !== actorUid) fail('permission-denied');
      if (match.status === 'active') {
        if (
          !requestSnapshot.exists ||
          requestSnapshot.get('status') !== 'active' ||
          requestSnapshot.get('activeMatchId') !== matchId ||
          match.capacityReservationStatus !== 'reserved' ||
          !vacancySnapshot.exists ||
          vacancySnapshot.get('driverId') !== actorUid
        ) {
          fail('failed-precondition');
        }
        const vacancy = vacancySnapshot.data();
        assertVacancyCapacity(vacancy);
        if (
          !Number.isSafeInteger(match.reservedSeats) ||
          match.reservedSeats < 1 ||
          match.reservedSeats !== requestSnapshot.get('childrenCount') ||
          match.reservedSeats > vacancy.reservedSeats
        ) {
          fail('failed-precondition');
        }
        return { status: 'active', idempotent: true };
      }
      if (match.status !== 'pending') fail('failed-precondition');
      if (!requestSnapshot.exists) fail('failed-precondition');
      const request = requestSnapshot.data();
      if (
        request.status !== 'active' ||
        (request.activeMatchId !== undefined && request.activeMatchId !== null)
      ) {
        fail('failed-precondition');
      }
      if (!vacancySnapshot.exists) fail('failed-precondition');
      const vacancy = vacancySnapshot.data();
      if (vacancy.status !== 'active' || vacancy.driverId !== actorUid) {
        fail('failed-precondition');
      }
      assertVacancyCapacity(vacancy);
      const seatCount = request.childrenCount;
      if (!Number.isSafeInteger(seatCount) || seatCount < 1) fail('failed-precondition');
      if (vacancy.availableSeats < seatCount) fail('resource-exhausted');

      transaction.update(vacancyRef, {
        availableSeats: vacancy.availableSeats - seatCount,
        reservedSeats: vacancy.reservedSeats + seatCount,
        updatedAt: fieldValue.serverTimestamp(),
      });
      transaction.update(requestRef, {
        activeMatchId: matchId,
        updatedAt: fieldValue.serverTimestamp(),
      });
      transaction.update(matchRef, {
        status: 'active',
        capacityReservationStatus: 'reserved',
        reservedSeats: seatCount,
        acceptedAt: fieldValue.serverTimestamp(),
        updatedAt: fieldValue.serverTimestamp(),
      });
      return { status: 'active', idempotent: false };
    });
  };

  const transitionToTerminal = async ({ actorUid, matchId, targetStatus }) => {
    if (!validId(actorUid) || !validId(matchId)) fail('invalid-argument');
    const matchRef = matches.doc(matchId);

    return firestore.runTransaction(async (transaction) => {
      const matchSnapshot = await transaction.get(matchRef);
      if (!matchSnapshot.exists) fail('not-found');
      const match = matchSnapshot.data();
      const requestRef = requests.doc(match.requestId);
      const vacancyRef = vacancies.doc(match.vacancyId);
      const trackingRef = matchRef.collection('tracking').doc('current');
      const [profile, requestSnapshot, vacancySnapshot, trackingSnapshot] = await Promise.all([
        getProfile(transaction, actorUid),
        transaction.get(requestRef),
        transaction.get(vacancyRef),
        transaction.get(trackingRef),
      ]);
      if (!requestSnapshot.exists) fail('failed-precondition');
      const actorIsParent = match.parentId === actorUid && profile?.role === 'parent';
      const actorIsDriver = match.driverId === actorUid && profile?.role === 'driver';
      if (targetStatus === 'completed' ? !actorIsDriver : !actorIsParent && !actorIsDriver) {
        fail('permission-denied');
      }
      if (match.status === targetStatus) return { status: targetStatus, idempotent: true };
      if (TERMINAL_STATUSES.has(match.status)) fail('failed-precondition');
      if (targetStatus === 'completed' && match.status !== 'active') {
        fail('failed-precondition');
      }
      if (!['pending', 'active'].includes(match.status)) fail('failed-precondition');

      const request = requestSnapshot.data();
      let vacancy = vacancySnapshot.exists ? vacancySnapshot.data() : null;
      const hasReservation = match.capacityReservationStatus === 'reserved';
      if (hasReservation) {
        if (!vacancy) fail('failed-precondition');
        assertVacancyCapacity(vacancy);
        if (
          !validCount(match.reservedSeats) ||
          match.reservedSeats < 1 ||
          match.reservedSeats !== request.childrenCount ||
          match.reservedSeats > vacancy.reservedSeats
        ) {
          fail('failed-precondition');
        }
      } else if (
        match.status === 'active' ||
        (match.capacityReservationStatus !== undefined &&
          match.capacityReservationStatus !== 'unreserved') ||
        (match.reservedSeats !== undefined && match.reservedSeats !== 0)
      ) {
        fail('failed-precondition');
      }
      if (request.activeMatchId && request.activeMatchId !== matchId && match.status === 'active') {
        fail('failed-precondition');
      }
      if (match.status === 'active' && request.activeMatchId !== matchId) {
        fail('failed-precondition');
      }

      if (hasReservation) {
        transaction.update(vacancyRef, {
          availableSeats: vacancy.availableSeats + match.reservedSeats,
          reservedSeats: vacancy.reservedSeats - match.reservedSeats,
          updatedAt: fieldValue.serverTimestamp(),
        });
      }
      if (request.activeMatchId === matchId) {
        transaction.update(requestRef, {
          activeMatchId: fieldValue.delete(),
          updatedAt: fieldValue.serverTimestamp(),
        });
      }
      transaction.update(matchRef, {
        status: targetStatus,
        capacityReservationStatus: hasReservation ? 'released' : 'unreserved',
        cancelledBy: targetStatus === 'cancelled' ? actorUid : fieldValue.delete(),
        cancelledAt:
          targetStatus === 'cancelled' ? fieldValue.serverTimestamp() : fieldValue.delete(),
        completedAt:
          targetStatus === 'completed' ? fieldValue.serverTimestamp() : fieldValue.delete(),
        updatedAt: fieldValue.serverTimestamp(),
      });
      if (trackingSnapshot.exists) transaction.delete(trackingRef);
      return { status: targetStatus, idempotent: false };
    });
  };

  const closeRequest = async ({ actorUid, requestId }) => {
    if (!validId(actorUid) || !validId(requestId)) fail('invalid-argument');
    const requestRef = requests.doc(requestId);
    return firestore.runTransaction(async (transaction) => {
      const [profile, requestSnapshot] = await Promise.all([
        getProfile(transaction, actorUid),
        transaction.get(requestRef),
      ]);
      if (!requestSnapshot.exists) fail('not-found');
      const request = requestSnapshot.data();
      if (profile?.role !== 'parent' || request.parentId !== actorUid) fail('permission-denied');
      if (request.status === 'closed') return { status: 'closed', idempotent: true };
      if (request.status !== 'active') fail('failed-precondition');

      let activeMatchSnapshot = null;
      if (request.activeMatchId) {
        activeMatchSnapshot = await transaction.get(matches.doc(request.activeMatchId));
        if (activeMatchSnapshot.exists && activeMatchSnapshot.get('status') === 'active') {
          fail('failed-precondition');
        }
      }
      transaction.update(requestRef, {
        status: 'closed',
        activeMatchId: fieldValue.delete(),
        closedAt: fieldValue.serverTimestamp(),
        updatedAt: fieldValue.serverTimestamp(),
      });
      return { status: 'closed', idempotent: false };
    });
  };

  const deleteRequests = async ({ actorUid, requestIds }) => {
    if (
      !validId(actorUid) ||
      !Array.isArray(requestIds) ||
      requestIds.length > 500 ||
      requestIds.some((requestId) => !validId(requestId)) ||
      new Set(requestIds).size !== requestIds.length
    ) {
      fail('invalid-argument');
    }

    const requestRefs = requestIds.map((requestId) => requests.doc(requestId));
    return firestore.runTransaction(async (transaction) => {
      const profile = await getProfile(transaction, actorUid);
      if (profile?.role !== 'parent') fail('permission-denied');
      if (requestIds.length === 0) return { deletedCount: 0, idempotent: true };
      const requestSnapshots = await Promise.all(
        requestRefs.map((requestRef) => transaction.get(requestRef))
      );

      for (let index = 0; index < requestSnapshots.length; index += 1) {
        const requestSnapshot = requestSnapshots[index];
        if (requestSnapshot.exists && requestSnapshot.get('parentId') !== actorUid) {
          fail('permission-denied');
        }
        const associatedMatches = await transaction.get(
          matches.where('requestId', '==', requestIds[index]).limit(1)
        );
        if (!associatedMatches.empty) {
          fail('failed-precondition', 'request-has-matches');
        }
      }

      for (let index = 0; index < requestSnapshots.length; index += 1) {
        if (requestSnapshots[index].exists) transaction.delete(requestRefs[index]);
      }
      return { deletedCount: requestSnapshots.filter((snapshot) => snapshot.exists).length };
    });
  };

  const updateVacancyCapacity = async ({ actorUid, vacancyId, totalSeats }) => {
    if (!validId(actorUid) || !validId(vacancyId) || !Number.isSafeInteger(totalSeats)) {
      fail('invalid-argument');
    }
    const vacancyRef = vacancies.doc(vacancyId);
    return firestore.runTransaction(async (transaction) => {
      const [profile, vacancySnapshot] = await Promise.all([
        getProfile(transaction, actorUid),
        transaction.get(vacancyRef),
      ]);
      if (!vacancySnapshot.exists) fail('not-found');
      const vacancy = vacancySnapshot.data();
      if (profile?.role !== 'driver' || vacancy.driverId !== actorUid) fail('permission-denied');
      assertVacancyCapacity(vacancy);
      if (totalSeats < vacancy.reservedSeats || totalSeats < 1) fail('failed-precondition');
      transaction.update(vacancyRef, {
        totalSeats,
        availableSeats: totalSeats - vacancy.reservedSeats,
        updatedAt: fieldValue.serverTimestamp(),
      });
      return {
        totalSeats,
        availableSeats: totalSeats - vacancy.reservedSeats,
        reservedSeats: vacancy.reservedSeats,
      };
    });
  };

  const initializeVacancyCapacity = async ({ actorUid, vacancyId }) => {
    if (!validId(actorUid) || !validId(vacancyId)) fail('invalid-argument');
    const vacancyRef = vacancies.doc(vacancyId);
    return firestore.runTransaction(async (transaction) => {
      const [profile, vacancySnapshot] = await Promise.all([
        getProfile(transaction, actorUid),
        transaction.get(vacancyRef),
      ]);
      if (!vacancySnapshot.exists) fail('not-found');
      const vacancy = vacancySnapshot.data();
      if (profile?.role !== 'driver' || vacancy.driverId !== actorUid) fail('permission-denied');
      if (Object.prototype.hasOwnProperty.call(vacancy, 'reservedSeats')) {
        return { status: 'already-initialized' };
      }
      if (
        vacancy.status !== 'active' ||
        !Number.isSafeInteger(vacancy.totalSeats) ||
        vacancy.totalSeats < 1 ||
        vacancy.availableSeats !== vacancy.totalSeats
      ) {
        fail('failed-precondition');
      }
      transaction.update(vacancyRef, {
        reservedSeats: 0,
        updatedAt: fieldValue.serverTimestamp(),
      });
      return { status: 'initialized' };
    });
  };

  return {
    createOrAddMatch,
    acceptMatch,
    cancelMatch: (input) => transitionToTerminal({ ...input, targetStatus: 'cancelled' }),
    completeMatch: (input) => transitionToTerminal({ ...input, targetStatus: 'completed' }),
    closeRequest,
    deleteRequests,
    updateVacancyCapacity,
    initializeVacancyCapacity,
  };
};

module.exports = {
  createMatchLifecycleRepository,
  MatchLifecycleError,
  deterministicMatchId,
};
