const admin = require('firebase-admin');

const authHost = '127.0.0.1:9099';
const functionsHost = '127.0.0.1:5001';
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '';
const projectId = process.env.GPS_STOP_TRACKING_EMULATOR_PROJECT_ID || '';
const emulatorEnabled = process.env.GPS_STOP_TRACKING_EMULATOR === 'true';
const emulatorDescribe = emulatorEnabled ? describe : describe.skip;

jest.setTimeout(120000);

if (
  emulatorEnabled &&
  (!projectId.startsWith('demo-') || !/^127\.0\.0\.1:8080$|^localhost:8080$/i.test(firestoreHost))
) {
  throw new Error('stopTracking integration tests require local demo Firebase emulators.');
}

emulatorDescribe('stopTracking callable (Auth, Functions and Firestore Emulators)', () => {
  const createdMatchIds = new Set();
  const createdUsers = [];
  const app = admin.initializeApp({ projectId }, `stop-tracking-test-${Date.now()}`);
  const firestore = admin.firestore(app);
  const callableUrl = `http://${functionsHost}/${projectId}/us-central1/stopTracking`;
  const authBaseUrl = `http://${authHost}/identitytoolkit.googleapis.com/v1`;
  const prefix = `stop-tracking-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let sequence = 0;
  let driver;
  let otherDriver;
  let parent;

  const createAuthUser = async (label) => {
    const response = await fetch(`${authBaseUrl}/accounts:signUp?key=fake-api-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `${prefix}-${label}@example.test`,
        password: 'Test-password-1234',
        returnSecureToken: true,
      }),
    });
    const body = await response.json();
    if (!response.ok || !body.localId || !body.idToken) {
      throw new Error(`Auth Emulator could not create test user (${response.status}).`);
    }
    const user = { uid: body.localId, idToken: body.idToken };
    createdUsers.push(user);
    return user;
  };

  const seedMatch = async ({
    driverId = driver.uid,
    parentId = parent.uid,
    status = 'active',
    withTracking = true,
  } = {}) => {
    const matchId = `${prefix}-${String(sequence++).padStart(3, '0')}`;
    createdMatchIds.add(matchId);
    const matchRef = firestore.collection('matches').doc(matchId);
    await matchRef.set({ driverId, parentId, status });
    if (withTracking) {
      await matchRef.collection('tracking').doc('current').set({
        driverId,
        matchId,
        latitude: 41.8781,
        longitude: -87.6298,
        speed: 0,
        active: true,
        updatedAt: admin.firestore.Timestamp.now(),
      });
    }
    return matchId;
  };

  const invokeCallable = async ({ idToken, data }) => {
    const response = await fetch(callableUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({ data }),
    });
    return { status: response.status, body: await response.json() };
  };

  const hasTracking = async (matchId) =>
    (await firestore.collection('matches').doc(matchId).collection('tracking').doc('current').get())
      .exists;

  beforeAll(async () => {
    [driver, otherDriver, parent] = await Promise.all([
      createAuthUser('driver'),
      createAuthUser('other-driver'),
      createAuthUser('parent'),
    ]);
    await Promise.all([
      firestore.collection('users').doc(driver.uid).set({ role: 'driver' }),
      firestore.collection('users').doc(otherDriver.uid).set({ role: 'driver' }),
      firestore.collection('users').doc(parent.uid).set({ role: 'parent' }),
    ]);
  });

  afterAll(async () => {
    for (const matchId of createdMatchIds) {
      const matchRef = firestore.collection('matches').doc(matchId);
      await matchRef.collection('tracking').doc('current').delete();
      await matchRef.delete();
    }
    await Promise.all(
      createdUsers.map(async ({ uid, idToken }) => {
        await firestore.collection('users').doc(uid).delete();
        await fetch(`${authBaseUrl}/accounts:delete?key=fake-api-key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
      })
    );
    await app.delete();
  });

  test('rejects a request without authentication', async () => {
    const matchId = await seedMatch();

    const response = await invokeCallable({ data: { matchId } });

    expect(response.body.error.status).toBe('UNAUTHENTICATED');
    expect(await hasTracking(matchId)).toBe(true);
  });

  test('allows the authenticated driver and deletes only the selected current point', async () => {
    const matchA = await seedMatch();
    const matchB = await seedMatch();
    const before = (await firestore.collection('matches').doc(matchA).get()).data();

    const response = await invokeCallable({
      idToken: driver.idToken,
      data: { matchId: matchA },
    });
    const repeatedResponse = await invokeCallable({
      idToken: driver.idToken,
      data: { matchId: matchA },
    });

    expect(response.body.result).toEqual({ status: 'stopped', locationDeleted: true });
    expect(repeatedResponse.body.result).toEqual({
      status: 'already-stopped',
      locationDeleted: false,
    });
    expect(await hasTracking(matchA)).toBe(false);
    expect(await hasTracking(matchB)).toBe(true);
    expect((await firestore.collection('matches').doc(matchA).get()).data()).toEqual(before);
  });

  test('rejects a different driver and ignores forged client identity or owner fields', async () => {
    const ownedByOther = await seedMatch({ driverId: otherDriver.uid });
    const matchId = await seedMatch();

    const unauthorized = await invokeCallable({
      idToken: driver.idToken,
      data: {
        matchId: ownedByOther,
        uid: otherDriver.uid,
        driverId: otherDriver.uid,
        parentId: otherDriver.uid,
        owner: { field: 'driverId', uid: otherDriver.uid },
        role: 'admin',
      },
    });
    const forgedOwner = await invokeCallable({
      idToken: driver.idToken,
      data: {
        matchId,
        uid: otherDriver.uid,
        driverId: otherDriver.uid,
        owner: { field: 'driverId', uid: otherDriver.uid },
      },
    });

    expect(unauthorized.body.error.status).toBe('PERMISSION_DENIED');
    expect(forgedOwner.body.result).toEqual({ status: 'stopped', locationDeleted: true });
    expect(await hasTracking(ownedByOther)).toBe(true);
    expect(await hasTracking(matchId)).toBe(false);
  });

  test('rejects parent profiles and missing or invalid match IDs', async () => {
    const matchId = await seedMatch();
    const parentResponse = await invokeCallable({
      idToken: parent.idToken,
      data: { matchId },
    });
    const missingId = await invokeCallable({ idToken: driver.idToken, data: {} });
    const invalidId = await invokeCallable({
      idToken: driver.idToken,
      data: { matchId: '../other' },
    });

    expect(parentResponse.body.error.status).toBe('PERMISSION_DENIED');
    expect(missingId.body.error.status).toBe('INVALID_ARGUMENT');
    expect(invalidId.body.error.status).toBe('INVALID_ARGUMENT');
    expect(await hasTracking(matchId)).toBe(true);
  });

  test('returns not-found for absent matches and is idempotent for absent locations', async () => {
    const missingMatch = `${prefix}-absent`;
    const noLocation = await seedMatch({ withTracking: false });

    const missingMatchResponse = await invokeCallable({
      idToken: driver.idToken,
      data: { matchId: missingMatch },
    });
    const firstStop = await invokeCallable({
      idToken: driver.idToken,
      data: { matchId: noLocation },
    });
    const repeatedStop = await invokeCallable({
      idToken: driver.idToken,
      data: { matchId: noLocation },
    });

    expect(missingMatchResponse.body.error.status).toBe('NOT_FOUND');
    expect(firstStop.body.result).toEqual({ status: 'already-stopped', locationDeleted: false });
    expect(repeatedStop.body.result).toEqual({ status: 'already-stopped', locationDeleted: false });
  });

  test('refuses inactive matches without changing the match or its current point', async () => {
    const matchId = await seedMatch({ status: 'completed' });
    const before = (await firestore.collection('matches').doc(matchId).get()).data();

    const response = await invokeCallable({
      idToken: driver.idToken,
      data: { matchId },
    });

    expect(response.body.error.status).toBe('FAILED_PRECONDITION');
    expect(await hasTracking(matchId)).toBe(true);
    expect((await firestore.collection('matches').doc(matchId).get()).data()).toEqual(before);
  });
});
