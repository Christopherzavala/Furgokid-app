const admin = require('firebase-admin');
const {
  createAccountDeletionService,
  DELETION_PHASE,
  DELETION_STATUS,
  redactedParticipant,
} = require('../src/accountDeletionService');

const projectId = process.env.ACCOUNT_DELETION_EMULATOR_PROJECT_ID || '';
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '';
const emulatorEnabled = process.env.ACCOUNT_DELETION_EMULATOR === 'true';
const emulatorDescribe = emulatorEnabled ? describe : describe.skip;

jest.setTimeout(120000);

if (
  emulatorEnabled &&
  (!projectId.startsWith('demo-') || !/^127\.0\.0\.1:8080$|^localhost:8080$/i.test(firestoreHost))
) {
  throw new Error('Account deletion tests require the local demo Firestore emulator.');
}

emulatorDescribe('account deletion service (Firestore Emulator)', () => {
  let app;
  let firestore;
  let service;
  let deletedAuthUsers;
  let observedFirestoreErrors;
  const prefix = `account-deletion-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(() => {
    app = admin.initializeApp({ projectId }, `account-deletion-${Date.now()}`);
    firestore = admin.firestore(app);
    deletedAuthUsers = [];
    const auth = {
      getUser: jest.fn(async (uid) => ({ uid })),
      deleteUser: jest.fn(async (uid) => {
        deletedAuthUsers.push(uid);
      }),
    };
    const storage = {
      bucket: jest.fn(() => ({
        getFiles: jest.fn(async () => [[], null]),
      })),
    };
    observedFirestoreErrors = [];
    const observedFirestore = {
      collection: firestore.collection.bind(firestore),
      runTransaction: async (updateFunction, options) => {
        try {
          return await firestore.runTransaction(updateFunction, options);
        } catch (error) {
          observedFirestoreErrors.push(error);
          throw error;
        }
      },
    };
    service = createAccountDeletionService({
      firestore: observedFirestore,
      auth,
      storage,
      storageBucket: `${projectId}.appspot.com`,
    });
  });

  afterAll(async () => {
    if (app) await app.delete();
  });

  const seedPendingState = async (uid, phase, checkpoint = {}) => {
    await firestore
      .collection('accountDeletionRequests')
      .doc(uid)
      .set({
        requestId: `${prefix}-request-${uid}`,
        status: DELETION_STATUS.PENDING,
        phase,
        checkpoint: {
          collectionIndex: 0,
          counters: {
            matches: 0,
            vacancyNotifications: 0,
            firestore: 0,
            chats: 0,
            storage: 0,
          },
          ...checkpoint,
        },
        lease: null,
        attempts: 0,
        retryable: true,
        lastErrorCode: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
  };

  test('resumes from the persisted phase and collection checkpoint', async () => {
    const uid = `${prefix}-checkpoint-user`;
    await firestore.collection('routes').doc(`${prefix}-route`).set({ driverId: uid });
    await seedPendingState(uid, DELETION_PHASE.COLLECTIONS, {
      collectionIndex: 0,
    });

    const publicStatus = await service.requestDeletion(uid, { maxSteps: 1 });
    const state = await service.getState(uid);

    expect(publicStatus.status).toBe(DELETION_STATUS.PENDING);
    expect(state.phase).toBe(DELETION_PHASE.COLLECTIONS);
    expect(state.checkpoint.collectionIndex).toBe(1);
    expect((await firestore.collection('routes').doc(`${prefix}-route`).get()).exists).toBe(false);
  });

  test('keeps vacancy-notification checkpoints until every page is deleted', async () => {
    const uid = `${prefix}-vacancy-user`;
    const vacancyId = `${prefix}-vacancy`;
    await firestore.collection('vacancies').doc(vacancyId).set({ driverId: uid });
    for (let index = 0; index < 201; index += 1) {
      await firestore.collection('notification_logs').doc(`${prefix}-log-${index}`).set({
        vacancyId,
        driverId: uid,
        index,
      });
    }
    await seedPendingState(uid, DELETION_PHASE.VACANCY_NOTIFICATIONS);

    await service.requestDeletion(uid, { maxSteps: 1 });
    let state = await service.getState(uid);
    let remainingLogs = await firestore
      .collection('notification_logs')
      .where('vacancyId', '==', vacancyId)
      .get();

    expect(
      observedFirestoreErrors.map((error) => ({
        code: error.code,
        message: error.message,
      }))
    ).toEqual([]);
    expect(state).toMatchObject({
      phase: DELETION_PHASE.VACANCY_NOTIFICATIONS,
      lastErrorCode: null,
      checkpoint: {
        vacancyNotifications: {
          vacancyIds: [vacancyId],
          collectionIndex: 0,
        },
      },
    });
    expect(state.checkpoint.vacancyNotifications.collectionIndex).toBe(0);
    expect(remainingLogs.size).toBe(1);

    await service.requestDeletion(uid, { maxSteps: 1 });
    state = await service.getState(uid);
    remainingLogs = await firestore
      .collection('notification_logs')
      .where('vacancyId', '==', vacancyId)
      .get();

    expect(state.phase).toBe(DELETION_PHASE.VACANCY_NOTIFICATIONS);
    expect(state.checkpoint.vacancyNotifications.collectionIndex).toBe(1);
    expect(remainingLogs.size).toBe(0);
  });

  test('deletes multiple authored chat messages in one transactional page', async () => {
    const uid = `${prefix}-chat-user`;
    const chatRef = firestore.collection('chats').doc(`${prefix}-chat`);
    await chatRef.set({ participants: [uid, `${prefix}-chat-participant`] });
    await chatRef.collection('messages').doc(`${prefix}-message-1`).set({
      authorId: uid,
      text: 'First',
    });
    await chatRef.collection('messages').doc(`${prefix}-message-2`).set({
      authorId: uid,
      text: 'Second',
    });
    await seedPendingState(uid, DELETION_PHASE.CHATS);

    await service.requestDeletion(uid, { maxSteps: 1 });

    const messages = await chatRef.collection('messages').get();
    const state = await service.getState(uid);
    expect(messages.empty).toBe(true);
    expect(state.phase).toBe(DELETION_PHASE.PROFILE);
  });

  test('writes a per-UID receipt after deleting the profile and Auth user', async () => {
    const uid = `${prefix}-receipt-user`;
    const otherUid = `${prefix}-other-receipt-user`;
    await firestore
      .collection('users')
      .doc(uid)
      .set({
        role: 'parent',
        email: `${uid}@example.test`,
      });
    await seedPendingState(uid, DELETION_PHASE.PROFILE);

    await service.requestDeletion(uid, { maxSteps: 1 });
    expect((await firestore.collection('users').doc(uid).get()).exists).toBe(false);

    await service.requestDeletion(uid, { maxSteps: 1 });
    await service.requestDeletion(uid, { maxSteps: 1 });
    await service.requestDeletion(uid, { maxSteps: 1 });

    const receipt = await firestore.collection('accountDeletionReceipts').doc(uid).get();
    const otherReceipt = await firestore.collection('accountDeletionReceipts').doc(otherUid).get();
    expect(receipt.exists).toBe(true);
    expect(receipt.get('status')).toBe(DELETION_STATUS.COMPLETED);
    expect(receipt.get('phase')).toBe(DELETION_PHASE.COMPLETED);
    expect(receipt.get('requestId')).toBe(`${prefix}-request-${uid}`);
    expect(otherReceipt.exists).toBe(false);
    expect(deletedAuthUsers).toContain(uid);
    expect(await service.getState(uid)).toBeNull();
  });

  test('falls back to the receipt when the active state document is gone', async () => {
    const uid = `${prefix}-fallback-user`;
    await firestore
      .collection('accountDeletionReceipts')
      .doc(uid)
      .set({
        requestId: `${prefix}-request-${uid}`,
        status: DELETION_STATUS.COMPLETED,
        phase: DELETION_PHASE.COMPLETED,
        completedAt: new Date(),
        updatedAt: new Date(),
      });

    expect(await service.getDeletionStatus(uid)).toMatchObject({
      status: DELETION_STATUS.COMPLETED,
      phase: DELETION_PHASE.COMPLETED,
    });
    expect(await service.requestDeletion(uid)).toMatchObject({
      status: DELETION_STATUS.COMPLETED,
      phase: DELETION_PHASE.COMPLETED,
    });
  });

  test('never double-runs while another worker holds the lease', async () => {
    const uid = `${prefix}-lease-user`;
    const currentTime = Date.now();
    await seedPendingState(uid, DELETION_PHASE.MATCHES);
    await firestore
      .collection('accountDeletionRequests')
      .doc(uid)
      .update({
        status: DELETION_STATUS.PROCESSING,
        lease: {
          ownerToken: 'other-worker-token',
          acquiredAt: currentTime,
          expiresAt: currentTime + 5 * 60 * 1000,
        },
      });

    const publicStatus = await service.requestDeletion(uid);
    const state = await service.getState(uid);

    expect(publicStatus.status).toBe(DELETION_STATUS.PROCESSING);
    expect(state.lease.ownerToken).toBe('other-worker-token');
    expect(state.attempts).toBe(0);
  });
});

emulatorDescribe('account deletion end to end (Firestore + Auth Emulator)', () => {
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '';
  if (emulatorEnabled && !/^127\.0\.0\.1:9099$|^localhost:9099$/i.test(authHost)) {
    throw new Error('End-to-end deletion tests require the local Auth Emulator on port 9099.');
  }

  let app;
  let firestore;
  let realAuth;
  const createdAuthUsers = [];
  const prefix = `account-deletion-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(() => {
    app = admin.initializeApp({ projectId }, `account-deletion-e2e-${Date.now()}`);
    firestore = admin.firestore(app);
    realAuth = admin.auth(app);
  });

  afterAll(async () => {
    for (const uid of createdAuthUsers) {
      await realAuth.deleteUser(uid).catch(() => {});
    }
    if (app) await app.delete();
  });

  const emptyStorage = {
    bucket: jest.fn(() => ({
      getFiles: jest.fn(async () => [[], null]),
    })),
  };

  const createService = ({ auth, storage } = {}) =>
    createAccountDeletionService({
      firestore,
      auth: auth || realAuth,
      storage: storage || emptyStorage,
      storageBucket: `${projectId}.appspot.com`,
    });

  const createAuthUser = async (uid) => {
    await realAuth.deleteUser(uid).catch(() => {});
    await realAuth.createUser({
      uid,
      email: `${uid}@example.test`,
      password: 'deletion-test-password',
    });
    createdAuthUsers.push(uid);
  };

  const seedPendingState = async (uid, phase, checkpoint = {}) => {
    await firestore
      .collection('accountDeletionRequests')
      .doc(uid)
      .set({
        requestId: `${prefix}-request-${uid}`,
        status: DELETION_STATUS.PENDING,
        phase,
        checkpoint: {
          collectionIndex: 0,
          counters: {
            matches: 0,
            vacancyNotifications: 0,
            firestore: 0,
            chats: 0,
            storage: 0,
          },
          ...checkpoint,
        },
        lease: null,
        attempts: 0,
        retryable: true,
        lastErrorCode: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
  };

  const seedCompletedMatch = async (matchId, data) => {
    const matchRef = firestore.collection('matches').doc(matchId);
    await matchRef.set({ status: 'completed', ...data });
    await matchRef.collection('tracking').doc('current').set({
      latitude: 40.4168,
      longitude: -3.7038,
      updatedAt: new Date(),
    });
    return matchRef;
  };

  test('deletes the Auth user last and never touches other users across every phase', async () => {
    const uid = `${prefix}-e2e-user`;
    const otherUid = `${prefix}-e2e-other`;
    await createAuthUser(uid);
    await createAuthUser(otherUid);

    await firestore
      .collection('users')
      .doc(uid)
      .set({
        role: 'parent',
        email: `${uid}@example.test`,
        parentName: 'Private Parent Name',
        parentPhone: '+34600000001',
      });
    await firestore
      .collection('users')
      .doc(otherUid)
      .set({
        role: 'driver',
        email: `${otherUid}@example.test`,
      });
    await firestore.collection('routes').doc(`own-route-${prefix}`).set({ driverId: uid });
    await firestore
      .collection('trackingPoints')
      .doc(`own-points-${prefix}`)
      .set({ userId: uid, latitude: 40.1, longitude: -3.7 });
    await firestore.collection('routes').doc(`other-route-${prefix}`).set({ driverId: otherUid });

    const ownDriverMatch = await seedCompletedMatch(`own-driver-match-${prefix}`, {
      driverId: uid,
      parentId: otherUid,
      driverName: 'Private Driver Name',
      driverPhone: '+34600000002',
      cancelledBy: uid,
    });
    const ownParentMatch = await seedCompletedMatch(`own-parent-match-${prefix}`, {
      driverId: otherUid,
      parentId: uid,
      parentName: 'Private Parent Name',
      parentPhone: '+34600000001',
      childrenNames: 'Private Child',
    });
    const otherMatch = await seedCompletedMatch(`other-match-${prefix}`, {
      driverId: otherUid,
      parentId: `${prefix}-third-party`,
      driverName: 'Other Driver Name',
    });

    const service = createService();
    let publicStatus = { status: 'none' };
    for (let attempt = 0; attempt < 5 && publicStatus.status !== 'completed'; attempt += 1) {
      publicStatus = await service.requestDeletion(uid, { maxSteps: 10 });
    }
    expect(publicStatus).toMatchObject({
      status: DELETION_STATUS.COMPLETED,
      phase: DELETION_PHASE.COMPLETED,
    });

    const receipt = await firestore.collection('accountDeletionReceipts').doc(uid).get();
    expect(receipt.get('status')).toBe(DELETION_STATUS.COMPLETED);
    expect(receipt.get('phase')).toBe(DELETION_PHASE.COMPLETED);
    expect(await service.getState(uid)).toBeNull();

    await expect(realAuth.getUser(uid)).rejects.toMatchObject({
      code: 'auth/user-not-found',
    });
    await expect(realAuth.getUser(otherUid)).resolves.toMatchObject({ uid: otherUid });

    expect((await firestore.collection('users').doc(uid).get()).exists).toBe(false);
    expect((await firestore.collection('users').doc(otherUid).get()).exists).toBe(true);
    expect((await firestore.collection('routes').doc(`own-route-${prefix}`).get()).exists).toBe(
      false
    );
    expect(
      (await firestore.collection('trackingPoints').doc(`own-points-${prefix}`).get()).exists
    ).toBe(false);
    expect((await firestore.collection('routes').doc(`other-route-${prefix}`).get()).exists).toBe(
      true
    );

    const redactedDriver = await ownDriverMatch.get();
    expect(redactedDriver.get('driverId')).toBe(redactedParticipant(uid));
    expect(redactedDriver.get('driverName')).toBeUndefined();
    expect(redactedDriver.get('driverPhone')).toBeUndefined();
    expect(redactedDriver.get('cancelledBy')).toBe(redactedParticipant(uid));
    expect((await ownDriverMatch.collection('tracking').doc('current').get()).exists).toBe(false);

    const redactedParent = await ownParentMatch.get();
    expect(redactedParent.get('parentId')).toBe(redactedParticipant(uid));
    expect(redactedParent.get('parentName')).toBeUndefined();
    expect(redactedParent.get('parentPhone')).toBeUndefined();
    expect(redactedParent.get('childrenNames')).toBeUndefined();
    expect((await ownParentMatch.collection('tracking').doc('current').get()).exists).toBe(false);

    const untouchedMatch = await otherMatch.get();
    expect(untouchedMatch.get('driverId')).toBe(otherUid);
    expect(untouchedMatch.get('driverName')).toBe('Other Driver Name');
    expect((await otherMatch.collection('tracking').doc('current').get()).exists).toBe(true);
  });

  test('resumes from the Auth phase after a transient Auth deletion failure', async () => {
    const uid = `${prefix}-auth-retry-user`;
    await createAuthUser(uid);
    await firestore.collection('users').doc(uid).set({ role: 'parent' });
    await seedPendingState(uid, DELETION_PHASE.PROFILE);

    let authDeleteAttempts = 0;
    const flakyAuth = {
      getUser: (target) => realAuth.getUser(target),
      deleteUser: async (target) => {
        if (target === uid && authDeleteAttempts === 0) {
          authDeleteAttempts += 1;
          throw Object.assign(new Error('Auth unavailable'), { code: 'unavailable' });
        }
        return realAuth.deleteUser(target);
      },
    };
    const service = createService({ auth: flakyAuth });

    const failedStatus = await service.requestDeletion(uid, { maxSteps: 10 });
    expect(failedStatus).toMatchObject({
      status: DELETION_STATUS.FAILED,
      errorCode: 'auth-delete-failed',
    });
    await expect(realAuth.getUser(uid)).resolves.toMatchObject({ uid });
    expect((await firestore.collection('users').doc(uid).get()).exists).toBe(false);

    const resumedStatus = await service.requestDeletion(uid, { maxSteps: 10 });
    expect(resumedStatus).toMatchObject({
      status: DELETION_STATUS.COMPLETED,
      phase: DELETION_PHASE.COMPLETED,
    });
    await expect(realAuth.getUser(uid)).rejects.toMatchObject({ code: 'auth/user-not-found' });
    expect(
      (await firestore.collection('accountDeletionReceipts').doc(uid).get()).get('status')
    ).toBe(DELETION_STATUS.COMPLETED);
    expect(await service.getState(uid)).toBeNull();
  });

  test('treats a missing Auth user as already deleted and completes the process', async () => {
    const uid = `${prefix}-no-auth-user`;
    await seedPendingState(uid, DELETION_PHASE.AUTH);

    const service = createService();
    const publicStatus = await service.requestDeletion(uid, { maxSteps: 10 });

    expect(publicStatus).toMatchObject({
      status: DELETION_STATUS.COMPLETED,
      phase: DELETION_PHASE.COMPLETED,
    });
    expect(
      (await firestore.collection('accountDeletionReceipts').doc(uid).get()).get('status')
    ).toBe(DELETION_STATUS.COMPLETED);
  });

  test('resumes from the Storage phase after an intermediate delete failure', async () => {
    const uid = `${prefix}-storage-retry-user`;
    await seedPendingState(uid, DELETION_PHASE.STORAGE);

    let storageFiles = [`users/${uid}/avatar.pdf`];
    let deleteShouldFail = true;
    const deleteFile = jest.fn(async () => {
      if (deleteShouldFail) throw new Error('storage backend error');
      storageFiles = [];
    });
    const storage = {
      bucket: jest.fn(() => ({
        getFiles: jest.fn(async () => [
          storageFiles.map((name) => ({ name, delete: deleteFile })),
          null,
        ]),
      })),
    };
    const service = createService({ storage });

    const failedStatus = await service.requestDeletion(uid, { maxSteps: 10 });
    expect(failedStatus).toMatchObject({
      status: DELETION_STATUS.FAILED,
      errorCode: 'storage-delete-failed',
    });
    expect(await service.getState(uid)).toMatchObject({ phase: DELETION_PHASE.STORAGE });

    deleteShouldFail = false;
    const resumedStatus = await service.requestDeletion(uid, { maxSteps: 10 });
    expect(resumedStatus).toMatchObject({
      status: DELETION_STATUS.COMPLETED,
      phase: DELETION_PHASE.COMPLETED,
    });
    expect(deleteFile).toHaveBeenCalledTimes(2);
    expect(
      (await firestore.collection('accountDeletionReceipts').doc(uid).get()).get('status')
    ).toBe(DELETION_STATUS.COMPLETED);
    expect(await service.getState(uid)).toBeNull();
  });
});
