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
    expect(await getProfile(user.uid)).toMatchObject({
      role: 'parent',
      approved: false,
    });

    const recovery = await invokeCallable({
      name: 'ensureUserProfile',
      idToken: user.idToken,
      data: {},
    });
    expect(recovery.body.result).toEqual({ created: false });
    expect(await getProfile(user.uid)).toMatchObject({
      role: 'parent',
      approved: false,
    });
  });

  test('does not overwrite an existing profile during recovery', async () => {
    const user = await createAuthUser('existing');
    await firestore.collection('users').doc(user.uid).set({
      role: 'parent',
      approved: false,
      displayName: 'Existing name',
    });

    const response = await invokeCallable({
      name: 'ensureUserProfile',
      idToken: user.idToken,
      data: {},
    });

    expect(response.body.result).toEqual({ created: false });
    expect(await getProfile(user.uid)).toMatchObject({
      role: 'parent',
      approved: false,
      displayName: 'Existing name',
    });
  });

  test('rejects unauthenticated driver request and review calls', async () => {
    const request = await invokeCallable({
      name: 'requestDriverApproval',
      data: {},
    });
    const review = await invokeCallable({
      name: 'reviewDriverRequest',
      data: { targetUid: 'some-user', decision: 'approve' },
    });

    expect(request.body.error.status).toBe('UNAUTHENTICATED');
    expect(review.body.error.status).toBe('UNAUTHENTICATED');
  });

  test('enforces requester identity and server-side admin authorization', async () => {
    const normal = await createAuthUser('normal');
    const target = await createAuthUser('target');
    await Promise.all([
      firestore.collection('users').doc(normal.uid).set({
        role: 'parent',
        approved: false,
      }),
      firestore.collection('users').doc(target.uid).set({
        role: 'parent',
        approved: false,
      }),
    ]);

    const request = await invokeCallable({
      name: 'requestDriverApproval',
      idToken: normal.idToken,
      data: {},
    });
    expect(request.body.result).toEqual({ status: 'pending', idempotent: false });

    const duplicateRequest = await invokeCallable({
      name: 'requestDriverApproval',
      idToken: normal.idToken,
      data: {},
    });
    expect(duplicateRequest.body.result).toEqual({
      status: 'pending',
      idempotent: true,
    });

    const selfApproval = await invokeCallable({
      name: 'reviewDriverRequest',
      idToken: normal.idToken,
      data: { targetUid: normal.uid, decision: 'approve' },
    });
    const otherApproval = await invokeCallable({
      name: 'reviewDriverRequest',
      idToken: normal.idToken,
      data: { targetUid: target.uid, decision: 'approve' },
    });
    expect(selfApproval.body.error.status).toBe('PERMISSION_DENIED');
    expect(otherApproval.body.error.status).toBe('PERMISSION_DENIED');
  });

  test('allows an authorized admin to approve and rejects invalid transitions', async () => {
    const adminUser = await createAuthUser('admin');
    const target = await createAuthUser('approved-target');
    await Promise.all([
      firestore.collection('users').doc(adminUser.uid).set({
        role: 'admin',
        approved: false,
      }),
      firestore.collection('users').doc(target.uid).set({
        role: 'parent',
        approved: false,
        driverRequestStatus: 'pending',
      }),
    ]);

    const approval = await invokeCallable({
      name: 'reviewDriverRequest',
      idToken: adminUser.idToken,
      data: { targetUid: target.uid, decision: 'approve' },
    });
    const duplicateApproval = await invokeCallable({
      name: 'reviewDriverRequest',
      idToken: adminUser.idToken,
      data: { targetUid: target.uid, decision: 'approve' },
    });
    const invalidTransition = await invokeCallable({
      name: 'reviewDriverRequest',
      idToken: adminUser.idToken,
      data: { targetUid: target.uid, decision: 'reject' },
    });

    expect(approval.body.result).toEqual({ status: 'approved', idempotent: false });
    expect(duplicateApproval.body.result).toEqual({
      status: 'approved',
      idempotent: true,
    });
    expect(invalidTransition.body.error.status).toBe('FAILED_PRECONDITION');
    expect(await getProfile(target.uid)).toMatchObject({
      role: 'driver',
      approved: true,
      driverRequestStatus: 'approved',
    });
  });
});
