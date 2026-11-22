const { FieldValue } = require('firebase-admin/firestore');

const REQUEST_STATUS = Object.freeze({
  NONE: 'none',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  REVOKED: 'revoked',
});

const DECISIONS = new Set(['approve', 'reject', 'revoke']);

class DriverApprovalError extends Error {
  constructor(code, reason = code) {
    super(reason);
    this.code = code;
    this.reason = reason;
  }
}

const fail = (code, reason) => {
  throw new DriverApprovalError(code, reason);
};

const validId = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 1500 &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/');

const getRequestStatus = (profile) => {
  const status = profile?.driverRequestStatus;
  return typeof status === 'string' && status ? status : REQUEST_STATUS.NONE;
};

const createDriverApprovalRepository = ({
  firestore,
  serverTimestamp = FieldValue.serverTimestamp,
}) => {
  if (
    !firestore ||
    typeof firestore.collection !== 'function' ||
    typeof firestore.runTransaction !== 'function'
  ) {
    throw new TypeError('A Firebase Admin Firestore instance is required.');
  }
  if (typeof serverTimestamp !== 'function') {
    throw new TypeError('A server timestamp adapter is required.');
  }

  const users = firestore.collection('users');
  const requestsCol = firestore.collection('requests');
  const vacanciesCol = firestore.collection('vacancies');

  const getProfile = async (transaction, uid) => {
    const snapshot = await transaction.get(users.doc(uid));
    return snapshot.exists ? snapshot.data() : null;
  };

  /**
   * Helper implementing two-phase transaction execution (Phase 1: Reads, Phase 2: Writes)
   * for cascading cancellation of active vacancies and matches when a driver is rejected or revoked.
   */
  const cascadeCancelDriverOperations = async ({ transaction, vacanciesSnap, matchesSnap }) => {
    const timestamp = serverTimestamp();

    // Collect unique requestRefs and vacancyRefs to batch reads
    const requestRefsMap = new Map();
    const vacancyRefsMap = new Map();

    for (const docSnap of matchesSnap.docs) {
      const match = docSnap.data();
      if (match.requestId) {
        requestRefsMap.set(match.requestId, requestsCol.doc(match.requestId));
      }
      if (match.vacancyId) {
        vacancyRefsMap.set(match.vacancyId, vacanciesCol.doc(match.vacancyId));
      }
    }

    // Phase 1: All transaction.get calls via Promise.all (fully parallelized)
    const requestRefs = [...requestRefsMap.values()];
    const vacancyRefsFromMatches = [...vacancyRefsMap.values()];
    const vacancyDocsToFetch = vacanciesSnap.docs.filter(
      (docSnap) => !vacancyRefsMap.has(docSnap.id)
    );

    const [requestSnaps, vacancySnapsFromMatches, vacancySnapsExplicit] = await Promise.all([
      Promise.all(requestRefs.map((ref) => transaction.get(ref))),
      Promise.all(vacancyRefsFromMatches.map((ref) => transaction.get(ref))),
      Promise.all(vacancyDocsToFetch.map((docSnap) => transaction.get(docSnap.ref))),
    ]);

    const requestMap = new Map();
    requestSnaps.forEach((snap, idx) => {
      requestMap.set(requestRefs[idx].id, snap);
    });

    const vacancySnapMap = new Map();
    vacancySnapsFromMatches.forEach((snap, idx) => {
      vacancySnapMap.set(vacancyRefsFromMatches[idx].id, snap);
    });
    vacancyDocsToFetch.forEach((docSnap, idx) => {
      vacancySnapMap.set(docSnap.id, vacancySnapsExplicit[idx]);
    });

    // Phase 2: Calculations and Unique Writes
    const releasedSeatsByVacancy = new Map(); // vacancyId -> seats to add back
    for (const docSnap of matchesSnap.docs) {
      const match = docSnap.data();
      if (
        match.capacityReservationStatus === 'reserved' &&
        Number.isInteger(match.reservedSeats) &&
        match.vacancyId
      ) {
        const currentReleased = releasedSeatsByVacancy.get(match.vacancyId) || 0;
        releasedSeatsByVacancy.set(match.vacancyId, currentReleased + match.reservedSeats);
      }
    }

    // Update vacancies: cancel and restore released seats in a single update per vacancy
    const processedVacancyIds = new Set();
    for (const docSnap of vacanciesSnap.docs) {
      processedVacancyIds.add(docSnap.id);
      const vacSnap = vacancySnapMap.get(docSnap.id);
      const updateData = {
        status: 'cancelled',
        cancellationReason: 'driver_revoked',
        updatedAt: timestamp,
      };
      if (vacSnap && vacSnap.exists) {
        const vacancy = vacSnap.data();
        const seatsToAdd = releasedSeatsByVacancy.get(docSnap.id) || 0;
        if (seatsToAdd > 0) {
          updateData.availableSeats = (vacancy.availableSeats || 0) + seatsToAdd;
          updateData.reservedSeats = Math.max(0, (vacancy.reservedSeats || 0) - seatsToAdd);
        }
      }
      transaction.update(docSnap.ref, updateData);
    }

    // Also handle vacancies referenced by matches that weren't in vacanciesSnap query
    for (const [vacancyId, seatsToAdd] of releasedSeatsByVacancy.entries()) {
      if (!processedVacancyIds.has(vacancyId)) {
        const vacancyRef = vacanciesCol.doc(vacancyId);
        const vacSnap = vacancySnapMap.get(vacancyId);
        if (vacSnap && vacSnap.exists) {
          const vacancy = vacSnap.data();
          transaction.update(vacancyRef, {
            status: 'cancelled',
            availableSeats: (vacancy.availableSeats || 0) + seatsToAdd,
            reservedSeats: Math.max(0, (vacancy.reservedSeats || 0) - seatsToAdd),
            cancellationReason: 'driver_revoked',
            updatedAt: timestamp,
          });
        }
      }
    }

    // Update requests to clear activeMatchId (once per unique requestId)
    const processedRequestIds = new Set();
    for (const docSnap of matchesSnap.docs) {
      const match = docSnap.data();
      if (match.requestId && !processedRequestIds.has(match.requestId)) {
        processedRequestIds.add(match.requestId);
        const reqSnap = requestMap.get(match.requestId);
        if (reqSnap && reqSnap.exists) {
          transaction.update(requestsCol.doc(match.requestId), {
            activeMatchId: FieldValue.delete(),
            updatedAt: timestamp,
          });
        }
      }
    }

    // Update matches and delete tracking current docs
    for (const docSnap of matchesSnap.docs) {
      const match = docSnap.data();
      const matchRef = docSnap.ref;
      const trackingRef = matchRef.collection('tracking').doc('current');
      const hasReservation = match.capacityReservationStatus === 'reserved';

      transaction.update(matchRef, {
        status: 'cancelled',
        capacityReservationStatus: hasReservation ? 'released' : 'unreserved',
        cancelledBy: 'system',
        cancellationReason: 'driver_revoked',
        cancelledAt: timestamp,
        updatedAt: timestamp,
      });
      transaction.delete(trackingRef);
    }

    return [...new Set(matchesSnap.docs.map((d) => d.data().parentId).filter(Boolean))];
  };

  const requestDriverApproval = async ({ actorUid }) => {
    if (!validId(actorUid)) fail('invalid-argument');

    return firestore.runTransaction(async (transaction) => {
      const profile = await getProfile(transaction, actorUid);
      if (!profile) fail('not-found');
      if (profile.role !== 'parent' || profile.approved !== false) {
        fail('failed-precondition');
      }

      const status = getRequestStatus(profile);
      if (status === REQUEST_STATUS.PENDING) {
        return { status: REQUEST_STATUS.PENDING, idempotent: true };
      }
      if (status === REQUEST_STATUS.APPROVED) {
        fail('failed-precondition');
      }
      if (
        status !== REQUEST_STATUS.NONE &&
        status !== REQUEST_STATUS.REJECTED &&
        status !== REQUEST_STATUS.REVOKED
      ) {
        fail('failed-precondition');
      }

      transaction.update(users.doc(actorUid), {
        driverRequestStatus: REQUEST_STATUS.PENDING,
        driverRequestUpdatedAt: serverTimestamp(),
      });
      return { status: REQUEST_STATUS.PENDING, idempotent: false };
    });
  };

  const reviewDriverRequest = async ({ actorUid, targetUid, decision }) => {
    if (!validId(actorUid) || !validId(targetUid) || !DECISIONS.has(decision)) {
      fail('invalid-argument');
    }
    if (actorUid === targetUid) fail('permission-denied');

    let vacanciesSnap = { docs: [] };
    let matchesSnap = { docs: [] };

    if (decision === 'revoke' || decision === 'reject') {
      [vacanciesSnap, matchesSnap] = await Promise.all([
        firestore
          .collection('vacancies')
          .where('driverId', '==', targetUid)
          .where('status', '==', 'active')
          .get(),
        firestore
          .collection('matches')
          .where('driverId', '==', targetUid)
          .where('status', 'in', ['active', 'accepted', 'pending'])
          .get(),
      ]);
    }

    return firestore.runTransaction(async (transaction) => {
      const [adminSnapshot, targetSnapshot] = await transaction.getAll(
        users.doc(actorUid),
        users.doc(targetUid)
      );
      const adminProfile = adminSnapshot.exists ? adminSnapshot.data() : null;
      const targetProfile = targetSnapshot.exists ? targetSnapshot.data() : null;
      if (adminProfile?.role !== 'admin' && adminProfile?.role !== 'ops') fail('permission-denied');
      if (!targetProfile) fail('not-found');

      const currentStatus = getRequestStatus(targetProfile);
      const targetRef = users.doc(targetUid);

      if (decision === 'approve') {
        if (
          currentStatus === REQUEST_STATUS.APPROVED &&
          targetProfile.role === 'driver' &&
          targetProfile.approved === true
        ) {
          return { status: REQUEST_STATUS.APPROVED, idempotent: true };
        }
        if (currentStatus !== REQUEST_STATUS.PENDING) fail('failed-precondition');
        if (targetProfile.role !== 'parent' || targetProfile.approved !== false) {
          fail('failed-precondition');
        }

        transaction.update(targetRef, {
          role: 'driver',
          approved: true,
          driverRequestStatus: REQUEST_STATUS.APPROVED,
          driverRequestUpdatedAt: serverTimestamp(),
        });
        return { status: REQUEST_STATUS.APPROVED, idempotent: false };
      }

      if (decision === 'reject') {
        if (
          currentStatus === REQUEST_STATUS.REJECTED &&
          targetProfile.role === 'parent' &&
          targetProfile.approved === false
        ) {
          return { status: REQUEST_STATUS.REJECTED, idempotent: true };
        }
        if (currentStatus !== REQUEST_STATUS.PENDING) fail('failed-precondition');
        if (targetProfile.role !== 'parent' || targetProfile.approved !== false) {
          fail('failed-precondition');
        }

        const affectedParentIds = await cascadeCancelDriverOperations({
          transaction,
          vacanciesSnap,
          matchesSnap,
        });

        transaction.update(targetRef, {
          role: 'parent',
          approved: false,
          driverRequestStatus: REQUEST_STATUS.REJECTED,
          driverRequestUpdatedAt: serverTimestamp(),
        });

        const res = { status: REQUEST_STATUS.REJECTED, idempotent: false };
        if (affectedParentIds.length > 0) res.affectedParentIds = affectedParentIds;
        return res;
      }

      // Revoke
      if (
        currentStatus === REQUEST_STATUS.REVOKED &&
        targetProfile.role === 'parent' &&
        targetProfile.approved === false
      ) {
        return { status: REQUEST_STATUS.REVOKED, idempotent: true };
      }
      if (
        currentStatus !== REQUEST_STATUS.APPROVED ||
        targetProfile.role !== 'driver' ||
        targetProfile.approved !== true
      ) {
        fail('failed-precondition');
      }

      const affectedParentIds = await cascadeCancelDriverOperations({
        transaction,
        vacanciesSnap,
        matchesSnap,
      });

      transaction.update(targetRef, {
        role: 'parent',
        approved: false,
        driverRequestStatus: REQUEST_STATUS.REVOKED,
        driverRequestUpdatedAt: serverTimestamp(),
      });

      const res = { status: REQUEST_STATUS.REVOKED, idempotent: false };
      if (affectedParentIds.length > 0) res.affectedParentIds = affectedParentIds;
      return res;
    });
  };

  return {
    requestDriverApproval,
    reviewDriverRequest,
    firestore,
  };
};

module.exports = {
  DriverApprovalError,
  REQUEST_STATUS,
  createDriverApprovalRepository,
};
