const { beforeUserCreated } = require('firebase-functions/v2/identity');
const { HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

const VALID_DOCUMENT_ID = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 1500 &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/');

const SAFE_ERROR_CODES = new Set([
  'aborted',
  'deadline-exceeded',
  'internal',
  'invalid-argument',
  'not-found',
  'resource-exhausted',
  'unavailable',
]);

const getSafeErrorCode = (error) => {
  const rawCode = error?.code;
  const code = typeof rawCode === 'number' ? String(rawCode) : rawCode;
  const normalized = typeof code === 'string' ? code.toLowerCase() : '';
  const grpcCodes = new Map([
    ['3', 'invalid-argument'],
    ['5', 'not-found'],
    ['9', 'failed-precondition'],
    ['10', 'aborted'],
    ['13', 'internal'],
    ['14', 'unavailable'],
  ]);
  if (grpcCodes.has(normalized)) return grpcCodes.get(normalized);
  return SAFE_ERROR_CODES.has(normalized) ? normalized : 'unknown';
};

const buildInitialProfile = (serverTimestamp) => ({
  role: 'parent',
  approved: false,
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});

/**
 * Creates the minimum trusted profile only when it does not already exist.
 * The document ID is the Auth UID; duplicating identity data in Firestore is
 * intentionally avoided.
 */
const provisionProfileIfMissing = async ({ uid, firestore, serverTimestamp }) => {
  if (!VALID_DOCUMENT_ID(uid)) {
    throw new TypeError('A valid Auth UID is required.');
  }
  if (
    !firestore ||
    typeof firestore.collection !== 'function' ||
    typeof firestore.runTransaction !== 'function'
  ) {
    throw new TypeError('A Firestore instance is required.');
  }
  if (typeof serverTimestamp !== 'function') {
    throw new TypeError('A server timestamp adapter is required.');
  }

  const profileRef = firestore.collection('users').doc(uid);
  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(profileRef);
    if (snapshot.exists) return { created: false };

    transaction.create(profileRef, buildInitialProfile(serverTimestamp));
    return { created: true };
  });
};

const handleUserCreated = async (
  event,
  {
    firestore,
    serverTimestamp = FieldValue.serverTimestamp,
    logger = (entry) => console.info('User profile provisioning', entry),
  } = {}
) => {
  const uid = event?.data?.uid;
  try {
    if (!VALID_DOCUMENT_ID(uid)) {
      logger({
        operation: 'provision_user_profile',
        result: 'failed',
        errorCode: 'invalid-argument',
      });
      throw new TypeError('A valid Auth UID is required.');
    }

    const db = firestore || admin.firestore();
    const result = await provisionProfileIfMissing({
      uid,
      firestore: db,
      serverTimestamp,
    });
    logger({
      operation: 'provision_user_profile',
      result: result.created ? 'created' : 'existing',
    });
    return result;
  } catch (error) {
    logger({
      operation: 'provision_user_profile',
      result: 'failed',
      errorCode: getSafeErrorCode(error),
    });
    // Do not forward Firestore details: they can contain document paths or IDs.
    throw new Error('Unable to provision the user profile.');
  }
};

const provisionUserProfile = beforeUserCreated(async (event) => {
  await handleUserCreated(event);
});

const createEnsureUserProfileHandler = ({
  firestore,
  serverTimestamp = FieldValue.serverTimestamp,
  logger = (entry) => console.info('User profile provisioning', entry),
  HttpsErrorClass = HttpsError,
}) => {
  if (!firestore || typeof firestore.collection !== 'function') {
    throw new TypeError('A Firestore instance is required.');
  }

  return async (request) => {
    const uid = request?.auth?.uid;
    if (!VALID_DOCUMENT_ID(uid)) {
      throw new HttpsErrorClass('unauthenticated', 'Authentication is required.');
    }

    try {
      const result = await provisionProfileIfMissing({
        uid,
        firestore,
        serverTimestamp,
      });
      logger({
        operation: 'ensure_user_profile',
        result: result.created ? 'created' : 'existing',
      });
      return { created: result.created };
    } catch (error) {
      logger({
        operation: 'ensure_user_profile',
        result: 'failed',
        errorCode: getSafeErrorCode(error),
      });
      throw new HttpsErrorClass('internal', 'Unable to provision the user profile.');
    }
  };
};

module.exports = {
  buildInitialProfile,
  createEnsureUserProfileHandler,
  handleUserCreated,
  provisionProfileIfMissing,
  provisionUserProfile,
};
