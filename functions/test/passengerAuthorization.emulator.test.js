const admin = require('firebase-admin');
const { createPassengerAuthorizationManager } = require('../src/passengerAuthorization');
const {
  onboardPassengerCallable,
  updatePassengerAuthorizationStatusCallable,
} = require('../src/passengerAuthorizationCallables');

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || '';
const projectId = process.env.PASSENGER_AUTHORIZATION_EMULATOR_PROJECT_ID || '';
const emulatorEnabled = process.env.PASSENGER_AUTHORIZATION_EMULATOR === 'true';
const emulatorDescribe = emulatorEnabled ? describe : describe.skip;

jest.setTimeout(120000);

if (
  emulatorEnabled &&
  (!projectId.startsWith('demo-') || !/^127\.0\.0\.1:8080$|^localhost:8080$/i.test(emulatorHost))
) {
  throw new Error(
    'Passenger authorization integration requires the local demo Firestore Emulator.'
  );
}

emulatorDescribe('passenger authorization fencing (Firestore Emulator)', () => {
  let app;
  let defaultApp;
  let firestore;
  let manager;
  const prefix = `passenger-auth-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const created = {
    users: new Set(),
    passengers: new Set(),
    authorizations: new Set(),
    matches: new Set(),
    events: new Set(),
  };

  beforeAll(() => {
    defaultApp =
      admin.apps.find((candidate) => candidate.name === '[DEFAULT]') ||
      admin.initializeApp({ projectId });
    app = admin.initializeApp({ projectId }, `passenger-auth-${Date.now()}`);
    firestore = admin.firestore(app);
    manager = createPassengerAuthorizationManager({ firestore });
  });

  const cleanupFixtures = async () => {
    for (const matchId of created.matches) {
      await firestore
        .collection('matches')
        .doc(matchId)
        .collection('tracking')
        .doc('current')
        .delete()
        .catch(() => {});
      await firestore
        .collection('matches')
        .doc(matchId)
        .delete()
        .catch(() => {});
    }
    const refs = [
      ...[...created.events].map((id) => firestore.collection('authorizationEvents').doc(id)),
      ...[...created.authorizations].map((id) =>
        firestore.collection('passengerAuthorizations').doc(id)
      ),
      ...[...created.passengers].map((id) => firestore.collection('passengers').doc(id)),
      ...[...created.users].map((id) => firestore.collection('users').doc(id)),
    ];
    for (let offset = 0; offset < refs.length; offset += 400) {
      const batch = firestore.batch();
      refs.slice(offset, offset + 400).forEach((ref) => batch.delete(ref));
      await batch.commit();
    }
    Object.values(created).forEach((items) => items.clear());
  };

  afterEach(async () => {
    await cleanupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures();
    await app.delete();
    if (defaultApp?.name === '[DEFAULT]') await defaultApp.delete();
  });

  const seedGuardian = async (label) => {
    const uid = `${prefix}-${label}`;
    created.users.add(uid);
    await firestore
      .collection('users')
      .doc(uid)
      .set({
        role: 'parent',
        adultEligibility: {
          status: 'eligible',
          method: 'backend_recorded',
          noticeVersion: 'privacy-v1',
          recordedAt: admin.firestore.Timestamp.now(),
        },
      });
    return uid;
  };

  const seedPassengerAuthorization = async ({
    label = 'A',
    guardianId,
    passengerId: suppliedPassengerId,
  } = {}) => {
    const passengerId = suppliedPassengerId || `${prefix}-passenger-${label}`;
    const authorizationId = `${prefix}-authorization-${label}`;
    const matchId = `${prefix}-match-${label}`;
    created.passengers.add(passengerId);
    created.authorizations.add(authorizationId);
    created.matches.add(matchId);
    await Promise.all([
      firestore.collection('passengers').doc(passengerId).set({
        passengerId,
        parentId: guardianId,
        latestAuthorizationId: authorizationId,
        status: 'revoked',
      }),
      firestore.collection('passengerAuthorizations').doc(authorizationId).set({
        authorizationId,
        passengerId,
        guardianId,
        status: 'revoked',
        cleanupStatus: 'pending',
        cleanupGeneration: 0,
        cleanupLeaseOwner: null,
        cleanupLeaseId: null,
        cleanupLeaseExpiresAt: null,
        retryCount: 0,
      }),
      firestore
        .collection('matches')
        .doc(matchId)
        .set({
          parentId: guardianId,
          passengerIds: [passengerId],
          status: 'active',
        }),
      firestore.collection('matches').doc(matchId).collection('tracking').doc('current').set({
        matchId,
        latitude: -33.45,
        longitude: -70.66,
        updatedAt: admin.firestore.Timestamp.now(),
      }),
    ]);
    return { passengerId, authorizationId, matchId };
  };

  const hasTracking = async (matchId) =>
    (await firestore.collection('matches').doc(matchId).collection('tracking').doc('current').get())
      .exists;

  const gatedFirestore = ({ matchId, afterRead, beforeMatchCandidates, onAuthReadStart }) => ({
    collection: (name) => {
      const collection = firestore.collection(name);
      if (name !== 'matches' || !beforeMatchCandidates) return collection;
      const wrapQuery = (query) => ({
        where: (...args) => wrapQuery(query.where(...args)),
        limit: (...args) => wrapQuery(query.limit(...args)),
        get: async () => {
          const result = await query.get();
          await beforeMatchCandidates();
          return result;
        },
      });
      return {
        doc: collection.doc.bind(collection),
        where: (...args) => wrapQuery(collection.where(...args)),
      };
    },
    runTransaction: (callback, options) =>
      firestore.runTransaction(
        (transaction) =>
          callback({
            get: async (ref) => {
              if (onAuthReadStart && ref.path.startsWith('passengerAuthorizations/'))
                onAuthReadStart(ref);
              const snapshot = await transaction.get(ref);
              if (afterRead && ref.path === `matches/${matchId}`) await afterRead(snapshot);
              return snapshot;
            },
            set: (...args) => transaction.set(...args),
            create: (...args) => transaction.create(...args),
            update: (...args) => transaction.update(...args),
            delete: (...args) => transaction.delete(...args),
          }),
        options
      ),
  });

  const barrier = () => {
    let release;
    let entered;
    const reached = new Promise((resolve) => {
      entered = resolve;
    });
    const waiting = new Promise((resolve) => {
      release = resolve;
    });
    return { reached, release, waiting, entered };
  };

  test('worker B cannot take a live lease; after generation 2, stale A cannot delete or finalize', async () => {
    const guardianId = await seedGuardian('guardian-A');
    const fixture = await seedPassengerAuthorization({ guardianId });
    const candidatePause = barrier();
    let pauseCandidatesOnce = true;
    const pause = barrier();
    let pauseTransactionOnce = true;
    let bAttemptedAuthRead;
    const bAttempted = new Promise((resolve) => {
      bAttemptedAuthRead = resolve;
    });
    const managerA = createPassengerAuthorizationManager({
      firestore: gatedFirestore({
        matchId: fixture.matchId,
        beforeMatchCandidates: async () => {
          if (!pauseCandidatesOnce) return;
          pauseCandidatesOnce = false;
          candidatePause.entered();
          await candidatePause.waiting;
        },
        afterRead: async () => {
          if (!pauseTransactionOnce) return;
          pauseTransactionOnce = false;
          pause.entered();
          await pause.waiting;
        },
      }),
    });

    const resultA = managerA.retryPendingRevocationCleanups({ workerId: 'worker-A', limit: 1 });
    await candidatePause.reached;
    process.stderr.write(
      'R15 race: A acquired generation 1 and paused before candidate transaction.\n'
    );
    const authRef = firestore.collection('passengerAuthorizations').doc(fixture.authorizationId);
    const leaseOne = await authRef.get();
    expect(leaseOne.get('cleanupGeneration')).toBe(1);
    expect(leaseOne.get('cleanupLeaseOwner')).toBe('worker-A');
    expect(await hasTracking(fixture.matchId)).toBe(true);

    const blockedB = await manager.retryPendingRevocationCleanups({
      workerId: 'worker-B',
      limit: 1,
    });
    expect(blockedB).toEqual({ recoveredCount: 0, failedCount: 0 });
    expect((await authRef.get()).get('cleanupGeneration')).toBe(1);

    await authRef.update({
      cleanupLeaseExpiresAt: admin.firestore.Timestamp.fromMillis(Date.now() - 1000),
    });
    candidatePause.release();
    await pause.reached;
    const managerB = createPassengerAuthorizationManager({
      firestore: gatedFirestore({
        matchId: fixture.matchId,
        onAuthReadStart: (ref) => {
          if (ref.id === fixture.authorizationId) bAttemptedAuthRead();
        },
      }),
    });
    const resultB = managerB.retryPendingRevocationCleanups({ workerId: 'worker-B', limit: 1 });
    await bAttempted;
    process.stderr.write('R15 race: B attempted acquisition while A transaction is open.\n');
    pause.release();
    expect(await resultB).toEqual({ recoveredCount: 1, failedCount: 0 });
    process.stderr.write('R15 race: B acquired generation 2 and completed cleanup.\n');
    expect(await hasTracking(fixture.matchId)).toBe(false);
    const afterB = await authRef.get();
    expect(afterB.get('cleanupGeneration')).toBe(2);
    expect(afterB.get('cleanupStatus')).toBe('completed');

    const staleAResult = await resultA;
    process.stderr.write('R15 race: stale A completed without changing B state.\n');
    expect(staleAResult).toEqual({ recoveredCount: 0, failedCount: 1 });
    const afterA = await authRef.get();
    expect(afterA.get('cleanupGeneration')).toBe(2);
    expect(afterA.get('cleanupStatus')).toBe('completed');
    expect(afterA.get('retryCount')).toBe(0);
    expect(afterA.get('lastErrorCode')).toBeUndefined();
    expect(await hasTracking(fixture.matchId)).toBe(false);

    const repeated = await manager.retryPendingRevocationCleanups({
      workerId: 'worker-B',
      limit: 1,
    });
    expect(repeated).toEqual({ recoveredCount: 0, failedCount: 0 });
  });

  test('stale A error recovery cannot clear or mutate B generation and never persists exception content', async () => {
    const guardianId = await seedGuardian('guardian-catch');
    const fixture = await seedPassengerAuthorization({ label: 'catch', guardianId });
    const candidatePause = barrier();
    const pause = barrier();
    let pauseCandidatesOnce = true;
    let firstMatchRead = true;
    let bAttemptedAuthRead;
    const bAttempted = new Promise((resolve) => {
      bAttemptedAuthRead = resolve;
    });
    const managerA = createPassengerAuthorizationManager({
      firestore: gatedFirestore({
        matchId: fixture.matchId,
        beforeMatchCandidates: async () => {
          if (!pauseCandidatesOnce) return;
          pauseCandidatesOnce = false;
          candidatePause.entered();
          await candidatePause.waiting;
        },
        afterRead: async () => {
          if (!firstMatchRead) return;
          firstMatchRead = false;
          pause.entered();
          await pause.waiting;
          throw new Error(
            'EMAIL child@example.test GPS -33.45,-70.66 bearer SECRET request-body PII'
          );
        },
      }),
    });
    const resultA = managerA.retryPendingRevocationCleanups({ workerId: 'worker-A', limit: 1 });
    await candidatePause.reached;
    const authRef = firestore.collection('passengerAuthorizations').doc(fixture.authorizationId);
    await authRef.update({
      cleanupLeaseExpiresAt: admin.firestore.Timestamp.fromMillis(Date.now() - 1000),
    });
    candidatePause.release();
    await pause.reached;
    const managerB = createPassengerAuthorizationManager({
      firestore: gatedFirestore({
        matchId: fixture.matchId,
        onAuthReadStart: (ref) => {
          if (ref.id === fixture.authorizationId) bAttemptedAuthRead();
        },
      }),
    });
    const resultB = managerB.retryPendingRevocationCleanups({ workerId: 'worker-B', limit: 1 });
    await bAttempted;
    pause.release();
    expect(await resultB).toEqual({ recoveredCount: 1, failedCount: 0 });
    expect(await resultA).toEqual({ recoveredCount: 0, failedCount: 1 });
    const auth = (await authRef.get()).data();
    expect(auth.cleanupStatus).toBe('completed');
    expect(auth.cleanupGeneration).toBe(2);
    expect(auth.retryCount).toBe(0);
    expect(auth.lastErrorCode).toBeUndefined();
    expect(JSON.stringify(auth)).not.toMatch(/child@example|33\.45|SECRET|request-body|PII/);
  });

  test('persists a fixed error code and retry count, never exception content', async () => {
    const guardianId = await seedGuardian('guardian-sanitized-error');
    const fixture = await seedPassengerAuthorization({ label: 'sanitized-error', guardianId });
    const loggerError = jest.spyOn(console, 'error');
    const maliciousMessage =
      'child@example.test coordinates=-33.45,-70.66 token=SECRET request={"name":"Child"}';
    const managerFailing = createPassengerAuthorizationManager({
      firestore: gatedFirestore({
        matchId: fixture.matchId,
        afterRead: async () => {
          throw new Error(maliciousMessage);
        },
      }),
    });

    const result = await managerFailing.retryPendingRevocationCleanups({
      workerId: 'worker-sanitizer',
      limit: 1,
    });
    const auth = (
      await firestore.collection('passengerAuthorizations').doc(fixture.authorizationId).get()
    ).data();
    expect(result).toEqual({ recoveredCount: 0, failedCount: 1 });
    expect(auth).toMatchObject({
      cleanupStatus: 'pending',
      cleanupGeneration: 1,
      cleanupLeaseOwner: null,
      cleanupLeaseId: null,
      retryCount: 1,
      lastErrorCode: 'GPS_PURGE_DELETE_FAILED',
    });
    expect(JSON.stringify(auth)).not.toContain(maliciousMessage);
    expect(JSON.stringify(result)).not.toMatch(/child@example|33\.45|SECRET|request/);
    expect(loggerError).not.toHaveBeenCalled();
    loggerError.mockRestore();
  });

  test('worker retry completes the remaining match after a partial cleanup failure', async () => {
    const guardianId = await seedGuardian('guardian-partial');
    const fixtureA = await seedPassengerAuthorization({ label: 'partial-A', guardianId });
    const partialMatchId = `${prefix}-match-partial-B`;
    created.matches.add(partialMatchId);
    await Promise.all([
      firestore
        .collection('matches')
        .doc(partialMatchId)
        .set({
          parentId: guardianId,
          passengerIds: [fixtureA.passengerId],
          status: 'active',
        }),
      firestore
        .collection('matches')
        .doc(partialMatchId)
        .collection('tracking')
        .doc('current')
        .set({
          matchId: partialMatchId,
          latitude: -33.45,
          longitude: -70.66,
          updatedAt: admin.firestore.Timestamp.now(),
        }),
    ]);
    const maliciousMessage = 'child@example.test GPS -33.45,-70.66 bearer SECRET request-body PII';
    const managerFailing = createPassengerAuthorizationManager({
      firestore: gatedFirestore({
        matchId: partialMatchId,
        afterRead: async () => {
          throw new Error(maliciousMessage);
        },
      }),
    });

    const partialResult = await managerFailing.retryPendingRevocationCleanups({
      workerId: 'worker-partial',
      limit: 1,
    });
    expect(partialResult).toEqual({ recoveredCount: 0, failedCount: 1 });
    expect(await hasTracking(fixtureA.matchId)).toBe(false);
    expect(await hasTracking(partialMatchId)).toBe(true);
    const authRef = firestore.collection('passengerAuthorizations').doc(fixtureA.authorizationId);
    const afterFailure = (await authRef.get()).data();
    expect(afterFailure.cleanupStatus).toBe('pending');
    expect(afterFailure.retryCount).toBe(1);
    expect(afterFailure.lastErrorCode).toBe('GPS_PURGE_DELETE_FAILED');
    expect(JSON.stringify(afterFailure)).not.toMatch(
      /child@example|33\.45|SECRET|request-body|PII/
    );

    const retryResult = await manager.retryPendingRevocationCleanups({
      workerId: 'worker-retry',
      limit: 1,
    });
    expect(retryResult).toEqual({ recoveredCount: 1, failedCount: 0 });
    expect(await hasTracking(partialMatchId)).toBe(false);
    const afterRetry = (await authRef.get()).data();
    expect(afterRetry.cleanupStatus).toBe('completed');
    expect(afterRetry.cleanupGeneration).toBe(2);
    expect(await hasTracking(fixtureA.matchId)).toBe(false);
  });

  test('completes cleanup when current tracking was already removed', async () => {
    const guardianId = await seedGuardian('guardian-already-removed');
    const fixture = await seedPassengerAuthorization({ label: 'already-removed', guardianId });
    await firestore
      .collection('matches')
      .doc(fixture.matchId)
      .collection('tracking')
      .doc('current')
      .delete();

    const result = await manager.retryPendingRevocationCleanups({
      workerId: 'worker-removed',
      limit: 1,
    });
    expect(result).toEqual({ recoveredCount: 1, failedCount: 0 });
    const auth = (
      await firestore.collection('passengerAuthorizations').doc(fixture.authorizationId).get()
    ).data();
    expect(auth.cleanupStatus).toBe('completed');
    expect(auth.cleanupGeneration).toBe(1);
    expect(auth.lastErrorCode).toBeUndefined();
    expect(auth.retryCount).toBe(0);
  });

  test('the match passenger link is re-read transactionally before delete', async () => {
    const guardianId = await seedGuardian('guardian-link');
    const fixture = await seedPassengerAuthorization({ label: 'link', guardianId });
    const pause = barrier();
    let once = true;
    const managerA = createPassengerAuthorizationManager({
      firestore: gatedFirestore({
        matchId: fixture.matchId,
        beforeMatchCandidates: async () => {
          if (!once) return;
          once = false;
          pause.entered();
          await pause.waiting;
        },
      }),
    });
    const cleanup = managerA.retryPendingRevocationCleanups({ workerId: 'worker-link', limit: 1 });
    await pause.reached;
    await firestore
      .collection('matches')
      .doc(fixture.matchId)
      .update({ passengerIds: [`${prefix}-other-passenger`] });
    pause.release();
    await cleanup;
    expect(await hasTracking(fixture.matchId)).toBe(true);
  });

  test('isolates passenger A from passenger B and preserves legacy matches without an individual link', async () => {
    const guardianA = await seedGuardian('guardian-isolation-A');
    const guardianB = await seedGuardian('guardian-isolation-B');
    const fixtureA = await seedPassengerAuthorization({
      label: 'isolation-A',
      guardianId: guardianA,
    });
    const fixtureB = await seedPassengerAuthorization({
      label: 'isolation-B',
      guardianId: guardianB,
    });
    await firestore
      .collection('passengerAuthorizations')
      .doc(fixtureB.authorizationId)
      .update({ cleanupStatus: 'completed' });
    const legacyMatchId = `${prefix}-legacy-match`;
    created.matches.add(legacyMatchId);
    await firestore
      .collection('matches')
      .doc(legacyMatchId)
      .set({ parentId: guardianA, status: 'active' });
    await firestore
      .collection('matches')
      .doc(legacyMatchId)
      .collection('tracking')
      .doc('current')
      .set({ latitude: 1, longitude: 2 });

    expect(
      await manager.retryPendingRevocationCleanups({ workerId: 'worker-isolation-A', limit: 1 })
    ).toEqual({ recoveredCount: 1, failedCount: 0 });
    expect(await hasTracking(fixtureA.matchId)).toBe(false);
    expect(await hasTracking(fixtureB.matchId)).toBe(true);
    expect(await hasTracking(legacyMatchId)).toBe(true);
  });

  test('does not mutate stale authorization A or authorization B for a passenger now linked to B', async () => {
    const guardianId = await seedGuardian('guardian-replaced');
    const fixture = await seedPassengerAuthorization({ label: 'replaced', guardianId });
    const authorizationB = `${prefix}-authorization-replacement`;
    created.authorizations.add(authorizationB);
    await firestore.collection('passengerAuthorizations').doc(authorizationB).set({
      authorizationId: authorizationB,
      passengerId: fixture.passengerId,
      guardianId,
      status: 'active',
      cleanupStatus: 'none',
      cleanupGeneration: 0,
    });
    await firestore
      .collection('passengers')
      .doc(fixture.passengerId)
      .update({ latestAuthorizationId: authorizationB });

    await manager.retryPendingRevocationCleanups({ workerId: 'worker-replaced', limit: 1 });
    expect(await hasTracking(fixture.matchId)).toBe(true);
    expect(
      (
        await firestore.collection('passengerAuthorizations').doc(fixture.authorizationId).get()
      ).get('cleanupGeneration')
    ).toBe(0);
    expect(
      (await firestore.collection('passengerAuthorizations').doc(authorizationB).get()).get(
        'cleanupStatus'
      )
    ).toBe('none');
    await expect(
      manager.updateAuthorizationStatus({
        adultUid: guardianId,
        passengerId: fixture.passengerId,
        authorizationId: fixture.authorizationId,
        newStatus: 'revoked',
      })
    ).rejects.toThrow(/latest authorization/);
  });

  test('concurrent identical onboarding requests return one persisted result and create one event', async () => {
    const guardianId = await seedGuardian('idempotent-concurrent');
    const input = {
      adultUid: guardianId,
      passengerId: `${prefix}-idempotent-passenger`,
      requestId: 'request-concurrent-identical-0001',
      passengerAlias: 'Synthetic Passenger',
      purpose: 'school_transport',
      privacyNoticeVersion: 'privacy-v1',
      authorizationTextVersion: 'authorization-v1',
      responsibilityDeclared: true,
      privacyNoticeAccepted: true,
    };
    const [first, second] = await Promise.all([
      manager.createPassengerWithDeclaration(input),
      manager.createPassengerWithDeclaration(input),
    ]);
    expect(first).toEqual(second);
    created.passengers.add(input.passengerId);
    created.authorizations.add(first.authorizationId);
    const persisted = await firestore
      .collection('passengerAuthorizations')
      .doc(first.authorizationId)
      .get();
    expect(first.authorizationId).toMatch(/^auth_[a-f0-9]{64}$/);
    expect(first.acceptedAt).toBe(persisted.get('acceptedAt').toDate().toISOString());
    const events = await firestore
      .collection('authorizationEvents')
      .where('authorizationId', '==', first.authorizationId)
      .get();
    events.docs.forEach((event) => created.events.add(event.id));
    expect(events.docs.filter((event) => event.get('action') === 'CREATED')).toHaveLength(1);
  });

  test('concurrent requests with the same key and different content have one winner and no duplicate event', async () => {
    const guardianId = await seedGuardian('idempotent-conflict');
    const base = {
      adultUid: guardianId,
      passengerId: `${prefix}-conflict-passenger`,
      requestId: 'request-concurrent-conflict-0001',
      purpose: 'school_transport',
      privacyNoticeVersion: 'privacy-v1',
      authorizationTextVersion: 'authorization-v1',
      responsibilityDeclared: true,
      privacyNoticeAccepted: true,
    };
    const outcomes = await Promise.allSettled([
      manager.createPassengerWithDeclaration({ ...base, passengerAlias: 'Synthetic A' }),
      manager.createPassengerWithDeclaration({ ...base, passengerAlias: 'Synthetic B' }),
    ]);
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const winner = outcomes.find((result) => result.status === 'fulfilled').value;
    created.passengers.add(base.passengerId);
    created.authorizations.add(winner.authorizationId);
    const events = await firestore
      .collection('authorizationEvents')
      .where('authorizationId', '==', winner.authorizationId)
      .get();
    events.docs.forEach((event) => created.events.add(event.id));
    expect(events.docs.filter((event) => event.get('action') === 'CREATED')).toHaveLength(1);
  });

  test('the same request key is independent across UIDs and replay recovers after manager recreation', async () => {
    const guardianA = await seedGuardian('same-key-A');
    const guardianB = await seedGuardian('same-key-B');
    const makeInput = (adultUid, suffix) => ({
      adultUid,
      passengerId: `${prefix}-same-key-${suffix}`,
      requestId: 'shared-request-key-00000001',
      passengerAlias: 'Synthetic Passenger',
      purpose: 'school_transport',
      privacyNoticeVersion: 'privacy-v1',
      authorizationTextVersion: 'authorization-v1',
      responsibilityDeclared: true,
      privacyNoticeAccepted: true,
    });
    const inputA = makeInput(guardianA, 'A');
    const inputB = makeInput(guardianB, 'B');
    const original = await manager.createPassengerWithDeclaration(inputA);
    const other = await manager.createPassengerWithDeclaration(inputB);
    expect(other.authorizationId).not.toBe(original.authorizationId);
    created.passengers.add(inputA.passengerId);
    created.passengers.add(inputB.passengerId);
    created.authorizations.add(original.authorizationId);
    created.authorizations.add(other.authorizationId);
    const restartedManager = createPassengerAuthorizationManager({ firestore });
    const replay = await restartedManager.createPassengerWithDeclaration(inputA);
    expect(replay).toEqual(original);
    const events = await firestore
      .collection('authorizationEvents')
      .where('authorizationId', '==', original.authorizationId)
      .get();
    events.docs.forEach((event) => created.events.add(event.id));
    expect(events.docs.filter((event) => event.get('action') === 'CREATED')).toHaveLength(1);
  });

  test('concurrent revocation is idempotent and leaves cleanup pending', async () => {
    const guardianId = await seedGuardian('revoke-concurrent');
    const fixture = await seedPassengerAuthorization({ label: 'revoke-concurrent', guardianId });
    await Promise.all([
      firestore.collection('passengers').doc(fixture.passengerId).update({ status: 'active' }),
      firestore
        .collection('passengerAuthorizations')
        .doc(fixture.authorizationId)
        .update({ status: 'active', cleanupStatus: 'none' }),
    ]);
    await Promise.all([
      manager.updateAuthorizationStatus({
        adultUid: guardianId,
        passengerId: fixture.passengerId,
        authorizationId: fixture.authorizationId,
        newStatus: 'revoked',
      }),
      manager.updateAuthorizationStatus({
        adultUid: guardianId,
        passengerId: fixture.passengerId,
        authorizationId: fixture.authorizationId,
        newStatus: 'revoked',
      }),
    ]);
    const [passenger, authorization, events] = await Promise.all([
      firestore.collection('passengers').doc(fixture.passengerId).get(),
      firestore.collection('passengerAuthorizations').doc(fixture.authorizationId).get(),
      firestore
        .collection('authorizationEvents')
        .where('authorizationId', '==', fixture.authorizationId)
        .get(),
    ]);
    expect(passenger.get('status')).toBe('revoked');
    expect(authorization.get('status')).toBe('revoked');
    expect(authorization.get('cleanupStatus')).toBe('pending');
    events.docs.forEach((event) => created.events.add(event.id));
    expect(
      events.docs.filter(
        (event) => event.get('action') === 'STATUS_CHANGE' && event.get('toStatus') === 'revoked'
      )
    ).toHaveLength(1);
  });

  test('commit followed by lost response is recovered exactly without duplicate writes', async () => {
    const guardianId = await seedGuardian('lost-response');
    const input = {
      adultUid: guardianId,
      passengerId: `${prefix}-lost-response-passenger`,
      requestId: 'request-lost-response-0000001',
      passengerAlias: 'Synthetic Passenger',
      purpose: 'school_transport',
      privacyNoticeVersion: 'privacy-v1',
      authorizationTextVersion: 'authorization-v1',
      responsibilityDeclared: true,
      privacyNoticeAccepted: true,
    };
    let committedResult;
    try {
      committedResult = await manager.createPassengerWithDeclaration(input);
      throw new Error('SYNTHETIC_RESPONSE_LOST_AFTER_COMMIT');
    } catch (error) {
      expect(error.message).toBe('SYNTHETIC_RESPONSE_LOST_AFTER_COMMIT');
    }
    created.passengers.add(input.passengerId);
    created.authorizations.add(committedResult.authorizationId);
    const replay = await manager.createPassengerWithDeclaration(input);
    expect(replay).toEqual(committedResult);
    const persisted = await firestore
      .collection('passengerAuthorizations')
      .doc(replay.authorizationId)
      .get();
    expect(replay.acceptedAt).toBe(persisted.get('acceptedAt').toDate().toISOString());
    const events = await firestore
      .collection('authorizationEvents')
      .where('authorizationId', '==', replay.authorizationId)
      .get();
    events.docs.forEach((event) => created.events.add(event.id));
    expect(events.docs.filter((event) => event.get('action') === 'CREATED')).toHaveLength(1);
  });

  test('transaction failure before commit leaves no partial data and same-key retry succeeds', async () => {
    const guardianId = await seedGuardian('transaction-retry');
    const input = {
      adultUid: guardianId,
      passengerId: `${prefix}-transaction-retry-passenger`,
      requestId: 'request-transaction-retry-0001',
      passengerAlias: 'Synthetic Passenger',
      purpose: 'school_transport',
      privacyNoticeVersion: 'privacy-v1',
      authorizationTextVersion: 'authorization-v1',
      responsibilityDeclared: true,
      privacyNoticeAccepted: true,
    };
    let failOnce = true;
    const failingFirestore = {
      collection: (name) => firestore.collection(name),
      runTransaction: (callback, options) =>
        firestore.runTransaction(
          (transaction) =>
            callback({
              get: (...args) => transaction.get(...args),
              set: (...args) => {
                if (failOnce) {
                  failOnce = false;
                  throw new Error('SYNTHETIC_PRECOMMIT_FAILURE');
                }
                return transaction.set(...args);
              },
              create: (...args) => transaction.create(...args),
              update: (...args) => transaction.update(...args),
              delete: (...args) => transaction.delete(...args),
            }),
          options
        ),
    };
    const failingManager = createPassengerAuthorizationManager({ firestore: failingFirestore });
    await expect(failingManager.createPassengerWithDeclaration(input)).rejects.toThrow(
      'SYNTHETIC_PRECOMMIT_FAILURE'
    );
    const authorizationId = `auth_${require('crypto')
      .createHash('sha256')
      .update(`${guardianId}:${input.requestId}`)
      .digest('hex')}`;
    expect((await firestore.collection('passengers').doc(input.passengerId).get()).exists).toBe(
      false
    );
    expect(
      (await firestore.collection('passengerAuthorizations').doc(authorizationId).get()).exists
    ).toBe(false);
    expect(
      (
        await firestore
          .collection('authorizationEvents')
          .where('authorizationId', '==', authorizationId)
          .get()
      ).docs
    ).toHaveLength(0);
    const result = await manager.createPassengerWithDeclaration(input);
    created.passengers.add(input.passengerId);
    created.authorizations.add(result.authorizationId);
    const events = await firestore
      .collection('authorizationEvents')
      .where('authorizationId', '==', result.authorizationId)
      .get();
    events.docs.forEach((event) => created.events.add(event.id));
    expect(result.status).toBe('active');
    expect(events.docs.filter((event) => event.get('action') === 'CREATED')).toHaveLength(1);
  });

  test('public callables enforce auth, eligibility, ownership, IDs and revocation contract', async () => {
    await expect(onboardPassengerCallable.run({ data: {} })).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    const ineligibleParent = `${prefix}-ineligible-parent`;
    created.users.add(ineligibleParent);
    await firestore.collection('users').doc(ineligibleParent).set({ role: 'parent' });
    await expect(
      onboardPassengerCallable.run({
        auth: { uid: ineligibleParent },
        data: {
          passengerId: `${prefix}-callable-passenger`,
          requestId: 'request-callable-00000001',
          responsibilityDeclared: true,
          privacyNoticeAccepted: true,
          privacyNoticeVersion: 'privacy-v1',
          authorizationTextVersion: 'authorization-v1',
        },
      })
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(
      onboardPassengerCallable.run({
        auth: { uid: ineligibleParent },
        data: {
          passengerId: '',
          requestId: '',
          responsibilityDeclared: true,
          privacyNoticeAccepted: true,
        },
      })
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(
      updatePassengerAuthorizationStatusCallable.run({
        data: { passengerId: 'p', newStatus: 'revoked' },
      })
    ).rejects.toMatchObject({ code: 'unauthenticated' });
    for (const newStatus of ['active', 'rejected', 'expired']) {
      await expect(
        updatePassengerAuthorizationStatusCallable.run({
          auth: { uid: `${prefix}-owner` },
          data: { passengerId: 'p', newStatus },
        })
      ).rejects.toMatchObject({ code: 'permission-denied' });
    }

    const owner = await seedGuardian('callable-owner');
    const other = await seedGuardian('callable-other');
    const fixture = await seedPassengerAuthorization({
      label: 'callable-owner',
      guardianId: owner,
    });
    await expect(
      updatePassengerAuthorizationStatusCallable.run({
        auth: { uid: other },
        data: {
          passengerId: fixture.passengerId,
          authorizationId: fixture.authorizationId,
          newStatus: 'revoked',
        },
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(
      updatePassengerAuthorizationStatusCallable.run({
        auth: { uid: owner },
        data: {
          passengerId: fixture.passengerId,
          authorizationId: `${prefix}-missing-auth`,
          newStatus: 'revoked',
        },
      })
    ).rejects.toMatchObject({ code: 'not-found' });
    const otherFixture = await seedPassengerAuthorization({
      label: 'callable-other-owned',
      guardianId: other,
    });
    await expect(
      updatePassengerAuthorizationStatusCallable.run({
        auth: { uid: owner },
        data: {
          passengerId: fixture.passengerId,
          authorizationId: otherFixture.authorizationId,
          newStatus: 'revoked',
        },
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(
      updatePassengerAuthorizationStatusCallable.run({
        auth: { uid: owner },
        data: { passengerId: fixture.passengerId, authorizationId: '', newStatus: 'revoked' },
      })
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('TC-WP01-01 & TC-WP01-02: creating Auth B updates Auth A to superseded, and revoking B keeps A superseded', async () => {
    const guardianId = await seedGuardian('superseded-test');
    const passengerId = `${prefix}-superseded-passenger`;
    const inputA = {
      adultUid: guardianId,
      passengerId,
      requestId: 'request-superseded-A-00001',
      passengerAlias: 'Child A',
      purpose: 'school_transport',
      privacyNoticeVersion: 'privacy-v1',
      authorizationTextVersion: 'authorization-v1',
      responsibilityDeclared: true,
      privacyNoticeAccepted: true,
    };
    const authA = await manager.createPassengerWithDeclaration(inputA);
    created.passengers.add(passengerId);
    created.authorizations.add(authA.authorizationId);

    const docAInitial = await firestore
      .collection('passengerAuthorizations')
      .doc(authA.authorizationId)
      .get();
    expect(docAInitial.get('status')).toBe('active');

    const inputB = {
      ...inputA,
      requestId: 'request-superseded-B-00002',
      passengerAlias: 'Child B (Updated)',
    };
    const authB = await manager.createPassengerWithDeclaration(inputB);
    created.authorizations.add(authB.authorizationId);

    const [docAAfterB, docBAfterB, passengerDoc] = await Promise.all([
      firestore.collection('passengerAuthorizations').doc(authA.authorizationId).get(),
      firestore.collection('passengerAuthorizations').doc(authB.authorizationId).get(),
      firestore.collection('passengers').doc(passengerId).get(),
    ]);

    expect(docAAfterB.get('status')).toBe('superseded');
    expect(docAAfterB.get('supersededBy')).toBe(authB.authorizationId);
    expect(docAAfterB.get('cleanupStatus')).toBe('pending');
    expect(docBAfterB.get('status')).toBe('active');
    expect(passengerDoc.get('latestAuthorizationId')).toBe(authB.authorizationId);

    await manager.updateAuthorizationStatus({
      adultUid: guardianId,
      passengerId,
      authorizationId: authB.authorizationId,
      newStatus: 'revoked',
    });

    const [docAAfterRevokeB, docBAfterRevokeB] = await Promise.all([
      firestore.collection('passengerAuthorizations').doc(authA.authorizationId).get(),
      firestore.collection('passengerAuthorizations').doc(authB.authorizationId).get(),
    ]);

    expect(docAAfterRevokeB.get('status')).toBe('superseded');
    expect(docBAfterRevokeB.get('status')).toBe('revoked');
  });
});
