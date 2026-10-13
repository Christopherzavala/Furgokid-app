const admin = require('firebase-admin');

const MAX_PAGE_SIZE = 500;
const OWNER_FIELDS = new Set(['driverId', 'parentId']);
const TERMINAL_MATCH_STATUSES = new Set(['completed', 'cancelled']);

const isValidDocumentId = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 1500 &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/');

const assertDocumentId = (value, name) => {
  if (!isValidDocumentId(value)) {
    throw new TypeError(`${name} must be a valid Firestore document ID.`);
  }
};

const assertOwner = (owner) => {
  if (!owner || !OWNER_FIELDS.has(owner.field) || !isValidDocumentId(owner.uid)) {
    throw new TypeError('A verified match owner is required.');
  }
};

const createFirestoreGpsCleanupRepository = ({ firestore = admin.firestore() } = {}) => {
  if (
    !firestore ||
    typeof firestore.collection !== 'function' ||
    typeof firestore.runTransaction !== 'function'
  ) {
    throw new TypeError('A Firebase Admin Firestore instance is required.');
  }

  const matches = firestore.collection('matches');
  const matchTrackingRef = (matchId) => matches.doc(matchId).collection('tracking').doc('current');

  const listActiveMatchesByDriver = async ({ driverId, pageToken = null, pageSize }) => {
    assertDocumentId(driverId, 'driverId');
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
      throw new RangeError(`pageSize must be between 1 and ${MAX_PAGE_SIZE}.`);
    }
    if (pageToken !== null) assertDocumentId(pageToken, 'pageToken');

    let query = matches
      .where('driverId', '==', driverId)
      .where('status', '==', 'active')
      .select('driverId', 'status')
      .orderBy(admin.firestore.FieldPath.documentId());

    if (pageToken !== null) query = query.startAfter(pageToken);
    const snapshot = await query.limit(pageSize).get();
    const documents = snapshot.docs.map((document) => ({ id: document.id }));
    return {
      matches: documents,
      nextPageToken:
        snapshot.docs.length === pageSize ? snapshot.docs[snapshot.docs.length - 1].id : null,
    };
  };

  const deleteMatchCurrentTracking = async (matchId, owner) => {
    assertDocumentId(matchId, 'matchId');
    assertOwner(owner);

    const matchRef = matches.doc(matchId);
    const trackingRef = matchTrackingRef(matchId);
    return firestore.runTransaction(async (transaction) => {
      const matchSnapshot = await transaction.get(matchRef);
      if (!matchSnapshot.exists) return 'match-missing';
      if (matchSnapshot.get(owner.field) !== owner.uid) return 'denied';
      if (matchSnapshot.get('status') !== 'active') return 'skipped';

      const trackingSnapshot = await transaction.get(trackingRef);
      if (!trackingSnapshot.exists) return 'missing';

      transaction.delete(trackingRef);
      return 'deleted';
    });
  };

  const deleteDriverCurrentTrackingIfActiveMatch = async (matchId, driverId) => {
    assertDocumentId(matchId, 'matchId');
    assertDocumentId(driverId, 'driverId');

    const matchRef = matches.doc(matchId);
    const trackingRef = matchTrackingRef(matchId);
    return firestore.runTransaction(async (transaction) => {
      const matchSnapshot = await transaction.get(matchRef);
      if (!matchSnapshot.exists) return 'match-missing';
      if (matchSnapshot.get('driverId') !== driverId || matchSnapshot.get('status') !== 'active') {
        return 'skipped';
      }

      const trackingSnapshot = await transaction.get(trackingRef);
      if (!trackingSnapshot.exists) return 'missing';

      transaction.delete(trackingRef);
      return 'deleted';
    });
  };

  const deleteMatchCurrentTrackingIfTerminal = async (matchId) => {
    assertDocumentId(matchId, 'matchId');

    const matchRef = matches.doc(matchId);
    const trackingRef = matchTrackingRef(matchId);
    return firestore.runTransaction(async (transaction) => {
      const matchSnapshot = await transaction.get(matchRef);
      if (!matchSnapshot.exists) return 'match-missing';
      if (!TERMINAL_MATCH_STATUSES.has(matchSnapshot.get('status'))) return 'skipped';

      const trackingSnapshot = await transaction.get(trackingRef);
      if (!trackingSnapshot.exists) return 'missing';

      transaction.delete(trackingRef);
      return 'deleted';
    });
  };

  return {
    listActiveMatchesByDriver,
    deleteMatchCurrentTracking,
    deleteDriverCurrentTrackingIfActiveMatch,
    deleteMatchCurrentTrackingIfTerminal,
  };
};

module.exports = {
  createFirestoreGpsCleanupRepository,
};
