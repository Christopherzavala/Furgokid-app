const admin = require('firebase-admin');
const { FieldPath } = require('firebase-admin/firestore');

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
      .orderBy(FieldPath.documentId());

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

  const listMatchesByDriver = async ({ driverId, pageToken = null, pageSize }) => {
    assertDocumentId(driverId, 'driverId');
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
      throw new RangeError(`pageSize must be between 1 and ${MAX_PAGE_SIZE}.`);
    }
    if (pageToken !== null) assertDocumentId(pageToken, 'pageToken');

    let query = matches.where('driverId', '==', driverId).orderBy(FieldPath.documentId());
    if (pageToken !== null) query = query.startAfter(pageToken);

    const snapshot = await query.limit(pageSize).get();
    const documents = snapshot.docs.map((document) => ({ id: document.id }));
    return {
      matches: documents,
      nextPageToken:
        snapshot.docs.length === pageSize ? snapshot.docs[snapshot.docs.length - 1].id : null,
    };
  };

  const deleteDriverCurrentTrackingIfAssigned = async (matchId, driverId) => {
    assertDocumentId(matchId, 'matchId');
    assertDocumentId(driverId, 'driverId');

    const matchRef = matches.doc(matchId);
    const trackingRef = matchTrackingRef(matchId);
    return firestore.runTransaction(async (transaction) => {
      const matchSnapshot = await transaction.get(matchRef);
      if (!matchSnapshot.exists) return 'match-missing';
      if (matchSnapshot.get('driverId') !== driverId) return 'denied';

      const trackingSnapshot = await transaction.get(trackingRef);
      if (!trackingSnapshot.exists) return 'missing';

      transaction.delete(trackingRef);
      return 'deleted';
    });
  };

  const deleteCurrentTrackingByMatchId = async (matchId) => {
    assertDocumentId(matchId, 'matchId');
    const trackingRef = matchTrackingRef(matchId);
    const trackingSnapshot = await trackingRef.get();
    if (!trackingSnapshot.exists) return 'missing';
    await trackingRef.delete();
    return 'deleted';
  };

  const listActiveMatches = async ({ pageToken = null, pageSize }) => {
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
      throw new RangeError(`pageSize must be between 1 and ${MAX_PAGE_SIZE}.`);
    }
    if (pageToken !== null) assertDocumentId(pageToken, 'pageToken');

    let query = matches.where('status', '==', 'active').orderBy(FieldPath.documentId());
    if (pageToken !== null) query = query.startAfter(pageToken);

    const snapshot = await query.limit(pageSize).get();
    return {
      matches: snapshot.docs.map((document) => ({ id: document.id })),
      nextPageToken:
        snapshot.docs.length === pageSize ? snapshot.docs[snapshot.docs.length - 1].id : null,
    };
  };

  const deleteStaleCurrentTracking = async ({ now, staleAfterMs = 10 * 60 * 1000 }) => {
    if (!Number.isFinite(now) || !Number.isFinite(staleAfterMs) || staleAfterMs < 0) {
      throw new TypeError('Valid cleanup timestamps are required.');
    }
    const cutoff = new Date(now - staleAfterMs);
    let pageToken = null;
    let deletedCount = 0;
    let missingCount = 0;
    let skippedCount = 0;
    let complete = true;

    do {
      const page = await listActiveMatches({ pageToken, pageSize: MAX_PAGE_SIZE });
      for (const candidate of page.matches) {
        const matchRef = matches.doc(candidate.id);
        const trackingRef = matchTrackingRef(candidate.id);
        const result = await firestore.runTransaction(async (transaction) => {
          const [matchSnapshot, trackingSnapshot] = await Promise.all([
            transaction.get(matchRef),
            transaction.get(trackingRef),
          ]);
          if (!matchSnapshot.exists || matchSnapshot.get('status') !== 'active') return 'skipped';
          if (!trackingSnapshot.exists) return 'missing';
          const updatedAt = trackingSnapshot.get('updatedAt');
          if (!updatedAt || updatedAt.toDate() > cutoff) return 'skipped';
          transaction.delete(trackingRef);
          return 'deleted';
        });
        if (result === 'deleted') deletedCount += 1;
        else if (result === 'missing') missingCount += 1;
        else skippedCount += 1;
      }
      pageToken = page.nextPageToken;
    } while (pageToken !== null);

    return { complete, deletedCount, missingCount, skippedCount };
  };

  return {
    listActiveMatchesByDriver,
    listMatchesByDriver,
    deleteMatchCurrentTracking,
    deleteDriverCurrentTrackingIfActiveMatch,
    deleteDriverCurrentTrackingIfAssigned,
    deleteMatchCurrentTrackingIfTerminal,
    deleteCurrentTrackingByMatchId,
    listActiveMatches,
    deleteStaleCurrentTracking,
  };
};

module.exports = {
  createFirestoreGpsCleanupRepository,
};
