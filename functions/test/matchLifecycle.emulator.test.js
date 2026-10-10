const admin = require('firebase-admin');
const { createMatchLifecycleRepository } = require('../src/matchLifecycle');

const projectId = process.env.MATCH_LIFECYCLE_EMULATOR_PROJECT_ID || '';
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '';
const emulatorEnabled = process.env.MATCH_LIFECYCLE_EMULATOR === 'true';
const emulatorDescribe = emulatorEnabled ? describe : describe.skip;

jest.setTimeout(120000);

if (
  emulatorEnabled &&
  (!projectId.startsWith('demo-') || !/^127\.0\.0\.1:8080$|^localhost:8080$/i.test(firestoreHost))
) {
  throw new Error('Match lifecycle tests require the local demo Firestore emulator.');
}

emulatorDescribe('match lifecycle (Firestore Emulator)', () => {
  let app;
  let firestore;
  let repository;
  const prefix = `match-lifecycle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const requestIds = new Set();
  const vacancyIds = new Set();
  const matchIds = new Set();

  beforeAll(() => {
    app = admin.initializeApp({ projectId }, `match-lifecycle-${Date.now()}`);
    firestore = admin.firestore(app);
    repository = createMatchLifecycleRepository({ firestore });
  });

  const createVacancy = async (id, driverId = 'driver', totalSeats = 4) => {
    vacancyIds.add(id);
    await firestore
      .collection('vacancies')
      .doc(id)
      .set({
        driverId: `${prefix}-${driverId}`,
        driverName: 'Driver',
        driverPhone: '123',
        status: 'active',
        zone: 'Zona Norte',
        schedule: 'Mañana',
        totalSeats,
        availableSeats: totalSeats,
        reservedSeats: 0,
      });
  };

  const createUser = async (id, role) => {
    await firestore.collection('users').doc(`${prefix}-${id}`).set({ role });
  };

  const createRequestAndMatch = async ({ requestId, vacancyId, seats = 2 }) => {
    requestIds.add(requestId);
    const result = await repository.createOrAddMatch({
      actorUid: `${prefix}-parent`,
      requestId,
      vacancyId,
      requestData: {
        school: 'Colegio Uno',
        zone: 'Zona Norte',
        schedule: 'Mañana',
        childrenCount: seats,
        ages: '',
        specialNeeds: '',
      },
    });
    matchIds.add(result.matchId);
    return result;
  };

  beforeAll(async () => {
    await Promise.all([createUser('parent', 'parent'), createUser('driver', 'driver')]);
  });

  afterAll(async () => {
    for (const matchId of matchIds) {
      const ref = firestore.collection('matches').doc(matchId);
      await ref.collection('tracking').doc('current').delete();
      await ref.delete();
    }
    for (const requestId of requestIds) {
      await firestore.collection('requests').doc(requestId).delete();
    }
    for (const vacancyId of vacancyIds) {
      await firestore.collection('vacancies').doc(vacancyId).delete();
    }
    await firestore.collection('users').doc(`${prefix}-parent`).delete();
    await firestore.collection('users').doc(`${prefix}-driver`).delete();
    await app.delete();
  });

  test('creates, reserves, terminalizes, and removes current GPS atomically', async () => {
    const requestId = `${prefix}-request`;
    const vacancyId = `${prefix}-vacancy`;
    await createVacancy(vacancyId);
    const created = await createRequestAndMatch({ requestId, vacancyId });

    await expect(
      repository.acceptMatch({
        actorUid: `${prefix}-driver`,
        matchId: created.matchId,
      })
    ).resolves.toMatchObject({ status: 'active', idempotent: false });
    expect((await firestore.collection('vacancies').doc(vacancyId).get()).data()).toMatchObject({
      availableSeats: 2,
      reservedSeats: 2,
    });

    await firestore
      .collection('matches')
      .doc(created.matchId)
      .collection('tracking')
      .doc('current')
      .set({ latitude: 1, longitude: 2 });

    await repository.cancelMatch({
      actorUid: `${prefix}-parent`,
      matchId: created.matchId,
    });
    expect((await firestore.collection('matches').doc(created.matchId).get()).get('status')).toBe(
      'cancelled'
    );
    expect(
      (
        await firestore
          .collection('matches')
          .doc(created.matchId)
          .collection('tracking')
          .doc('current')
          .get()
      ).exists
    ).toBe(false);
    expect((await firestore.collection('vacancies').doc(vacancyId).get()).data()).toMatchObject({
      availableSeats: 4,
      reservedSeats: 0,
    });
  });

  test('only one of two concurrent matches for a request can reserve and activate', async () => {
    const requestId = `${prefix}-concurrent-request`;
    const firstVacancyId = `${prefix}-first-vacancy`;
    const secondVacancyId = `${prefix}-second-vacancy`;
    await Promise.all([createVacancy(firstVacancyId), createVacancy(secondVacancyId)]);
    const first = await createRequestAndMatch({ requestId, vacancyId: firstVacancyId });
    const second = await repository.createOrAddMatch({
      actorUid: `${prefix}-parent`,
      requestId,
      vacancyId: secondVacancyId,
    });
    matchIds.add(second.matchId);

    const results = await Promise.allSettled([
      repository.acceptMatch({ actorUid: `${prefix}-driver`, matchId: first.matchId }),
      repository.acceptMatch({ actorUid: `${prefix}-driver`, matchId: second.matchId }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const request = await firestore.collection('requests').doc(requestId).get();
    expect([first.matchId, second.matchId]).toContain(request.get('activeMatchId'));
    const activeMatchId = request.get('activeMatchId');
    const pendingMatchId = activeMatchId === first.matchId ? second.matchId : first.matchId;
    expect((await firestore.collection('matches').doc(pendingMatchId).get()).get('status')).toBe(
      'pending'
    );
    await repository.cancelMatch({
      actorUid: `${prefix}-parent`,
      matchId: activeMatchId,
    });
  });

  test('concurrent requests cannot over-reserve the same vacancy', async () => {
    const vacancyId = `${prefix}-capacity-vacancy`;
    const firstRequestId = `${prefix}-capacity-request-1`;
    const secondRequestId = `${prefix}-capacity-request-2`;
    await createVacancy(vacancyId, 'driver', 3);
    const first = await createRequestAndMatch({
      requestId: firstRequestId,
      vacancyId,
      seats: 2,
    });
    const second = await createRequestAndMatch({
      requestId: secondRequestId,
      vacancyId,
      seats: 2,
    });

    const results = await Promise.allSettled([
      repository.acceptMatch({ actorUid: `${prefix}-driver`, matchId: first.matchId }),
      repository.acceptMatch({ actorUid: `${prefix}-driver`, matchId: second.matchId }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect((await firestore.collection('vacancies').doc(vacancyId).get()).data()).toMatchObject({
      totalSeats: 3,
      availableSeats: 1,
      reservedSeats: 2,
    });

    const firstMatch = await firestore.collection('matches').doc(first.matchId).get();
    const activeMatchId = firstMatch.get('status') === 'active' ? first.matchId : second.matchId;
    await repository.cancelMatch({
      actorUid: `${prefix}-parent`,
      matchId: activeMatchId,
    });
  });

  test('deletes a request without matches and rejects every match status', async () => {
    const emptyRequestId = `${prefix}-deletable-request`;
    await firestore
      .collection('requests')
      .doc(emptyRequestId)
      .set({
        parentId: `${prefix}-parent`,
        status: 'active',
        childrenCount: 1,
      });
    requestIds.add(emptyRequestId);
    await expect(
      repository.deleteRequests({
        actorUid: `${prefix}-parent`,
        requestIds: [emptyRequestId],
      })
    ).resolves.toMatchObject({ deletedCount: 1 });
    expect((await firestore.collection('requests').doc(emptyRequestId).get()).exists).toBe(false);
    await expect(
      repository.deleteRequests({
        actorUid: `${prefix}-parent`,
        requestIds: [emptyRequestId],
      })
    ).resolves.toMatchObject({ deletedCount: 0 });

    const orphanedRequestId = `${prefix}-orphaned-request`;
    const orphanedMatchId = `${prefix}-orphaned-match`;
    matchIds.add(orphanedMatchId);
    await firestore.collection('matches').doc(orphanedMatchId).set({
      requestId: orphanedRequestId,
      status: 'completed',
    });
    await expect(
      repository.deleteRequests({
        actorUid: `${prefix}-parent`,
        requestIds: [orphanedRequestId],
      })
    ).rejects.toMatchObject({
      code: 'failed-precondition',
      reason: 'request-has-matches',
    });

    for (const status of ['pending', 'active', 'completed', 'cancelled']) {
      const requestId = `${prefix}-${status}-request`;
      const vacancyId = `${prefix}-${status}-vacancy`;
      await createVacancy(vacancyId);
      const { matchId } = await createRequestAndMatch({ requestId, vacancyId, seats: 1 });
      if (status === 'active' || status === 'completed') {
        await repository.acceptMatch({ actorUid: `${prefix}-driver`, matchId });
      }
      if (status === 'completed') {
        await repository.completeMatch({ actorUid: `${prefix}-driver`, matchId });
      } else if (status === 'cancelled') {
        await repository.cancelMatch({ actorUid: `${prefix}-parent`, matchId });
      }
      await expect(
        repository.deleteRequests({ actorUid: `${prefix}-parent`, requestIds: [requestId] })
      ).rejects.toMatchObject({
        code: 'failed-precondition',
        reason: 'request-has-matches',
      });
      expect((await firestore.collection('requests').doc(requestId).get()).exists).toBe(true);
    }
  });

  test('does not delete another parent request', async () => {
    const requestId = `${prefix}-owned-request`;
    await firestore
      .collection('requests')
      .doc(requestId)
      .set({
        parentId: `${prefix}-parent`,
        status: 'active',
      });
    requestIds.add(requestId);
    await createUser('outsider', 'parent');

    await expect(
      repository.deleteRequests({
        actorUid: `${prefix}-outsider`,
        requestIds: [requestId],
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect((await firestore.collection('requests').doc(requestId).get()).exists).toBe(true);
  });

  test('serializes concurrent request deletion and match creation', async () => {
    const requestId = `${prefix}-deletion-race-request`;
    const vacancyId = `${prefix}-deletion-race-vacancy`;
    await createVacancy(vacancyId);
    requestIds.add(requestId);
    await firestore
      .collection('requests')
      .doc(requestId)
      .set({
        parentId: `${prefix}-parent`,
        status: 'active',
        activeMatchId: null,
        school: 'Colegio Uno',
        zone: 'Zona Norte',
        schedule: 'Mañana',
        childrenCount: 1,
        ages: '',
        specialNeeds: '',
      });

    const results = await Promise.allSettled([
      repository.deleteRequests({
        actorUid: `${prefix}-parent`,
        requestIds: [requestId],
      }),
      repository.createOrAddMatch({
        actorUid: `${prefix}-parent`,
        requestId,
        vacancyId,
      }),
    ]);
    const deleteResult = results[0];
    const createResult = results[1];
    expect(deleteResult.status === 'fulfilled' && createResult.status === 'fulfilled').toBe(false);

    const requestExists = (await firestore.collection('requests').doc(requestId).get()).exists;
    const associatedMatches = await firestore
      .collection('matches')
      .where('requestId', '==', requestId)
      .get();
    expect(requestExists || associatedMatches.empty).toBe(true);
    associatedMatches.forEach((match) => matchIds.add(match.id));
  });
});
