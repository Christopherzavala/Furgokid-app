const { HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');

const VALID_DOCUMENT_ID = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 1500 &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/');

const VALID_STATUSES = new Set([
  'pending',
  'active',
  'superseded',
  'revoked',
  'expired',
  'rejected',
]);
const TERMINAL_STATUSES = new Set(['superseded', 'revoked', 'expired', 'rejected']);
const ALLOWED_PURPOSES = new Set(['school_transport', 'extracurricular_transport']);
const ALLOWED_TRANSITIONS = {
  pending: new Set(['active', 'rejected', 'revoked', 'expired']),
  active: new Set(['superseded', 'revoked', 'expired']),
  superseded: new Set(['revoked']),
  revoked: new Set([]),
  expired: new Set([]),
  rejected: new Set([]),
};

const DISALLOWED_PASSENGER_FIELDS = new Set([
  'birthDate',
  'dateOfBirth',
  'phone',
  'email',
  'school',
  'photo',
  'photoUrl',
  'healthData',
  'medicalInfo',
  'specialNeeds',
]);

const sanitizePassengerData = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError('Passenger data must be a non-null object.');
  }
  for (const key of Object.keys(data)) {
    if (DISALLOWED_PASSENGER_FIELDS.has(key)) {
      throw new Error(`Field '${key}' is disallowed under child data minimization policies.`);
    }
  }
  return {
    passengerAlias:
      typeof data.passengerAlias === 'string' ? data.passengerAlias.trim() : 'Pasajero',
    status: VALID_STATUSES.has(data.status) ? data.status : 'active',
  };
};

const timestampMillis = (value) => {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const createPassengerAuthorizationManager = ({ firestore, fieldValue = FieldValue }) => {
  if (!firestore || typeof firestore.collection !== 'function') {
    throw new TypeError('A valid Firestore instance is required.');
  }

  const passengersRef = firestore.collection('passengers');
  const authorizationsRef = firestore.collection('passengerAuthorizations');
  const authorizationEventsRef = firestore.collection('authorizationEvents');
  const matchesRef = firestore.collection('matches');
  const usersRef = firestore.collection('users');

  const newLeaseToken = () =>
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : crypto.randomBytes(32).toString('hex');

  const isAdultProfileEligible = (profile) => {
    const eligibility = profile?.adultEligibility;
    return Boolean(
      profile?.role === 'parent' &&
        eligibility &&
        eligibility.status === 'eligible' &&
        typeof eligibility.method === 'string' &&
        eligibility.method.length > 0 &&
        typeof eligibility.noticeVersion === 'string' &&
        eligibility.noticeVersion.length > 0 &&
        timestampMillis(eligibility.recordedAt) !== null
    );
  };

  /**
   * Common transactional fencing predicate. Call only after reading auth,
   * passenger and guardian snapshots in the same transaction.
   */
  const isCurrentLease = ({
    authSnap,
    passSnap,
    guardianSnap,
    authRef,
    passengerId,
    guardianId,
    workerId,
    taskLeaseToken,
    assignedGeneration,
    nowMs = Date.now(),
  }) => {
    if (!authSnap?.exists || !passSnap?.exists || !guardianSnap?.exists) return false;
    const auth = authSnap.data();
    const passenger = passSnap.data();
    const guardian = guardianSnap.data();
    const expiry = timestampMillis(auth.cleanupLeaseExpiresAt);

    return (
      auth.authorizationId === authRef.id &&
      auth.passengerId === passengerId &&
      auth.guardianId === guardianId &&
      TERMINAL_STATUSES.has(auth.status) &&
      auth.cleanupStatus === 'pending' &&
      auth.cleanupLeaseOwner === workerId &&
      auth.cleanupLeaseId === taskLeaseToken &&
      auth.cleanupGeneration === assignedGeneration &&
      expiry !== null &&
      expiry > nowMs &&
      passenger.passengerId === passengerId &&
      passenger.parentId === guardianId &&
      guardian.role === 'parent'
    );
  };

  const createPassengerWithDeclaration = async ({
    adultUid,
    passengerId,
    requestId,
    passengerAlias,
    purpose = 'school_transport',
    privacyNoticeVersion,
    authorizationTextVersion,
    responsibilityDeclared = false,
    privacyNoticeAccepted = false,
  }) => {
    if (!VALID_DOCUMENT_ID(adultUid)) {
      throw new HttpsError('unauthenticated', 'Authentication is required.');
    }
    if (!VALID_DOCUMENT_ID(passengerId)) {
      throw new HttpsError('invalid-argument', 'A valid passengerId is required.');
    }
    if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(requestId)) {
      throw new HttpsError('invalid-argument', 'A valid requestId is required.');
    }
    if (!ALLOWED_PURPOSES.has(purpose)) {
      throw new HttpsError('invalid-argument', 'Invalid transport purpose.');
    }
    if (responsibilityDeclared !== true || privacyNoticeAccepted !== true) {
      throw new HttpsError(
        'failed-precondition',
        'Responsibility declaration and privacy notice acceptance are required.'
      );
    }
    if (
      typeof privacyNoticeVersion !== 'string' ||
      privacyNoticeVersion.trim().length === 0 ||
      typeof authorizationTextVersion !== 'string' ||
      authorizationTextVersion.trim().length === 0
    ) {
      throw new HttpsError(
        'invalid-argument',
        'Current privacy notice and authorization text versions are required.'
      );
    }

    const sanitized = sanitizePassengerData({ passengerAlias, status: 'active' });
    const passDocRef = passengersRef.doc(passengerId);
    const guardianRef = usersRef.doc(adultUid);
    const now = fieldValue.serverTimestamp();
    const requestHash = crypto
      .createHash('sha256')
      .update(`${adultUid}:${requestId}`)
      .digest('hex');
    const uniqueAuthId = `auth_${requestHash}`;
    const authorizationRef = authorizationsRef.doc(uniqueAuthId);
    const requestFingerprint = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          passengerId,
          passengerAlias: sanitized.passengerAlias,
          purpose,
          privacyNoticeVersion: privacyNoticeVersion.trim(),
          authorizationTextVersion: authorizationTextVersion.trim(),
          responsibilityDeclared,
          privacyNoticeAccepted,
        })
      )
      .digest('hex');
    let previousAuthId = null;
    await firestore.runTransaction(async (transaction) => {
      const passSnapInitial = await transaction.get(passDocRef);
      const previousAuthIdInitial = passSnapInitial.exists
        ? passSnapInitial.get('latestAuthorizationId') || null
        : null;
      const previousAuthRef = previousAuthIdInitial
        ? authorizationsRef.doc(previousAuthIdInitial)
        : null;

      const [guardianSnap, passSnap, existingAuthSnap, previousAuthSnap] = await Promise.all([
        transaction.get(guardianRef),
        Promise.resolve(passSnapInitial),
        transaction.get(authorizationRef),
        previousAuthRef ? transaction.get(previousAuthRef) : Promise.resolve(null),
      ]);
      if (existingAuthSnap.exists) {
        const existing = existingAuthSnap.data();
        if (
          existing.guardianId !== adultUid ||
          existing.requestFingerprint !== requestFingerprint
        ) {
          throw new HttpsError(
            'already-exists',
            'Request id was already used with different data.'
          );
        }
        return;
      }
      if (!guardianSnap.exists || guardianSnap.data()?.role !== 'parent') {
        throw new HttpsError(
          'permission-denied',
          'Authenticated account lacks the parent functional role.'
        );
      }
      if (!isAdultProfileEligible(guardianSnap.data())) {
        throw new HttpsError(
          'failed-precondition',
          'Adult account eligibility is not established by the backend.'
        );
      }
      if (guardianSnap.data().adultEligibility.noticeVersion !== privacyNoticeVersion) {
        throw new HttpsError(
          'failed-precondition',
          'Accepted privacy notice version does not match the eligible account record.'
        );
      }
      if (passSnap.exists) {
        if (passSnap.get('parentId') !== adultUid) {
          throw new HttpsError(
            'permission-denied',
            'Passenger belongs to another guardian. Titularity transfer denied.'
          );
        }
        previousAuthId = previousAuthIdInitial;
      }

      if (
        previousAuthSnap &&
        previousAuthSnap.exists &&
        previousAuthSnap.get('status') === 'active'
      ) {
        transaction.update(previousAuthSnap.ref, {
          status: 'superseded',
          supersededBy: uniqueAuthId,
          cleanupStatus: 'pending',
          cleanupTaskId: `task_${previousAuthSnap.id}`,
          updatedAt: now,
        });
      }

      transaction.set(
        passDocRef,
        {
          passengerId,
          parentId: adultUid,
          passengerAlias: sanitized.passengerAlias,
          status: 'active',
          latestAuthorizationId: uniqueAuthId,
          createdAt: passSnap.exists ? passSnap.get('createdAt') || now : now,
          updatedAt: now,
        },
        { merge: true }
      );
      transaction.set(authorizationRef, {
        authorizationId: uniqueAuthId,
        passengerId,
        guardianId: adultUid,
        purpose,
        responsibilityDeclared: true,
        privacyNoticeAccepted: true,
        privacyNoticeVersion: privacyNoticeVersion.trim(),
        authorizationTextVersion: authorizationTextVersion.trim(),
        status: 'active',
        cleanupStatus: 'none',
        cleanupGeneration: 0,
        requestFingerprint,
        previousAuthorizationId: previousAuthId,
        acceptedAt: now,
        declaredAt: now,
        updatedAt: now,
      });
      const eventRef = authorizationEventsRef.doc(`evt_${uniqueAuthId}_create`);
      transaction.create(eventRef, {
        eventId: eventRef.id,
        authorizationId: uniqueAuthId,
        passengerId,
        actorId: adultUid,
        action: 'CREATED',
        status: 'active',
        timestamp: now,
      });
    });

    const persistedSnapshot = await authorizationRef.get();
    if (!persistedSnapshot.exists) {
      throw new HttpsError('internal', 'Passenger authorization result could not be recovered.');
    }
    const persisted = persistedSnapshot.data();
    const acceptedAt = persisted.acceptedAt;
    return {
      passengerId: persisted.passengerId,
      authorizationId: persisted.authorizationId,
      status: persisted.status,
      responsibilityDeclared: persisted.responsibilityDeclared,
      privacyNoticeAccepted: persisted.privacyNoticeAccepted,
      acceptedAt:
        typeof acceptedAt?.toDate === 'function'
          ? acceptedAt.toDate().toISOString()
          : acceptedAt instanceof Date
          ? acceptedAt.toISOString()
          : acceptedAt,
    };
  };

  /**
   * Discover candidate active matches outside transactions, then validate every
   * destructive candidate using auth, passenger, guardian, match and tracking
   * reads in the same Firestore transaction as the delete. Firestore serializes
   * a transaction against concurrent writes to any read document: if lease or
   * match changes first, Firestore retries the callback against the new state;
   * if this delete commits first, it was valid at that serialization point.
   */
  const fencedPurgeMatchTracking = async ({
    authRef,
    workerId,
    taskLeaseToken,
    assignedGeneration,
    passengerId,
    guardianId,
  }) => {
    let purgedCount = 0;
    const candidates = await matchesRef
      .where('parentId', '==', guardianId)
      .where('status', '==', 'active')
      .get();

    for (const candidate of candidates.docs) {
      const matchRef = matchesRef.doc(candidate.id);
      const trackingRef = matchRef.collection('tracking').doc('current');
      const passRef = passengersRef.doc(passengerId);
      const guardianRef = usersRef.doc(guardianId);
      const deleted = await firestore.runTransaction(async (transaction) => {
        const [authSnap, passSnap, guardianSnap, matchSnap, trackingSnap] = await Promise.all([
          transaction.get(authRef),
          transaction.get(passRef),
          transaction.get(guardianRef),
          transaction.get(matchRef),
          transaction.get(trackingRef),
        ]);

        if (
          !isCurrentLease({
            authSnap,
            passSnap,
            guardianSnap,
            authRef,
            passengerId,
            guardianId,
            workerId,
            taskLeaseToken,
            assignedGeneration,
          }) ||
          !matchSnap.exists
        ) {
          return false;
        }

        const match = matchSnap.data();
        const matchLinksPassenger =
          match.passengerId === passengerId ||
          (Array.isArray(match.passengerIds) && match.passengerIds.includes(passengerId));
        if (match.parentId !== guardianId || match.status !== 'active' || !matchLinksPassenger) {
          return false;
        }
        if (!trackingSnap.exists) return false;

        // All transaction reads above precede the destructive write.
        transaction.delete(trackingRef);
        return true;
      });
      if (deleted) purgedCount += 1;
    }
    return { purgedCount };
  };

  const verifyGpsPurged = async (passengerId, guardianId) => {
    const candidates = await matchesRef
      .where('parentId', '==', guardianId)
      .where('status', '==', 'active')
      .get();
    for (const candidate of candidates.docs) {
      const match = candidate.data();
      const linked =
        match.passengerId === passengerId ||
        (Array.isArray(match.passengerIds) && match.passengerIds.includes(passengerId));
      if (!linked) continue;
      const current = await matchesRef
        .doc(candidate.id)
        .collection('tracking')
        .doc('current')
        .get();
      if (current.exists) return false;
    }
    return true;
  };

  const retryPendingRevocationCleanups = async ({
    workerId = 'default_worker',
    limit = 10,
  } = {}) => {
    if (!VALID_DOCUMENT_ID(workerId) || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new HttpsError('invalid-argument', 'Invalid cleanup worker or batch limit.');
    }
    const pending = await authorizationsRef
      .where('cleanupStatus', '==', 'pending')
      .limit(limit)
      .get();
    let recoveredCount = 0;
    let failedCount = 0;

    for (const candidate of pending.docs) {
      const authRef = authorizationsRef.doc(candidate.id);
      const candidateData = candidate.data();
      const passengerId = candidateData.passengerId;
      const guardianId = candidateData.guardianId;
      if (!VALID_DOCUMENT_ID(passengerId) || !VALID_DOCUMENT_ID(guardianId)) continue;

      const taskLeaseToken = newLeaseToken();
      const passRef = passengersRef.doc(passengerId);
      const guardianRef = usersRef.doc(guardianId);
      let assignedGeneration;

      const leased = await firestore.runTransaction(async (transaction) => {
        const [authSnap, passSnap, guardianSnap] = await Promise.all([
          transaction.get(authRef),
          transaction.get(passRef),
          transaction.get(guardianRef),
        ]);
        if (!authSnap.exists || !passSnap.exists || !guardianSnap.exists) return false;
        const auth = authSnap.data();
        const passenger = passSnap.data();
        const guardian = guardianSnap.data();
        const expiry = timestampMillis(auth.cleanupLeaseExpiresAt);
        if (
          auth.authorizationId !== authRef.id ||
          auth.passengerId !== passengerId ||
          auth.guardianId !== guardianId ||
          !TERMINAL_STATUSES.has(auth.status) ||
          auth.cleanupStatus !== 'pending' ||
          passenger.passengerId !== passengerId ||
          passenger.parentId !== guardianId ||
          passenger.latestAuthorizationId !== authRef.id ||
          guardian.role !== 'parent'
        ) {
          return false;
        }
        if (expiry !== null && expiry > Date.now()) return false;

        const previousGeneration = auth.cleanupGeneration;
        if (!Number.isSafeInteger(previousGeneration) || previousGeneration < 0) return false;
        assignedGeneration = previousGeneration + 1;
        transaction.update(authRef, {
          cleanupLeaseOwner: workerId,
          cleanupLeaseId: taskLeaseToken,
          cleanupGeneration: assignedGeneration,
          cleanupLeaseExpiresAt: new Date(Date.now() + 300000),
          updatedAt: fieldValue.serverTimestamp(),
        });
        return true;
      });
      if (!leased) continue;

      try {
        await fencedPurgeMatchTracking({
          authRef,
          workerId,
          taskLeaseToken,
          assignedGeneration,
          passengerId,
          guardianId,
        });
        if (!(await verifyGpsPurged(passengerId, guardianId))) {
          throw new Error('GPS_PURGE_VERIFY_FAILED');
        }

        const committed = await firestore.runTransaction(async (transaction) => {
          const [authSnap, passSnap, guardianSnap] = await Promise.all([
            transaction.get(authRef),
            transaction.get(passRef),
            transaction.get(guardianRef),
          ]);
          if (
            !isCurrentLease({
              authSnap,
              passSnap,
              guardianSnap,
              authRef,
              passengerId,
              guardianId,
              workerId,
              taskLeaseToken,
              assignedGeneration,
            })
          ) {
            return false;
          }
          transaction.update(authRef, {
            cleanupStatus: 'completed',
            cleanupLeaseOwner: null,
            cleanupLeaseId: null,
            cleanupLeaseExpiresAt: null,
            cleanedAt: fieldValue.serverTimestamp(),
            updatedAt: fieldValue.serverTimestamp(),
          });
          return true;
        });
        if (committed) recoveredCount += 1;
        else failedCount += 1;
      } catch (error) {
        const sanitizedCode =
          error?.message === 'GPS_PURGE_VERIFY_FAILED'
            ? 'GPS_PURGE_VERIFY_FAILED'
            : 'GPS_PURGE_DELETE_FAILED';
        try {
          await firestore.runTransaction(async (transaction) => {
            const [authSnap, passSnap, guardianSnap] = await Promise.all([
              transaction.get(authRef),
              transaction.get(passRef),
              transaction.get(guardianRef),
            ]);
            if (
              !isCurrentLease({
                authSnap,
                passSnap,
                guardianSnap,
                authRef,
                passengerId,
                guardianId,
                workerId,
                taskLeaseToken,
                assignedGeneration,
              })
            ) {
              return false;
            }
            transaction.update(authRef, {
              cleanupLeaseOwner: null,
              cleanupLeaseId: null,
              cleanupLeaseExpiresAt: null,
              retryCount: fieldValue.increment(1),
              lastErrorCode: sanitizedCode,
              updatedAt: fieldValue.serverTimestamp(),
            });
            return true;
          });
        } catch (_sanitizedRecoveryError) {
          // Deliberately omit exception, ids and payloads from logs and storage.
        }
        failedCount += 1;
      }
    }
    return { recoveredCount, failedCount };
  };

  const updateAuthorizationStatus = async ({
    adultUid,
    passengerId,
    authorizationId,
    newStatus,
  }) => {
    if (!VALID_DOCUMENT_ID(adultUid))
      throw new HttpsError('unauthenticated', 'Authentication is required.');
    if (!VALID_DOCUMENT_ID(passengerId))
      throw new HttpsError('invalid-argument', 'A valid passengerId is required.');
    if (!VALID_STATUSES.has(newStatus))
      throw new HttpsError('invalid-argument', 'Invalid authorization status.');

    let authRef;
    if (VALID_DOCUMENT_ID(authorizationId)) {
      authRef = authorizationsRef.doc(authorizationId);
    } else {
      const passSnapshot = await passengersRef.doc(passengerId).get();
      const latestId = passSnapshot.exists ? passSnapshot.get('latestAuthorizationId') : null;
      if (!latestId) throw new HttpsError('not-found', 'Passenger authorization record not found.');
      authRef = authorizationsRef.doc(latestId);
    }

    const passRef = passengersRef.doc(passengerId);
    const guardianRef = usersRef.doc(adultUid);
    const now = fieldValue.serverTimestamp();
    let targetAuthId;
    const isRevocation = TERMINAL_STATUSES.has(newStatus);

    await firestore.runTransaction(async (transaction) => {
      const [authSnap, passSnap, guardianSnap] = await Promise.all([
        transaction.get(authRef),
        transaction.get(passRef),
        transaction.get(guardianRef),
      ]);
      if (!authSnap.exists)
        throw new HttpsError('not-found', 'Passenger authorization record not found.');
      if (!passSnap.exists) throw new HttpsError('not-found', 'Passenger record not found.');
      if (!guardianSnap.exists || guardianSnap.get('role') !== 'parent') {
        throw new HttpsError(
          'permission-denied',
          'The authenticated account lacks the parent functional role.'
        );
      }
      if (newStatus === 'active' && !isAdultProfileEligible(guardianSnap.data())) {
        throw new HttpsError(
          'failed-precondition',
          'Adult account eligibility is not established by the backend.'
        );
      }

      const auth = authSnap.data();
      const passenger = passSnap.data();
      if (
        auth.authorizationId !== authSnap.id ||
        auth.passengerId !== passengerId ||
        auth.guardianId !== adultUid ||
        passenger.passengerId !== passengerId ||
        passenger.parentId !== adultUid
      ) {
        throw new HttpsError(
          'permission-denied',
          'Authorization, passenger and guardian identities do not match.'
        );
      }
      if (passenger.latestAuthorizationId !== authSnap.id) {
        throw new HttpsError(
          'failed-precondition',
          'Authorization is not the latest authorization for this passenger.'
        );
      }

      const currentStatus = auth.status || 'pending';
      if (currentStatus === 'revoked' && newStatus === 'revoked') {
        targetAuthId = authSnap.id;
        return;
      }
      if (currentStatus !== newStatus && !ALLOWED_TRANSITIONS[currentStatus]?.has(newStatus)) {
        throw new HttpsError(
          'failed-precondition',
          `Cannot transition authorization from '${currentStatus}' to '${newStatus}'.`
        );
      }
      targetAuthId = authSnap.id;
      const eventRef = authorizationEventsRef.doc(
        `evt_${targetAuthId}_${Date.now()}_${newLeaseToken().slice(0, 8)}`
      );
      const eventData = {
        eventId: eventRef.id,
        authorizationId: targetAuthId,
        passengerId,
        actorId: adultUid,
        action: 'STATUS_CHANGE',
        fromStatus: currentStatus,
        toStatus: newStatus,
        timestamp: now,
      };

      // All reads precede all writes.
      transaction.update(authRef, {
        status: newStatus,
        cleanupStatus: isRevocation ? 'pending' : 'none',
        cleanupLeaseOwner: isRevocation ? auth.cleanupLeaseOwner || null : null,
        cleanupLeaseId: isRevocation ? auth.cleanupLeaseId || null : null,
        cleanupLeaseExpiresAt: isRevocation ? auth.cleanupLeaseExpiresAt || null : null,
        updatedAt: now,
      });
      transaction.update(passRef, { status: newStatus, updatedAt: now });
      transaction.create(eventRef, eventData);
    });

    // Cleanup is processed only by the scheduled common lease worker.
    return {
      passengerId,
      authorizationId: targetAuthId,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };
  };

  return {
    createPassengerWithDeclaration,
    updateAuthorizationStatus,
    retryPendingRevocationCleanups,
    verifyGpsPurged,
    sanitizePassengerData,
  };
};

module.exports = {
  createPassengerAuthorizationManager,
  sanitizePassengerData,
  DISALLOWED_PASSENGER_FIELDS,
  VALID_STATUSES,
  ALLOWED_PURPOSES,
  ALLOWED_TRANSITIONS,
};
