const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { createPassengerAuthorizationManager } = require('./passengerAuthorization');

const getManager = (firestore) =>
  createPassengerAuthorizationManager({
    firestore: firestore || admin.firestore(),
  });

const isValidDocumentId = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 1500 &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/');

const onboardPassengerCallable = onCall(async (request) => {
  const adultUid = request?.auth?.uid;
  if (!adultUid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }

  const {
    passengerId,
    requestId,
    passengerAlias,
    purpose,
    privacyNoticeVersion,
    authorizationTextVersion,
    responsibilityDeclared,
    privacyNoticeAccepted,
  } = request?.data || {};

  const manager = getManager();
  return manager.createPassengerWithDeclaration({
    adultUid,
    passengerId,
    requestId,
    passengerAlias,
    purpose,
    privacyNoticeVersion,
    authorizationTextVersion,
    responsibilityDeclared,
    privacyNoticeAccepted,
  });
});

const updatePassengerAuthorizationStatusCallable = onCall(async (request) => {
  const adultUid = request?.auth?.uid;
  if (!adultUid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }

  const { passengerId, authorizationId, newStatus } = request?.data || {};
  if (newStatus !== 'revoked') {
    throw new HttpsError(
      'permission-denied',
      'Clients may only revoke their own passenger authorization.'
    );
  }
  if (!isValidDocumentId(passengerId) || !isValidDocumentId(authorizationId)) {
    throw new HttpsError(
      'invalid-argument',
      'A valid passengerId and authorizationId are required.'
    );
  }

  const manager = getManager();
  return manager.updateAuthorizationStatus({
    adultUid,
    passengerId,
    authorizationId,
    newStatus,
  });
});

module.exports = {
  onboardPassengerCallable,
  updatePassengerAuthorizationStatusCallable,
};
