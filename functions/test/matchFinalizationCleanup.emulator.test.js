const admin = require('firebase-admin');
const { createFirestoreGpsCleanupRepository } = require('../src/firestoreGpsCleanupRepository');

const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '';
const projectId = process.env.GPS_FINALIZATION_EMULATOR_PROJECT_ID || '';
const emulatorEnabled = process.env.GPS_FINALIZATION_EMULATOR === 'true';
const emulatorDescribe = emulatorEnabled ? describe : describe.skip;

jest.setTimeout(120000);

if (
  emulatorEnabled &&
  (!projectId.startsWith('demo-') || !/^127\.0\.0\.1:8080$|^localhost:8080$/i.test(firestoreHost))
) {
  throw new Error('Match finalization tests require the local demo Firestore emulator.');
}

emulatorDescribe('match finalization cleanup (Firestore and Functions Emulators)', () => {
  let app;
  let firestore;
  const prefix = `match-finalization-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdMatchIds = new Set();
  const privateTrackingIds = new Set();
  const legacyPointIds = new Set();
  let sequence = 0;

  beforeAll(() => {
    app = admin.initializeApp({ projectId }, `match-finalization-${Date.now()}`);
    firestore = admin.firestore(app);
  });

  const seedMatch = async (status = 'active') => {
    const matchId = `${prefix}-${String(sequence++).padStart(3, '0')}`;
    createdMatchIds.add(matchId);
    const matchRef = firestore.collection('matches').doc(matchId);
    await matchRef.set({
      driverId: `${prefix}-driver`,
      parentId: `${prefix}-parent`,
      status,
      relationId: `${prefix}-relation`,
      preservedField: 'unchanged',
    });
    await matchRef
      .collection('tracking')
      .doc('current')
      .set({
        matchId,
        driverId: `${prefix}-driver`,
        latitude: 38.9072,
        longitude: -77.0369,
        speed: 0,
        active: true,
      });
    return matchId;
  };

  const waitForTrackingRemoval = async (matchId) => {
    const trackingRef = firestore
      .collection('matches')
      .doc(matchId)
      .collection('tracking')
      .doc('current');
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (!(await trackingRef.get()).exists) return;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error('Timed out waiting for the match finalization trigger.');
  };

  afterAll(async () => {
    for (const matchId of createdMatchIds) {
      const matchRef = firestore.collection('matches').doc(matchId);
      await matchRef.collection('tracking').doc('current').delete();
      await matchRef.delete();
    }
    const privateBatch = firestore.batch();
    for (const id of privateTrackingIds) {
      privateBatch.delete(firestore.collection('tracking').doc(id));
    }
    for (const id of legacyPointIds) {
      privateBatch.delete(firestore.collection('trackingPoints').doc(id));
    }
    await privateBatch.commit();
    await app.delete();
  });

  test.each(['completed', 'cancelled'])(
    'cleans only tracking/current after active -> %s and preserves relationships and legacy data',
    async (terminalStatus) => {
      const matchId = await seedMatch();
      const otherMatchId = await seedMatch('active');
      const privateId = `${prefix}-private-${sequence}`;
      const legacyPointId = `${prefix}-legacy-${sequence}`;
      privateTrackingIds.add(privateId);
      legacyPointIds.add(legacyPointId);
      await firestore
        .collection('tracking')
        .doc(privateId)
        .set({
          driverId: `${prefix}-driver`,
          latitude: 38.9072,
          longitude: -77.0369,
          active: false,
        });
      await firestore
        .collection('trackingPoints')
        .doc(legacyPointId)
        .set({
          userId: `${prefix}-driver`,
          latitude: 38.9072,
          longitude: -77.0369,
        });
      const matchRef = firestore.collection('matches').doc(matchId);
      const beforeTransition = (await matchRef.get()).data();

      await matchRef.update({ status: terminalStatus });
      await waitForTrackingRemoval(matchId);

      expect((await matchRef.get()).data()).toEqual({
        ...beforeTransition,
        status: terminalStatus,
      });
      expect(
        (
          await firestore
            .collection('matches')
            .doc(otherMatchId)
            .collection('tracking')
            .doc('current')
            .get()
        ).exists
      ).toBe(true);
      expect((await firestore.collection('tracking').doc(privateId).get()).exists).toBe(true);
      expect((await firestore.collection('trackingPoints').doc(legacyPointId).get()).exists).toBe(
        true
      );
    }
  );

  test('does not clean when status does not transition to a terminal state', async () => {
    const matchId = await seedMatch();
    const matchRef = firestore.collection('matches').doc(matchId);

    await matchRef.update({ preservedField: 'updated-without-status-transition' });
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect((await matchRef.collection('tracking').doc('current').get()).exists).toBe(true);
  });

  test('cleans pending -> cancelled matches without changing their status', async () => {
    const matchId = await seedMatch('pending');
    const matchRef = firestore.collection('matches').doc(matchId);

    await matchRef.update({ status: 'cancelled' });
    await waitForTrackingRemoval(matchId);

    expect((await matchRef.get()).get('status')).toBe('cancelled');
    expect((await matchRef.collection('tracking').doc('current').get()).exists).toBe(false);
  });

  test('repeated cleanup after a terminal transition is idempotent', async () => {
    const matchId = await seedMatch();
    const matchRef = firestore.collection('matches').doc(matchId);

    await matchRef.update({ status: 'completed' });
    await waitForTrackingRemoval(matchId);

    const repository = createFirestoreGpsCleanupRepository({ firestore });
    await expect(repository.deleteMatchCurrentTrackingIfTerminal(matchId)).resolves.toBe('missing');
    await expect(repository.deleteMatchCurrentTrackingIfTerminal(matchId)).resolves.toBe('missing');
    expect((await matchRef.get()).get('status')).toBe('completed');
  });

  test('transaction revalidation preserves location if a finalized match becomes active again', async () => {
    const matchId = await seedMatch('completed');
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
    const repository = createFirestoreGpsCleanupRepository({ firestore: gatedFirestore });
    const deletionPromise = repository.deleteMatchCurrentTrackingIfTerminal(matchId);
    await trackingReadReached;
    await matchRef.update({ status: 'active' });
    releaseTrackingRead();

    await expect(deletionPromise).resolves.toBe('skipped');
    expect((await matchRef.get()).get('status')).toBe('active');
    expect((await matchRef.collection('tracking').doc('current').get()).exists).toBe(true);
  });
});
