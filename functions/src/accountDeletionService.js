const crypto = require('node:crypto');
const { FieldValue } = require('firebase-admin/firestore');

const PAGE_SIZE = 200;
const MATCH_PAGE_SIZE = 50;
const CHAT_PAGE_SIZE = 50;
const STORAGE_PAGE_SIZE = 100;
const STORAGE_PREFIXES = Object.freeze(['users/']);
const MESSAGE_AUTHOR_FIELDS = Object.freeze(['authorId', 'senderId', 'userId']);
const VACANCY_NOTIFICATION_COLLECTIONS = Object.freeze([
  'notification_logs',
  'notification_errors',
]);
const LEASE_TTL_MS = 5 * 60 * 1000;
const MAX_REQUESTS_PER_RUN = 20;
const MAX_STEPS_PER_REQUEST = 3;
const REDACTED_PARTICIPANT_PREFIX = 'deleted:';

const DELETION_STATUS = Object.freeze({
  PENDING: 'pending',
  PROCESSING: 'processing',
  FAILED: 'failed',
  COMPLETED: 'completed',
});

const DELETION_PHASE = Object.freeze({
  MATCHES: 'matches',
  VACANCY_NOTIFICATIONS: 'vacancyNotifications',
  COLLECTIONS: 'collections',
  CHATS: 'chats',
  PROFILE: 'profile',
  STORAGE: 'storage',
  VERIFICATION: 'verification',
  AUTH: 'auth',
  COMPLETED: 'completed',
});

const COLLECTIONS_TO_CLEAN = Object.freeze([
  { collection: 'routes', field: 'driverId' },
  { collection: 'requests', field: 'parentId' },
  { collection: 'trackingPoints', field: 'userId' },
  { collection: 'vacancies', field: 'driverId' },
  { collection: 'notifications', field: 'userId' },
  { collection: 'notification_logs', field: 'driverId' },
  { collection: 'notification_errors', field: 'driverId' },
  { collection: 'devices', field: 'userId' },
  { collection: 'tokens', field: 'userId' },
]);

const PARENT_PII_FIELDS = Object.freeze([
  'parentName',
  'parentPhone',
  'parentEmail',
  'parentAddress',
  'school',
  'zone',
  'schedule',
  'childrenCount',
  'childrenNames',
  'childrenAges',
  'ages',
  'specialNeeds',
]);

const DRIVER_PII_FIELDS = Object.freeze([
  'driverName',
  'driverPhone',
  'driverEmail',
  'vehicleModel',
  'licensePlate',
]);

const SAFE_ERROR_CODES = new Set([
  'active-match',
  'already-completed',
  'auth-delete-failed',
  'cleanup-incomplete',
  'in-progress',
  'internal',
  'invalid-data',
  'lease-lost',
  'reservation-exists',
  'storage-delete-failed',
  'unavailable',
]);

class AccountDeletionError extends Error {
  constructor(code, retryable = true) {
    super(code);
    this.code = code;
    this.retryable = retryable;
  }
}

const validUid = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 1500 &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/');

const hashUid = (uid) => crypto.createHash('sha256').update(uid).digest('hex');
const redactedParticipant = (uid) => `${REDACTED_PARTICIPANT_PREFIX}${hashUid(uid).slice(0, 24)}`;

const safeErrorCode = (error) => {
  const rawCode = typeof error?.code === 'string' ? error.code.toLowerCase() : '';
  if (rawCode === 'auth/user-not-found') return 'not-found';
  if (SAFE_ERROR_CODES.has(rawCode)) return rawCode;
  if (error instanceof AccountDeletionError && SAFE_ERROR_CODES.has(error.code)) {
    return error.code;
  }
  return 'internal';
};

const publicState = (state) => {
  if (!state) return { status: 'none' };
  const status = Object.values(DELETION_STATUS).includes(state.status)
    ? state.status
    : DELETION_STATUS.FAILED;
  const phase = Object.values(DELETION_PHASE).includes(state.phase) ? state.phase : null;
  const errorCode =
    status === DELETION_STATUS.FAILED && SAFE_ERROR_CODES.has(state.lastErrorCode)
      ? state.lastErrorCode
      : null;
  const updatedAt =
    state.updatedAt && typeof state.updatedAt.toDate === 'function'
      ? state.updatedAt.toDate().toISOString()
      : null;
  return { status, phase, errorCode, updatedAt };
};

const createAccountDeletionService = ({
  firestore,
  auth,
  storage,
  storageBucket = null,
  logger = () => {},
  now = () => Date.now(),
  serverTimestamp = FieldValue.serverTimestamp,
}) => {
  if (!firestore || typeof firestore.collection !== 'function') {
    throw new TypeError('A Firebase Admin Firestore instance is required.');
  }
  if (!auth || typeof auth.getUser !== 'function' || typeof auth.deleteUser !== 'function') {
    throw new TypeError('A Firebase Admin Auth instance is required.');
  }
  if (!storage || typeof storage.bucket !== 'function') {
    throw new TypeError('A Firebase Admin Storage instance is required.');
  }

  const states = firestore.collection('accountDeletionRequests');
  const receipts = firestore.collection('accountDeletionReceipts');
  const users = firestore.collection('users');
  const matches = firestore.collection('matches');
  const chats = firestore.collection('chats');
  const getBucket = () => storage.bucket(storageBucket || undefined);

  const stateRef = (uid) => states.doc(uid);
  const receiptRef = (uid) => receipts.doc(uid);
  const assertUid = (uid) => {
    if (!validUid(uid)) throw new AccountDeletionError('invalid-data', false);
  };
  const leaseIsActive = (lease, currentTime) =>
    lease && lease.ownerToken && lease.expiresAt > currentTime;
  const assertLease = (state, ownerToken, currentTime) => {
    if (
      !state ||
      state.lease?.ownerToken !== ownerToken ||
      !leaseIsActive(state.lease, currentTime)
    ) {
      throw new AccountDeletionError('lease-lost', true);
    }
  };
  const getState = async (uid) => {
    assertUid(uid);
    const snapshot = await stateRef(uid).get();
    return snapshot.exists ? snapshot.data() : null;
  };
  const createOrResumeRequest = async (uid) => {
    assertUid(uid);
    const requestId = crypto.randomUUID();
    let shouldRun = true;
    let completed = false;
    await firestore.runTransaction(async (transaction) => {
      const reference = stateRef(uid);
      const snapshot = await transaction.get(reference);
      if (snapshot.exists) {
        const existing = snapshot.data();
        if (
          existing.status === DELETION_STATUS.PROCESSING &&
          leaseIsActive(existing.lease, now())
        ) {
          shouldRun = false;
        }
        if (existing.status === DELETION_STATUS.FAILED) {
          transaction.update(reference, {
            status: DELETION_STATUS.PENDING,
            lastErrorCode: null,
            retryable: true,
            updatedAt: serverTimestamp(),
          });
        }
        return;
      }
      const receiptSnapshot = await transaction.get(receiptRef(uid));
      if (receiptSnapshot.exists) {
        shouldRun = false;
        completed = true;
        return;
      }
      transaction.create(reference, {
        requestId,
        status: DELETION_STATUS.PENDING,
        phase: DELETION_PHASE.MATCHES,
        checkpoint: {
          collectionIndex: 0,
          counters: {
            matches: 0,
            vacancyNotifications: 0,
            firestore: 0,
            chats: 0,
            storage: 0,
          },
        },
        lease: null,
        attempts: 0,
        retryable: true,
        lastErrorCode: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    if (completed) {
      return {
        state: {
          status: DELETION_STATUS.COMPLETED,
          phase: DELETION_PHASE.COMPLETED,
          updatedAt: serverTimestamp(),
        },
        shouldRun: false,
      };
    }
    return { state: await getState(uid), shouldRun };
  };
  const acquireLease = async (uid) => {
    assertUid(uid);
    const ownerToken = crypto.randomUUID();
    const currentTime = now();
    await firestore.runTransaction(async (transaction) => {
      const reference = stateRef(uid);
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) throw new AccountDeletionError('invalid-data', false);
      const state = snapshot.data();
      if (state.status === DELETION_STATUS.COMPLETED) {
        throw new AccountDeletionError('already-completed', false);
      }
      if (leaseIsActive(state.lease, currentTime)) {
        throw new AccountDeletionError('in-progress', true);
      }
      transaction.update(reference, {
        status: DELETION_STATUS.PROCESSING,
        lease: {
          ownerToken,
          acquiredAt: currentTime,
          expiresAt: currentTime + LEASE_TTL_MS,
        },
        attempts: (state.attempts || 0) + 1,
        lastErrorCode: null,
        updatedAt: serverTimestamp(),
      });
    });
    return ownerToken;
  };
  const releaseLease = async (uid, ownerToken) => {
    const reference = stateRef(uid);
    await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return;
      const state = snapshot.data();
      if (state.lease?.ownerToken !== ownerToken) return;
      transaction.update(reference, {
        status:
          state.status === DELETION_STATUS.FAILED
            ? DELETION_STATUS.FAILED
            : DELETION_STATUS.PENDING,
        lease: null,
        updatedAt: serverTimestamp(),
      });
    });
  };
  const renewLease = async (uid, ownerToken) => {
    const reference = stateRef(uid);
    const currentTime = now();
    await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) throw new AccountDeletionError('lease-lost', true);
      const state = snapshot.data();
      assertLease(state, ownerToken, currentTime);
      transaction.update(reference, {
        lease: {
          ...state.lease,
          expiresAt: currentTime + LEASE_TTL_MS,
        },
        updatedAt: serverTimestamp(),
      });
    });
  };

  const buildMatchDeletionUpdate = (match, uid) => {
    const update = {};
    if (match.driverId === uid) {
      update.driverId = redactedParticipant(uid);
      for (const field of DRIVER_PII_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(match, field)) update[field] = FieldValue.delete();
      }
    }
    if (match.parentId === uid) {
      update.parentId = redactedParticipant(uid);
      for (const field of PARENT_PII_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(match, field)) update[field] = FieldValue.delete();
      }
    }
    if (match.cancelledBy === uid) update.cancelledBy = redactedParticipant(uid);
    if (match.parentId === uid && match.requestId) update.requestId = FieldValue.delete();
    if (match.driverId === uid && match.vacancyId) update.vacancyId = FieldValue.delete();
    return update;
  };
  const getMatchPage = async (uid) => {
    const driverQuery = matches.where('driverId', '==', uid).limit(MATCH_PAGE_SIZE);
    const parentQuery = matches.where('parentId', '==', uid).limit(MATCH_PAGE_SIZE);
    const [driverSnapshot, parentSnapshot] = await Promise.all([
      driverQuery.get(),
      parentQuery.get(),
    ]);
    const documents = new Map();
    for (const document of [...driverSnapshot.docs, ...parentSnapshot.docs]) {
      documents.set(document.id, document);
    }
    return [...documents.values()].slice(0, MATCH_PAGE_SIZE);
  };

  const reconcileMatch = async (uid, matchId, ownerToken) => {
    const matchRef = matches.doc(matchId);
    return firestore.runTransaction(async (transaction) => {
      const stateSnapshot = await transaction.get(stateRef(uid));
      if (!stateSnapshot.exists) throw new AccountDeletionError('invalid-data', false);
      assertLease(stateSnapshot.data(), ownerToken, now());
      const matchSnapshot = await transaction.get(matchRef);
      if (!matchSnapshot.exists) return 'missing';
      const match = matchSnapshot.data();
      const isDriver = match.driverId === uid;
      const isParent = match.parentId === uid;
      if (!isDriver && !isParent) return 'not-owned';

      if (match.status === 'active') {
        throw new AccountDeletionError('active-match', false);
      }
      if (match.status === 'pending') {
        const requestRef = firestore.collection('requests').doc(match.requestId);
        const vacancyRef = firestore.collection('vacancies').doc(match.vacancyId);
        const trackingRef = matchRef.collection('tracking').doc('current');
        const [requestSnapshot, vacancySnapshot, trackingSnapshot] = await Promise.all([
          transaction.get(requestRef),
          transaction.get(vacancyRef),
          transaction.get(trackingRef),
        ]);
        if (!requestSnapshot.exists || !vacancySnapshot.exists) {
          throw new AccountDeletionError('invalid-data', false);
        }
        const request = requestSnapshot.data();
        const vacancy = vacancySnapshot.data();
        if (
          request.parentId !== match.parentId ||
          vacancy.driverId !== match.driverId ||
          match.capacityReservationStatus !== 'unreserved' ||
          match.reservedSeats !== 0
        ) {
          throw new AccountDeletionError('invalid-data', false);
        }
        transaction.update(matchRef, {
          status: 'cancelled',
          capacityReservationStatus: 'unreserved',
          cancelledBy: redactedParticipant(uid),
          cancelledAt: serverTimestamp(),
          completedAt: FieldValue.delete(),
          updatedAt: serverTimestamp(),
          ...buildMatchDeletionUpdate(match, uid),
        });
        if (request.activeMatchId === matchId) {
          transaction.update(requestRef, {
            activeMatchId: FieldValue.delete(),
            updatedAt: serverTimestamp(),
          });
        }
        if (trackingSnapshot.exists) transaction.delete(trackingRef);
        return 'cancelled';
      }
      if (match.status === 'completed' || match.status === 'cancelled') {
        const trackingRef = matchRef.collection('tracking').doc('current');
        const trackingSnapshot = await transaction.get(trackingRef);
        transaction.update(matchRef, {
          updatedAt: serverTimestamp(),
          ...buildMatchDeletionUpdate(match, uid),
        });
        if (trackingSnapshot.exists) transaction.delete(trackingRef);
        return 'anonymized';
      }
      throw new AccountDeletionError('invalid-data', false);
    });
  };

  const cleanupMatches = async (uid, ownerToken) => {
    const documents = await getMatchPage(uid);
    if (documents.length === 0) return { completed: true, count: 0 };
    let count = 0;
    for (const document of documents) {
      const outcome = await reconcileMatch(uid, document.id, ownerToken);
      if (outcome === 'cancelled' || outcome === 'anonymized') count += 1;
    }
    return { completed: documents.length < MATCH_PAGE_SIZE, count };
  };

  const deleteOwnedDocuments = async (uid, ownerToken, collectionName, field) => {
    const collectionRef = firestore.collection(collectionName);
    const snapshot = await collectionRef.where(field, '==', uid).limit(PAGE_SIZE).get();
    if (snapshot.empty) return { completed: true, count: 0 };

    await firestore.runTransaction(async (transaction) => {
      const stateSnapshot = await transaction.get(stateRef(uid));
      if (!stateSnapshot.exists) throw new AccountDeletionError('invalid-data', false);
      assertLease(stateSnapshot.data(), ownerToken, now());
      const freshSnapshots = [];
      for (const document of snapshot.docs) {
        freshSnapshots.push(await transaction.get(document.ref));
      }
      for (const freshSnapshot of freshSnapshots) {
        if (freshSnapshot.exists && freshSnapshot.get(field) === uid) {
          transaction.delete(freshSnapshot.ref);
        }
      }
    });
    return { completed: snapshot.size < PAGE_SIZE, count: snapshot.size };
  };
  const getOwnedVacancyPage = async (uid, cursor) => {
    let query = firestore.collection('vacancies').orderBy('__name__').limit(PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    return {
      vacancyIds: snapshot.docs
        .filter((document) => document.get('driverId') === uid)
        .map((document) => document.id),
      cursor: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1].id : null,
      completed: snapshot.size < PAGE_SIZE,
    };
  };

  const deleteVacancyNotificationRecords = async (uid, ownerToken, vacancyId, collectionName) => {
    const snapshot = await firestore
      .collection(collectionName)
      .where('vacancyId', '==', vacancyId)
      .limit(PAGE_SIZE)
      .get();
    if (snapshot.empty) return { completed: true, count: 0 };

    let deletedCount = 0;
    await firestore.runTransaction(async (transaction) => {
      const stateSnapshot = await transaction.get(stateRef(uid));
      if (!stateSnapshot.exists) throw new AccountDeletionError('invalid-data', false);
      assertLease(stateSnapshot.data(), ownerToken, now());

      const freshSnapshots = [];
      for (const document of snapshot.docs) {
        freshSnapshots.push(await transaction.get(document.ref));
      }
      for (const freshSnapshot of freshSnapshots) {
        if (freshSnapshot.exists && freshSnapshot.get('vacancyId') === vacancyId) {
          transaction.delete(freshSnapshot.ref);
          deletedCount += 1;
        }
      }
    });
    return { completed: snapshot.size < PAGE_SIZE, count: deletedCount };
  };
  const getChatPage = async (uid) => {
    const snapshot = await chats
      .where('participants', 'array-contains', uid)
      .limit(CHAT_PAGE_SIZE)
      .get();
    return snapshot.docs;
  };

  const cleanupChats = async (uid, ownerToken) => {
    const documents = await getChatPage(uid);
    if (documents.length === 0) return { completed: true, count: 0 };
    let count = 0;
    for (const document of documents) {
      const chatRef = document.ref;
      const chatSnapshot = await chatRef.get();
      if (!chatSnapshot.exists) continue;
      const chat = chatSnapshot.data();
      if (!Array.isArray(chat.participants) || !chat.participants.includes(uid)) continue;
      const messagesRef = chatRef.collection('messages');
      const isExclusive = chat.participants.length === 1;
      let cursor;
      let deletedMessages = 0;
      let hasMoreMessages = true;
      while (hasMoreMessages) {
        let query = messagesRef.orderBy('__name__');
        if (cursor) query = query.startAfter(cursor);
        const page = await query.limit(CHAT_PAGE_SIZE).get();
        const result = await firestore.runTransaction(async (transaction) => {
          const stateSnapshot = await transaction.get(stateRef(uid));
          if (!stateSnapshot.exists) throw new AccountDeletionError('invalid-data', false);
          assertLease(stateSnapshot.data(), ownerToken, now());
          const freshChatSnapshot = await transaction.get(chatRef);
          if (!freshChatSnapshot.exists) return 'missing';
          const freshChat = freshChatSnapshot.data();
          if (!Array.isArray(freshChat.participants) || !freshChat.participants.includes(uid)) {
            return 'not-owned';
          }
          const freshSnapshots = [];
          for (const message of page.docs) {
            freshSnapshots.push(await transaction.get(message.ref));
          }
          let pageDeletions = 0;
          for (const freshSnapshot of freshSnapshots) {
            if (!freshSnapshot.exists) continue;
            const data = freshSnapshot.data();
            const authoredByUser = MESSAGE_AUTHOR_FIELDS.some((field) => data[field] === uid);
            if (isExclusive || authoredByUser) {
              transaction.delete(freshSnapshot.ref);
              pageDeletions += 1;
            }
          }
          return pageDeletions;
        });
        if (result === 'missing' || result === 'not-owned') break;
        deletedMessages += result;
        hasMoreMessages = page.size === CHAT_PAGE_SIZE;
        if (hasMoreMessages) cursor = page.docs[page.docs.length - 1];
      }
      const result = await firestore.runTransaction(async (transaction) => {
        const stateSnapshot = await transaction.get(stateRef(uid));
        if (!stateSnapshot.exists) throw new AccountDeletionError('invalid-data', false);
        assertLease(stateSnapshot.data(), ownerToken, now());
        const freshChatSnapshot = await transaction.get(chatRef);
        if (!freshChatSnapshot.exists) return 'missing';
        const freshChat = freshChatSnapshot.data();
        if (!Array.isArray(freshChat.participants) || !freshChat.participants.includes(uid)) {
          return 'not-owned';
        }
        if (isExclusive) {
          transaction.delete(chatRef);
        } else {
          transaction.update(chatRef, {
            participants: freshChat.participants.filter((participant) => participant !== uid),
            updatedAt: serverTimestamp(),
          });
        }
        return deletedMessages > 0 ? 'deleted-messages' : 'updated';
      });
      if (result !== 'missing' && result !== 'not-owned') count += 1;
    }
    return { completed: documents.length < CHAT_PAGE_SIZE, count };
  };

  const deleteProfile = async (uid, ownerToken) => {
    await firestore.runTransaction(async (transaction) => {
      const stateSnapshot = await transaction.get(stateRef(uid));
      if (!stateSnapshot.exists) throw new AccountDeletionError('invalid-data', false);
      assertLease(stateSnapshot.data(), ownerToken, now());
      transaction.delete(users.doc(uid));
    });
    return { completed: true, count: 1 };
  };

  const listStorageFiles = async (uid) => {
    const files = [];
    const prefixes = [];
    for (const storagePrefix of STORAGE_PREFIXES) {
      const prefix = `${storagePrefix}${uid}/`;
      const [page] = await getBucket().getFiles({
        prefix,
        maxResults: STORAGE_PAGE_SIZE,
        autoPaginate: false,
      });
      files.push(...page);
      prefixes.push(prefix);
    }
    return { files, prefixes };
  };

  const cleanupStorage = async (uid, ownerToken) => {
    await renewLease(uid, ownerToken);
    const { files, prefixes } = await listStorageFiles(uid);
    if (files.length === 0) return { completed: true, count: 0 };
    for (const file of files) {
      if (!prefixes.some((prefix) => file.name.startsWith(prefix))) {
        throw new AccountDeletionError('storage-delete-failed', true);
      }
      await renewLease(uid, ownerToken);
      try {
        await file.delete({ ignoreNotFound: true });
      } catch (error) {
        throw new AccountDeletionError('storage-delete-failed', true);
      }
    }
    return { completed: files.length < STORAGE_PAGE_SIZE, count: files.length };
  };

  const verifyNoResidualData = async (uid) => {
    for (const { collection: collectionName, field } of COLLECTIONS_TO_CLEAN) {
      const snapshot = await firestore
        .collection(collectionName)
        .where(field, '==', uid)
        .limit(1)
        .get();
      if (!snapshot.empty) return false;
    }
    const [driverMatches, parentMatches, chatSnapshot, profileSnapshot] = await Promise.all([
      matches.where('driverId', '==', uid).limit(1).get(),
      matches.where('parentId', '==', uid).limit(1).get(),
      chats.where('participants', 'array-contains', uid).limit(1).get(),
      users.doc(uid).get(),
    ]);
    if (
      !driverMatches.empty ||
      !parentMatches.empty ||
      !chatSnapshot.empty ||
      profileSnapshot.exists
    ) {
      return false;
    }
    const { files } = await listStorageFiles(uid);
    return files.length === 0;
  };

  const deleteAuthUser = async (uid) => {
    try {
      await auth.deleteUser(uid);
    } catch (error) {
      if (error?.code === 'auth/user-not-found') return;
      throw new AccountDeletionError('auth-delete-failed', true);
    }
  };

  const writeReceiptAndDeleteState = async (uid, ownerToken) => {
    const reference = stateRef(uid);
    await firestore.runTransaction(async (transaction) => {
      const stateSnapshot = await transaction.get(reference);
      if (!stateSnapshot.exists) throw new AccountDeletionError('invalid-data', false);
      const state = stateSnapshot.data();
      assertLease(state, ownerToken, now());
      const completedAt = serverTimestamp();
      transaction.set(receiptRef(uid), {
        requestId: state.requestId,
        status: DELETION_STATUS.COMPLETED,
        phase: DELETION_PHASE.COMPLETED,
        completedAt,
        updatedAt: completedAt,
      });
      transaction.delete(reference);
    });
  };
  const saveCheckpoint = async (uid, ownerToken, updates) => {
    await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(stateRef(uid));
      if (!snapshot.exists) throw new AccountDeletionError('invalid-data', false);
      const state = snapshot.data();
      assertLease(state, ownerToken, now());
      transaction.update(stateRef(uid), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    });
  };

  const runOneStep = async (uid, ownerToken) => {
    const state = await getState(uid);
    if (!state) throw new AccountDeletionError('invalid-data', false);
    assertLease(state, ownerToken, now());
    const checkpoint = state.checkpoint || {
      collectionIndex: 0,
      counters: { matches: 0, firestore: 0, chats: 0, storage: 0 },
    };
    const counters = checkpoint.counters || {
      matches: 0,
      vacancyNotifications: 0,
      firestore: 0,
      chats: 0,
      storage: 0,
    };

    if (state.phase === DELETION_PHASE.MATCHES) {
      const result = await cleanupMatches(uid, ownerToken);
      counters.matches += result.count;
      await saveCheckpoint(uid, ownerToken, {
        phase: result.completed ? DELETION_PHASE.VACANCY_NOTIFICATIONS : DELETION_PHASE.MATCHES,
        checkpoint: { ...checkpoint, collectionIndex: 0, counters },
      });
      return;
    }

    if (state.phase === DELETION_PHASE.VACANCY_NOTIFICATIONS) {
      const notificationCheckpoint = checkpoint.vacancyNotifications || {
        vacancyCursor: null,
        vacancyIds: [],
        collectionIndex: 0,
      };
      let vacancyIds = notificationCheckpoint.vacancyIds || [];
      let vacancyCursor = notificationCheckpoint.vacancyCursor || null;
      let collectionIndex = notificationCheckpoint.collectionIndex || 0;

      if (vacancyIds.length === 0) {
        const page = await getOwnedVacancyPage(uid, vacancyCursor);
        vacancyIds = page.vacancyIds;
        vacancyCursor = page.cursor;
        if (vacancyIds.length === 0) {
          await saveCheckpoint(uid, ownerToken, {
            phase: page.completed
              ? DELETION_PHASE.COLLECTIONS
              : DELETION_PHASE.VACANCY_NOTIFICATIONS,
            checkpoint: {
              ...checkpoint,
              counters,
              vacancyNotifications: {
                vacancyCursor,
                vacancyIds,
                collectionIndex,
              },
            },
          });
          return;
        }
      }

      const vacancyId = vacancyIds[0];
      const collectionName = VACANCY_NOTIFICATION_COLLECTIONS[collectionIndex];
      const result = await deleteVacancyNotificationRecords(
        uid,
        ownerToken,
        vacancyId,
        collectionName
      );
      counters.vacancyNotifications += result.count;

      if (!result.completed) {
        await saveCheckpoint(uid, ownerToken, {
          phase: DELETION_PHASE.VACANCY_NOTIFICATIONS,
          checkpoint: {
            ...checkpoint,
            counters,
            vacancyNotifications: {
              vacancyCursor,
              vacancyIds,
              collectionIndex,
            },
          },
        });
        return;
      }

      if (collectionIndex + 1 < VACANCY_NOTIFICATION_COLLECTIONS.length) {
        await saveCheckpoint(uid, ownerToken, {
          phase: DELETION_PHASE.VACANCY_NOTIFICATIONS,
          checkpoint: {
            ...checkpoint,
            counters,
            vacancyNotifications: {
              vacancyCursor,
              vacancyIds,
              collectionIndex: collectionIndex + 1,
            },
          },
        });
        return;
      }

      await saveCheckpoint(uid, ownerToken, {
        phase: DELETION_PHASE.VACANCY_NOTIFICATIONS,
        checkpoint: {
          ...checkpoint,
          counters,
          vacancyNotifications: {
            vacancyCursor,
            vacancyIds: vacancyIds.slice(1),
            collectionIndex: 0,
          },
        },
      });
      return;
    }

    if (state.phase === DELETION_PHASE.COLLECTIONS) {
      const collectionIndex = checkpoint.collectionIndex || 0;
      if (collectionIndex >= COLLECTIONS_TO_CLEAN.length) {
        await saveCheckpoint(uid, ownerToken, {
          phase: DELETION_PHASE.CHATS,
          checkpoint: { ...checkpoint, counters },
        });
        return;
      }
      const target = COLLECTIONS_TO_CLEAN[collectionIndex];
      const result = await deleteOwnedDocuments(uid, ownerToken, target.collection, target.field);
      counters.firestore += result.count;
      const nextCollectionIndex = result.completed ? collectionIndex + 1 : collectionIndex;
      await saveCheckpoint(uid, ownerToken, {
        phase:
          nextCollectionIndex >= COLLECTIONS_TO_CLEAN.length
            ? DELETION_PHASE.CHATS
            : DELETION_PHASE.COLLECTIONS,
        checkpoint: { ...checkpoint, collectionIndex: nextCollectionIndex, counters },
      });
      return;
    }

    if (state.phase === DELETION_PHASE.CHATS) {
      const result = await cleanupChats(uid, ownerToken);
      counters.chats += result.count;
      await saveCheckpoint(uid, ownerToken, {
        phase: result.completed ? DELETION_PHASE.PROFILE : DELETION_PHASE.CHATS,
        checkpoint: { ...checkpoint, counters },
      });
      return;
    }

    if (state.phase === DELETION_PHASE.PROFILE) {
      await deleteProfile(uid, ownerToken);
      await saveCheckpoint(uid, ownerToken, {
        phase: DELETION_PHASE.STORAGE,
        checkpoint: { ...checkpoint, counters },
      });
      return;
    }

    if (state.phase === DELETION_PHASE.STORAGE) {
      const result = await cleanupStorage(uid, ownerToken);
      counters.storage += result.count;
      await saveCheckpoint(uid, ownerToken, {
        phase: result.completed ? DELETION_PHASE.VERIFICATION : DELETION_PHASE.STORAGE,
        checkpoint: { ...checkpoint, counters },
      });
      return;
    }

    if (state.phase === DELETION_PHASE.VERIFICATION) {
      const clean = await verifyNoResidualData(uid);
      if (!clean) throw new AccountDeletionError('cleanup-incomplete', true);
      await saveCheckpoint(uid, ownerToken, {
        phase: DELETION_PHASE.AUTH,
        checkpoint: { ...checkpoint, counters },
      });
      return;
    }

    if (state.phase === DELETION_PHASE.AUTH) {
      await deleteAuthUser(uid);
      await writeReceiptAndDeleteState(uid, ownerToken);
      return;
    }

    throw new AccountDeletionError('invalid-data', false);
  };
  const runDeletion = async (uid, options = {}) => {
    assertUid(uid);
    const maxSteps = Math.max(
      1,
      Math.min(
        Number.isSafeInteger(options.maxSteps) ? options.maxSteps : MAX_STEPS_PER_REQUEST,
        10
      )
    );
    const ownerToken = await acquireLease(uid);
    try {
      for (let step = 0; step < maxSteps; step += 1) {
        const state = await getState(uid);
        if (!state) return { status: DELETION_STATUS.COMPLETED };
        await runOneStep(uid, ownerToken);
        const nextState = await getState(uid);
        if (!nextState) return { status: DELETION_STATUS.COMPLETED };
        if (nextState.phase === DELETION_PHASE.COMPLETED) {
          return { status: DELETION_STATUS.COMPLETED };
        }
      }
      return { status: DELETION_STATUS.PENDING };
    } catch (error) {
      const code = safeErrorCode(error);
      const retryable = error instanceof AccountDeletionError ? error.retryable : true;
      await saveCheckpoint(uid, ownerToken, {
        status: DELETION_STATUS.FAILED,
        lastErrorCode: code,
        retryable,
      }).catch(() => {});
      logger({ operation: 'account_deletion', result: 'failed', errorCode: code });
      throw error;
    } finally {
      await releaseLease(uid, ownerToken).catch(() => {});
    }
  };

  const requestDeletion = async (uid, options = {}) => {
    const { state, shouldRun } = await createOrResumeRequest(uid);
    if (!shouldRun) return publicState(state);
    try {
      await runDeletion(uid, options);
    } catch (error) {
      if (error instanceof AccountDeletionError && !error.retryable) throw error;
    }
    return getDeletionStatus(uid);
  };

  const isDeletionPending = async (uid) => {
    const state = await getState(uid);
    return (
      state && state.status !== DELETION_STATUS.COMPLETED && state.status !== DELETION_STATUS.FAILED
    );
  };

  const getDeletionStatus = async (uid) => {
    const state = await getState(uid);
    if (state) return publicState(state);
    const receipt = await receiptRef(uid).get();
    return receipt.exists ? publicState(receipt.data()) : { status: 'none' };
  };

  const resumePendingRequests = async (options = {}) => {
    const [pendingSnapshot, failedSnapshot, processingSnapshot] = await Promise.all([
      states.where('status', '==', DELETION_STATUS.PENDING).limit(MAX_REQUESTS_PER_RUN).get(),
      states.where('status', '==', DELETION_STATUS.FAILED).limit(MAX_REQUESTS_PER_RUN).get(),
      states.where('status', '==', DELETION_STATUS.PROCESSING).limit(MAX_REQUESTS_PER_RUN).get(),
    ]);
    const candidates = [
      ...pendingSnapshot.docs,
      ...failedSnapshot.docs.filter((document) => document.data().retryable === true),
      ...processingSnapshot.docs.filter((document) => !leaseIsActive(document.data().lease, now())),
    ]
      .map((document) => ({ id: document.id, state: document.data() }))
      .slice(0, MAX_REQUESTS_PER_RUN);
    const results = [];
    for (const candidate of candidates) {
      try {
        await runDeletion(candidate.id, options);
        results.push({ requestId: candidate.state.requestId, status: 'processed' });
      } catch (error) {
        results.push({
          requestId: candidate.state.requestId,
          status: 'failed',
          errorCode: safeErrorCode(error),
        });
      }
    }
    return { processed: results.length, results };
  };

  return {
    requestDeletion,
    getDeletionStatus,
    isDeletionPending,
    resumePendingRequests,
    getState,
    createOrResumeRequest,
    acquireLease,
    releaseLease,
    renewLease,
    cleanupMatches,
    cleanupChats,
    cleanupStorage,
    verifyNoResidualData,
    deleteAuthUser,
    DELETION_PHASE,
    DELETION_STATUS,
  };
};

module.exports = {
  createAccountDeletionService,
  AccountDeletionError,
  COLLECTIONS_TO_CLEAN,
  DELETION_PHASE,
  DELETION_STATUS,
  PAGE_SIZE,
  MATCH_PAGE_SIZE,
  CHAT_PAGE_SIZE,
  STORAGE_PAGE_SIZE,
  LEASE_TTL_MS,
  MAX_REQUESTS_PER_RUN,
  MAX_STEPS_PER_REQUEST,
  validUid,
  hashUid,
  redactedParticipant,
  safeErrorCode,
  publicState,
};
