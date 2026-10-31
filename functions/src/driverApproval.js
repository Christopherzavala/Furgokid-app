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

  const getProfile = async (transaction, uid) => {
    const snapshot = await transaction.get(users.doc(uid));
    return snapshot.exists ? snapshot.data() : null;
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

    return firestore.runTransaction(async (transaction) => {
      const [adminSnapshot, targetSnapshot] = await transaction.getAll(
        users.doc(actorUid),
        users.doc(targetUid)
      );
      const adminProfile = adminSnapshot.exists ? adminSnapshot.data() : null;
      const targetProfile = targetSnapshot.exists ? targetSnapshot.data() : null;
      if (adminProfile?.role !== 'admin') fail('permission-denied');
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

        transaction.update(targetRef, {
          role: 'parent',
          approved: false,
          driverRequestStatus: REQUEST_STATUS.REJECTED,
          driverRequestUpdatedAt: serverTimestamp(),
        });
        return { status: REQUEST_STATUS.REJECTED, idempotent: false };
      }

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

      transaction.update(targetRef, {
        role: 'parent',
        approved: false,
        driverRequestStatus: REQUEST_STATUS.REVOKED,
        driverRequestUpdatedAt: serverTimestamp(),
      });
      return { status: REQUEST_STATUS.REVOKED, idempotent: false };
    });
  };

  return {
    requestDriverApproval,
    reviewDriverRequest,
  };
};

module.exports = {
  DriverApprovalError,
  REQUEST_STATUS,
  createDriverApprovalRepository,
};
