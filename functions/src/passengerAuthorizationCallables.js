const { HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { createPassengerAuthorizationManager } = require('./passengerAuthorization');

const isValidDocumentId = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 1500 &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/');

const createPassengerAuthorizationCallables = ({ manager, HttpsErrorClass = HttpsError }) => {
  const getManager = () =>
    manager || createPassengerAuthorizationManager({ firestore: admin.firestore() });

  const onboardPassengerCallable = async (request) => {
    const adultUid = request?.auth?.uid;
    if (!adultUid) {
      throw new HttpsErrorClass('unauthenticated', 'Authentication is required.');
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

    return getManager().createPassengerWithDeclaration({
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
  };
  onboardPassengerCallable.run = onboardPassengerCallable;

  const updatePassengerAuthorizationStatusCallable = async (request) => {
    const adultUid = request?.auth?.uid;
    if (!adultUid) {
      throw new HttpsErrorClass('unauthenticated', 'Authentication is required.');
    }

    const { passengerId, authorizationId, newStatus } = request?.data || {};
    if (newStatus !== 'revoked') {
      throw new HttpsErrorClass(
        'permission-denied',
        'Clients may only revoke their own passenger authorization.'
      );
    }
    if (!isValidDocumentId(passengerId) || !isValidDocumentId(authorizationId)) {
      throw new HttpsErrorClass(
        'invalid-argument',
        'A valid passengerId and authorizationId are required.'
      );
    }

    return getManager().updateAuthorizationStatus({
      adultUid,
      passengerId,
      authorizationId,
      newStatus,
    });
  };
  updatePassengerAuthorizationStatusCallable.run = updatePassengerAuthorizationStatusCallable;

  return {
    onboardPassengerCallable,
    updatePassengerAuthorizationStatusCallable,
  };
};

const defaultCallables = createPassengerAuthorizationCallables({});
defaultCallables.onboardPassengerCallable.run = defaultCallables.onboardPassengerCallable;
defaultCallables.updatePassengerAuthorizationStatusCallable.run =
  defaultCallables.updatePassengerAuthorizationStatusCallable;

module.exports = {
  createPassengerAuthorizationCallables,
  onboardPassengerCallable: defaultCallables.onboardPassengerCallable,
  updatePassengerAuthorizationStatusCallable:
    defaultCallables.updatePassengerAuthorizationStatusCallable,
};
