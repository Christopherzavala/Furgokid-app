const admin = require('firebase-admin');
const { createGpsCleanup } = require('../src/gpsCleanup');
const { createFirestoreGpsCleanupRepository } = require('../src/firestoreGpsCleanupRepository');

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || '';
const projectId = process.env.GPS_CLEANUP_EMULATOR_PROJECT_ID || '';
const emulatorEnabled = process.env.GPS_CLEANUP_EMULATOR === 'true';

jest.setTimeout(120000);

if (
  emulatorEnabled &&
  (!/^127\.0\.0\.1:8080$|^localhost:8080$/i.test(emulatorHost) || !projectId.startsWith('demo-'))
) {
  throw new Error('GPS adapter integration tests require the local demo Firestore emulator.');
}

const emulatorDescribe = emulatorEnabled ? describe : describe.skip;

emulatorDescribe('Firestore GPS cleanup adapter (Firestore Emulator)', () => {
  const createdMatchIds = new Set();
  const firestoreApp = admin.initializeApp({ projectId }, `gps-cleanup-${Date.now()}`);
  const firestore = admin.firestore(firestoreApp);
  const repository = createFirestoreGpsCleanupRepository({ firestore });
  const prefix = `gps-cleanup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let sequence = 0;

  const nextMatchId = () => {
    const id = `${prefix}-${String(sequence++).padStart(4, '0')}`;
    createdMatchIds.add(id);
    return id;
  };

  const seedMatch = async ({
    id = nextMatchId(),
    driverId = 'verified-driver',
    parentId = 'parent-owner',
    status = 'active',
    withTracking = true,
  } = {}) => {
    const matchRef = firestore.collection('matches').doc(id);
    await matchRef.set({ driverId, parentId, status });
    if (withTracking) {
      await matchRef.collection('tracking').doc('current').set({
        matchId: id,
        driverId,
        latitude: -33.4489,
        longitude: -70.6693,
        speed: 0,
        active: true,
        updatedAt: admin.firestore.Timestamp.now(),
      });
    }
    return id;
  };

  const createCleanup = (driverId) =>
    createGpsCleanup({
      repository,
      authorizer: {
        authorizeMatchCleanup: async (matchId) => ({
          authorized: true,
          matchId,
          owner: { field: 'driverId', uid: driverId },
        }),
        getAuthorizedDriverId: async () => driverId,
      },
      logger: () => {},
    });

  const hasTracking = async (matchId) =>
    (await firestore.collection('matches').doc(matchId).collection('tracking').doc('current').get())
      .exists;

  afterAll(async () => {
    const ids = [...createdMatchIds];
    for (let offset = 0; offset < ids.length; offset += 400) {
      const batch = firestore.batch();
      for (const id of ids.slice(offset, offset + 400)) {
        const matchRef = firestore.collection('matches').doc(id);
        batch.delete(matchRef.collection('tracking').doc('current'));
        batch.delete(matchRef);
      }
      await batch.commit();
    }
    await firestoreApp.delete();
  });

  test('removes only the match location for the verified-owner scope supplied by the authorizer', async () => {
    const matchA = await seedMatch({ driverId: 'driver-A' });
    const matchB = await seedMatch({ driverId: 'driver-B' });

    const result = await createCleanup('driver-A').cleanupMatchCurrentTracking(matchA);

    expect(result).toMatchObject({ status: 'deleted', deletedCount: 1 });
    expect(await hasTracking(matchA)).toBe(false);
    expect(await hasTracking(matchB)).toBe(true);
  });

  test('rejects an owner scope that does not match the stored driver', async () => {
    const matchId = await seedMatch({ driverId: 'driver-A' });
    const result = await createCleanup('driver-B').cleanupMatchCurrentTracking(matchId);

    expect(result.status).toBe('denied');
    expect(await hasTracking(matchId)).toBe(true);
  });

  test('does not delete a match location after the match is no longer active', async () => {
    const matchId = await seedMatch({ status: 'completed' });

    const result = await repository.deleteMatchCurrentTracking(matchId, {
      field: 'driverId',
      uid: 'verified-driver',
    });

    expect(result).toBe('skipped');
    expect(await hasTracking(matchId)).toBe(true);
  });

  test('revalidates active status transactionally after a stale page result', async () => {
    const matchId = await seedMatch();
    const page = await repository.listActiveMatchesByDriver({
      driverId: 'verified-driver',
      pageToken: null,
      pageSize: 10,
    });
    expect(page.matches.map((match) => match.id)).toContain(matchId);

    await firestore.collection('matches').doc(matchId).update({ status: 'completed' });
    const deletion = await repository.deleteDriverCurrentTrackingIfActiveMatch(
      matchId,
      'verified-driver'
    );

    expect(deletion).toBe('skipped');
    expect(await hasTracking(matchId)).toBe(true);
  });

  test('does not delete after the match owner changes between query and transaction', async () => {
    const matchId = await seedMatch();
    const page = await repository.listActiveMatchesByDriver({
      driverId: 'verified-driver',
      pageToken: null,
      pageSize: 10,
    });
    expect(page.matches.map((match) => match.id)).toContain(matchId);

    await firestore.collection('matches').doc(matchId).update({ driverId: 'new-owner' });
    const deletion = await repository.deleteDriverCurrentTrackingIfActiveMatch(
      matchId,
      'verified-driver'
    );

    expect(deletion).toBe('skipped');
    expect(await hasTracking(matchId)).toBe(true);
  });

  test('retries the exact-match transaction when ownership changes during its reads', async () => {
    const matchId = await seedMatch();
    const matchRef = firestore.collection('matches').doc(matchId);
    let releaseTrackingRead;
    let notifyTrackingRead;
    const trackingReadReached = new Promise((resolve) => {
      notifyTrackingRead = resolve;
    });
    const trackingReadReleased = new Promise((resolve) => {
      releaseTrackingRead = resolve;
    });
    let gateFirstTrackingRead = true;
    const gatedFirestore = {
      collection: firestore.collection.bind(firestore),
      runTransaction: (updateFunction, options) =>
        firestore.runTransaction(
          (transaction) =>
            updateFunction({
              get: async (reference) => {
                const snapshot = await transaction.get(reference);
                if (
                  gateFirstTrackingRead &&
                  reference.path === `matches/${matchId}/tracking/current`
                ) {
                  gateFirstTrackingRead = false;
                  notifyTrackingRead();
                  await trackingReadReleased;
                }
                return snapshot;
              },
              delete: (reference) => transaction.delete(reference),
            }),
          options
        ),
    };
    const gatedRepository = createFirestoreGpsCleanupRepository({
      firestore: gatedFirestore,
    });

    const deletionPromise = gatedRepository.deleteMatchCurrentTracking(matchId, {
      field: 'driverId',
      uid: 'verified-driver',
    });
    await trackingReadReached;
    await matchRef.update({ driverId: 'changed-owner' });
    releaseTrackingRead();

    expect(await deletionPromise).toBe('denied');
    expect(await hasTracking(matchId)).toBe(true);
  });

  test('does not delete when a match becomes inactive during the cleanup transaction', async () => {
    const matchId = await seedMatch();
    const matchRef = firestore.collection('matches').doc(matchId);
    let releaseTrackingRead;
    let notifyTrackingRead;
    const trackingReadReached = new Promise((resolve) => {
      notifyTrackingRead = resolve;
    });
    const trackingReadReleased = new Promise((resolve) => {
      releaseTrackingRead = resolve;
    });
    let gateFirstTrackingRead = true;
    const gatedFirestore = {
      collection: firestore.collection.bind(firestore),
      runTransaction: (updateFunction, options) =>
        firestore.runTransaction(
          (transaction) =>
            updateFunction({
              get: async (reference) => {
                const snapshot = await transaction.get(reference);
                if (
                  gateFirstTrackingRead &&
                  reference.path === `matches/${matchId}/tracking/current`
                ) {
                  gateFirstTrackingRead = false;
                  notifyTrackingRead();
                  await trackingReadReleased;
                }
                return snapshot;
              },
              delete: (reference) => transaction.delete(reference),
            }),
          options
        ),
    };
    const gatedRepository = createFirestoreGpsCleanupRepository({
      firestore: gatedFirestore,
    });

    const deletionPromise = gatedRepository.deleteMatchCurrentTracking(matchId, {
      field: 'driverId',
      uid: 'verified-driver',
    });
    await trackingReadReached;
    await matchRef.update({ status: 'pending' });
    releaseTrackingRead();

    expect(await deletionPromise).toBe('skipped');
    expect((await matchRef.get()).get('status')).toBe('pending');
    expect(await hasTracking(matchId)).toBe(true);
  });

  test('missing match and missing tracking are distinct and idempotent', async () => {
    const missingMatch = `${prefix}-missing`;
    const missingMatchResult = await repository.deleteDriverCurrentTrackingIfActiveMatch(
      missingMatch,
      'verified-driver'
    );
    const matchWithoutTracking = await seedMatch({ withTracking: false });
    const missingLocationFirst = await repository.deleteDriverCurrentTrackingIfActiveMatch(
      matchWithoutTracking,
      'verified-driver'
    );
    const missingLocationAgain = await repository.deleteDriverCurrentTrackingIfActiveMatch(
      matchWithoutTracking,
      'verified-driver'
    );

    expect(missingMatchResult).toBe('match-missing');
    expect(missingLocationFirst).toBe('missing');
    expect(missingLocationAgain).toBe('missing');
  });

  test('paginates and cleans more than 500 matches without affecting inactive or foreign matches', async () => {
    const ids = [];
    for (let offset = 0; offset < 523; offset += 1) {
      ids.push(
        await seedMatch({
          id: nextMatchId(),
          driverId: 'bulk-driver',
          withTracking: true,
        })
      );
    }
    const inactiveId = await seedMatch({
      driverId: 'bulk-driver',
      status: 'completed',
    });
    const foreignId = await seedMatch({ driverId: 'other-driver' });

    const result = await createCleanup('bulk-driver').cleanupDriverActiveMatchTracking();

    expect(result).toMatchObject({
      complete: true,
      scannedCount: 523,
      deletedCount: 523,
      failedCount: 0,
    });
    expect(result.matchMissingCount).toBe(0);
    expect(await Promise.all(ids.map(hasTracking))).toEqual(Array(523).fill(false));
    expect(await hasTracking(inactiveId)).toBe(true);
    expect(await hasTracking(foreignId)).toBe(true);
  });
});
