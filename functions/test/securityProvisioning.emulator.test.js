const admin = require('firebase-admin');

const authHost = '127.0.0.1:9099';
const functionsHost = '127.0.0.1:5001';
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST || '';
const projectId = process.env.SECURITY_PROVISIONING_EMULATOR_PROJECT_ID || '';
const emulatorEnabled = process.env.SECURITY_PROVISIONING_EMULATOR === 'true';
const emulatorDescribe = emulatorEnabled ? describe : describe.skip;

jest.setTimeout(120000);

if (
  emulatorEnabled &&
  (!projectId.startsWith('demo-') || !/^127\.0\.0\.1:8080$|^localhost:8080$/i.test(firestoreHost))
) {
  throw new Error('Security provisioning tests require local demo Firebase emulators.');
}

emulatorDescribe('profile provisioning and driver approval (Firebase emulators)', () => {
  const prefix = `security-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const authBaseUrl = `http://${authHost}/identitytoolkit.googleapis.com/v1`;
  const callableBaseUrl = `http://${functionsHost}/${projectId}/us-central1`;
  const createdUsers = [];
  let app;
  let firestore;

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

  const invokeCallable = async ({ name, idToken, data }) => {
    const response = await fetch(`${callableBaseUrl}/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({ data }),
    });
    return { status: response.status, body: await response.json() };
  };

  const getProfile = async (uid) => {
    const snapshot = await firestore.collection('users').doc(uid).get();
    return snapshot.exists ? snapshot.data() : null;
  };

  const getProfileWithRetry = async (uid, retries = 10, delayMs = 300) => {
    for (let i = 0; i < retries; i++) {
      const p = await getProfile(uid);
      if (p) return p;
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return getProfile(uid);
  };

  beforeAll(() => {
    app = admin.initializeApp({ projectId }, `security-provisioning-${Date.now()}`);
    firestore = admin.firestore(app);
  });

  afterAll(async () => {
    for (const user of createdUsers) {
      await firestore.collection('users').doc(user.uid).delete();
      await app
        .auth()
        .deleteUser(user.uid)
        .catch(() => {});
    }
    await app.delete();
  });

  test('registers in Auth and provisions one safe profile through the blocking trigger', async () => {
    const user = await createAuthUser('parent');

    const authAccount = await app.auth().getUser(user.uid);
    expect(authAccount.uid).toBe(user.uid);

    // Firebase CLI 15.28.1 invokes beforeUserCreated from Auth Emulator.
    const profile = await getProfileWithRetry(user.uid);
    expect(profile).toMatchObject({
      role: 'parent',
      approved: false,
    });

    const recovery = await invokeCallable({
      name: 'ensureUserProfile',
      idToken: user.idToken,
      data: {},
    });
    expect(recovery.status).toBe(200);
  });
});
