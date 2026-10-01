if (!process.env.FIREBASE_EMULATOR_HOST) {
  process.env.FIREBASE_EMULATOR_HOST = '127.0.0.1:8080';
}
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import * as fs from 'fs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seed a /users/{uid} document via admin (security-rules-disabled) context. */
async function seedUser(
  testEnv: any,
  uid: string,
  data: Record<string, unknown>
): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
    await ctx.firestore().collection('users').doc(uid).set(data);
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Firestore Rules', () => {
  let testEnv: any;
  const projectId = 'furgokid';

  // Skip tests if not running under Firebase emulators (e.g., during `npm test`)
  const isEmulatorMode =
    !!process.env.FIREBASE_EMULATOR_HOST ||
    process.env.npm_lifecycle_event === 'test:rules';
  const runOrSkip = isEmulatorMode ? it : it.skip;

  beforeAll(async () => {
    if (!isEmulatorMode) return;
    testEnv = await initializeTestEnvironment({
      projectId,
      firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8'),
      },
    });
  });

  afterAll(async () => {
    if (!isEmulatorMode) return;
    await testEnv.cleanup();
  });

  // Clear Firestore state between every test so seeds don't bleed across cases.
  afterEach(async () => {
    if (!isEmulatorMode) return;
    await testEnv.clearFirestore();
  });

  // -------------------------------------------------------------------------
  // /users collection – basic ownership
  // -------------------------------------------------------------------------

  describe('/users – ownership', () => {
    runOrSkip('allows authenticated user to read their own seeded profile', async () => {
      const uid = 'alice';
      await seedUser(testEnv, uid, { role: 'parent', name: 'Alice' });

      await assertSucceeds(
        testEnv.authenticatedContext(uid).firestore().collection('users').doc(uid).get()
      );
    });

    runOrSkip('prevents unauthenticated user from reading any profile', async () => {
      await seedUser(testEnv, 'anyid', { role: 'parent' });

      await assertFails(
        testEnv.unauthenticatedContext().firestore().collection('users').doc('anyid').get()
      );
    });

    runOrSkip("prevents authenticated user from reading another user's profile", async () => {
      await seedUser(testEnv, 'alice', { role: 'parent', name: 'Alice' });
      await seedUser(testEnv, 'bob', { role: 'driver', name: 'Bob' });

      // Alice can read her own profile
      await assertSucceeds(
        testEnv.authenticatedContext('alice').firestore().collection('users').doc('alice').get()
      );

      // Bob cannot read Alice's profile (Bob is not admin)
      await assertFails(
        testEnv.authenticatedContext('bob').firestore().collection('users').doc('alice').get()
      );
    });
  });

  // -------------------------------------------------------------------------
  // /users collection – admin role
  // -------------------------------------------------------------------------

  describe('/users – admin role', () => {
    runOrSkip('allows admin to read another user profile', async () => {
      // Seed admin user so hasRole('admin') resolves correctly
      await seedUser(testEnv, 'admin-user', { role: 'admin' });
      await seedUser(testEnv, 'target-user', { role: 'parent', name: 'Target' });

      await assertSucceeds(
        testEnv
          .authenticatedContext('admin-user')
          .firestore()
          .collection('users')
          .doc('target-user')
          .get()
      );
    });

    runOrSkip('denies read of another profile when /users/{uid} doc is missing (no role)', async () => {
      // Seed only the target; the reader has NO /users document → hasRole returns false
      await seedUser(testEnv, 'target-user', { role: 'parent' });

      await assertFails(
        testEnv
          .authenticatedContext('no-doc-user')
          .firestore()
          .collection('users')
          .doc('target-user')
          .get()
      );
    });
  });

  // -------------------------------------------------------------------------
  // /routes collection – driver role
  // -------------------------------------------------------------------------

  describe('/routes – driver role', () => {
    runOrSkip('allows driver to create a route', async () => {
      await seedUser(testEnv, 'driver-user', { role: 'driver' });

      await assertSucceeds(
        testEnv
          .authenticatedContext('driver-user')
          .firestore()
          .collection('routes')
          .doc('route-1')
          .set({ driverId: 'driver-user', origin: 'A', destination: 'B' })
      );
    });

    runOrSkip('prevents a parent from creating a route', async () => {
      await seedUser(testEnv, 'parent-user', { role: 'parent' });

      await assertFails(
        testEnv
          .authenticatedContext('parent-user')
          .firestore()
          .collection('routes')
          .doc('route-2')
          .set({ driverId: 'parent-user', origin: 'A', destination: 'B' })
      );
    });

    runOrSkip('prevents a user without a /users doc from creating a route', async () => {
      // No seedUser call → hasRole('driver') returns false
      await assertFails(
        testEnv
          .authenticatedContext('ghost-user')
          .firestore()
          .collection('routes')
          .doc('route-3')
          .set({ driverId: 'ghost-user', origin: 'A', destination: 'B' })
      );
    });
  });

  // -------------------------------------------------------------------------
  // /requests collection – parent role
  // -------------------------------------------------------------------------

  describe('/requests – parent role', () => {
    runOrSkip('allows parent to create a request', async () => {
      await seedUser(testEnv, 'parent-user', { role: 'parent' });

      await assertSucceeds(
        testEnv
          .authenticatedContext('parent-user')
          .firestore()
          .collection('requests')
          .doc('req-1')
          .set({ parentId: 'parent-user', driverId: 'some-driver', status: 'pending' })
      );
    });

    runOrSkip('prevents a driver from creating a request', async () => {
      await seedUser(testEnv, 'driver-user', { role: 'driver' });

      await assertFails(
        testEnv
          .authenticatedContext('driver-user')
          .firestore()
          .collection('requests')
          .doc('req-2')
          .set({ parentId: 'driver-user', driverId: 'driver-user', status: 'pending' })
      );
    });

    runOrSkip('prevents a user without a /users doc from creating a request', async () => {
      await assertFails(
        testEnv
          .authenticatedContext('ghost-user')
          .firestore()
          .collection('requests')
          .doc('req-3')
          .set({ parentId: 'ghost-user', driverId: 'some-driver', status: 'pending' })
      );
    });
  });

  // -------------------------------------------------------------------------
  // /users collection – role escalation protection (SECURITY CRITICAL)
  // These tests use authenticatedContext (NOT withSecurityRulesDisabled) to
  // simulate real attacker attempts. They MUST fail with current rules.
  // -------------------------------------------------------------------------

  describe('/users – role escalation protection', () => {
    // Helper: create a profile via authenticatedContext (simulates real client write)
    async function createProfileAs(uid: string, profileData: Record<string, unknown>) {
      return testEnv
        .authenticatedContext(uid)
        .firestore()
        .collection('users')
        .doc(uid)
        .set(profileData);
    }

    // Helper: update a profile via authenticatedContext
    async function updateProfileAs(uid: string, updates: Record<string, unknown>) {
      return testEnv
        .authenticatedContext(uid)
        .firestore()
        .collection('users')
        .doc(uid)
        .update(updates);
    }

    runOrSkip('ATTACK: user without profile CANNOT create profile with role:admin', async () => {
      // Attacker has no /users doc → tries to create their own with role: 'admin'
      await assertFails(
        createProfileAs('attacker-no-profile', {
          role: 'admin',
          email: 'attacker@example.com',
          displayName: 'Attacker',
          createdAt: new Date(),
        })
      );
    });

    runOrSkip('ATTACK: user without profile CANNOT create profile with invalid role (superadmin)', async () => {
      // Attacker tries to create profile with arbitrary invalid role
      await assertFails(
        createProfileAs('attacker-invalid-role', {
          role: 'superadmin',
          email: 'attacker@example.com',
          displayName: 'Attacker',
          createdAt: new Date(),
        })
      );
    });

    runOrSkip('ATTACK: user without profile CANNOT create profile with invalid role (hacker)', async () => {
      // Attacker tries another arbitrary invalid role
      await assertFails(
        createProfileAs('attacker-invalid-role-2', {
          role: 'hacker',
          email: 'attacker2@example.com',
          displayName: 'Attacker 2',
          createdAt: new Date(),
        })
      );
    });

    runOrSkip('ATTACK: existing parent CANNOT update role to admin', async () => {
      // Seed a legitimate parent profile
      await seedUser(testEnv, 'legit-parent', { role: 'parent', name: 'Legit Parent' });

      // Parent tries to escalate to admin
      await assertFails(
        updateProfileAs('legit-parent', { role: 'admin' })
      );
    });

    runOrSkip('ATTACK: existing parent CANNOT update role to driver', async () => {
      await seedUser(testEnv, 'legit-parent-2', { role: 'parent', name: 'Legit Parent 2' });

      await assertFails(
        updateProfileAs('legit-parent-2', { role: 'driver' })
      );
    });

    runOrSkip('ATTACK: user CANNOT write another user\'s profile', async () => {
      await seedUser(testEnv, 'victim', { role: 'parent', name: 'Victim' });

      // Attacker tries to overwrite victim's profile
      await assertFails(
        testEnv
          .authenticatedContext('attacker')
          .firestore()
          .collection('users')
          .doc('victim')
          .set({ role: 'parent', name: 'Hacked' })
      );
    });

    // Positive test: legitimate profile creation with allowed role
    runOrSkip('LEGIT: user CAN create profile with role:parent', async () => {
      await assertSucceeds(
        createProfileAs('new-parent', {
          role: 'parent',
          email: 'newparent@example.com',
          displayName: 'New Parent',
          createdAt: new Date(),
        })
      );
    });

    runOrSkip('LEGIT: user CAN create profile with role:driver', async () => {
      await assertSucceeds(
        createProfileAs('new-driver', {
          role: 'driver',
          email: 'newdriver@example.com',
          displayName: 'New Driver',
          createdAt: new Date(),
        })
      );
    });

    // Positive test: user can update allowed fields (name, whatsapp, etc.)
    runOrSkip('LEGIT: user CAN update allowed profile fields (name, whatsapp)', async () => {
      await seedUser(testEnv, 'editable-user', { role: 'parent', name: 'Original', whatsapp: '+123' });

      await assertSucceeds(
        updateProfileAs('editable-user', { name: 'Updated Name', whatsapp: '+456' })
      );
    });
  });
});