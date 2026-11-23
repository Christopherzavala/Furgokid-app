if (!process.env.FIREBASE_EMULATOR_HOST) {
  process.env.FIREBASE_EMULATOR_HOST = '127.0.0.1:8080';
}
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seed a /users/{uid} document via admin (security-rules-disabled) context. */
async function seedUser(testEnv: any, uid: string, data: Record<string, unknown>): Promise<void> {
  await seedDocument(testEnv, `users/${uid}`, data);
}

/** Seed any document via admin (security-rules-disabled) context. */
async function seedDocument(
  testEnv: any,
  path: string,
  data: Record<string, unknown>
): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
    await ctx.firestore().doc(path).set(data);
  });
}

/** Seed the participant profiles and active match used by match/tracking tests. */
async function seedMatchFixture(
  testEnv: any,
  matchId = 'match-1',
  overrides: Record<string, unknown> = {}
): Promise<void> {
  await seedUser(testEnv, 'match-parent', { role: 'parent', approved: false });
  await seedUser(testEnv, 'match-driver', { role: 'driver', approved: true });
  await seedDocument(testEnv, `matches/${matchId}`, {
    parentId: 'match-parent',
    driverId: 'match-driver',
    status: 'active',
    ...overrides,
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
    !!process.env.FIREBASE_EMULATOR_HOST || process.env.npm_lifecycle_event === 'test:rules';
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

    runOrSkip(
      'denies read of another profile when /users/{uid} doc is missing (no role)',
      async () => {
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
      }
    );
  });

  // -------------------------------------------------------------------------
  // /routes collection – driver role
  // -------------------------------------------------------------------------

  describe('/routes – driver role', () => {
    runOrSkip('allows driver to create a route', async () => {
      await seedUser(testEnv, 'driver-user', { role: 'driver', approved: true });

      await assertSucceeds(
        testEnv
          .authenticatedContext('driver-user')
          .firestore()
          .collection('routes')
          .doc('route-1')
          .set({ driverId: 'driver-user', origin: 'A', destination: 'B' })
      );
    });

    runOrSkip('prevents route owner from transferring ownership by changing driverId', async () => {
      await seedUser(testEnv, 'driver-user', { role: 'driver', approved: true });
      await seedDocument(testEnv, 'routes/route-transfer', {
        driverId: 'driver-user',
        origin: 'A',
        destination: 'B',
      });

      await assertFails(
        testEnv
          .authenticatedContext('driver-user')
          .firestore()
          .collection('routes')
          .doc('route-transfer')
          .update({ driverId: 'other-driver' })
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
    runOrSkip(
      'allows parent to create valid request matching ParentRequestScreen schema',
      async () => {
        const { Timestamp } = jest.requireActual('@firebase/firestore');
        await seedUser(testEnv, 'parent-user', { role: 'parent' });

        await assertSucceeds(
          testEnv
            .authenticatedContext('parent-user')
            .firestore()
            .collection('requests')
            .doc('req-1')
            .set({
              parentId: 'parent-user',
              parentName: 'Parent Test',
              parentPhone: '+56912345678',
              school: 'Colegio San Jose',
              zone: 'Norte',
              schedule: 'Entrada',
              childrenCount: 2,
              ages: '7, 9',
              specialNeeds: '',
              createdAt: Timestamp.now(),
              status: 'active',
            })
        );
      }
    );

    runOrSkip('prevents parent from creating request with disallowed fields', async () => {
      const { Timestamp } = jest.requireActual('@firebase/firestore');
      await seedUser(testEnv, 'parent-user', { role: 'parent' });

      await assertFails(
        testEnv
          .authenticatedContext('parent-user')
          .firestore()
          .collection('requests')
          .doc('req-1')
          .set({
            parentId: 'parent-user',
            school: 'Colegio San Jose',
            zone: 'Norte',
            schedule: 'Entrada',
            childrenCount: 2,
            createdAt: Timestamp.now(),
            status: 'active',
            childrenNames: 'Hacked name',
          })
      );
    });

    runOrSkip('prevents parent from creating request with invalid childrenCount', async () => {
      const { Timestamp } = jest.requireActual('@firebase/firestore');
      await seedUser(testEnv, 'parent-user', { role: 'parent' });

      await assertFails(
        testEnv
          .authenticatedContext('parent-user')
          .firestore()
          .collection('requests')
          .doc('req-1')
          .set({
            parentId: 'parent-user',
            school: 'Colegio San Jose',
            zone: 'Norte',
            schedule: 'Entrada',
            childrenCount: 0,
            createdAt: Timestamp.now(),
            status: 'active',
          })
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

    runOrSkip(
      'ATTACK: user without profile CANNOT create profile with invalid role (superadmin)',
      async () => {
        // Attacker tries to create profile with arbitrary invalid role
        await assertFails(
          createProfileAs('attacker-invalid-role', {
            role: 'superadmin',
            email: 'attacker@example.com',
            displayName: 'Attacker',
            createdAt: new Date(),
          })
        );
      }
    );

    runOrSkip(
      'ATTACK: user without profile CANNOT create profile with invalid role (hacker)',
      async () => {
        // Attacker tries another arbitrary invalid role
        await assertFails(
          createProfileAs('attacker-invalid-role-2', {
            role: 'hacker',
            email: 'attacker2@example.com',
            displayName: 'Attacker 2',
            createdAt: new Date(),
          })
        );
      }
    );

    runOrSkip('ATTACK: existing parent CANNOT update role to admin', async () => {
      // Seed a legitimate parent profile
      await seedUser(testEnv, 'legit-parent', { role: 'parent', name: 'Legit Parent' });

      // Parent tries to escalate to admin
      await assertFails(updateProfileAs('legit-parent', { role: 'admin' }));
    });

    runOrSkip('ATTACK: existing parent CANNOT update role to driver', async () => {
      await seedUser(testEnv, 'legit-parent-2', { role: 'parent', name: 'Legit Parent 2' });

      await assertFails(updateProfileAs('legit-parent-2', { role: 'driver' }));
    });

    runOrSkip("ATTACK: user CANNOT write another user's profile", async () => {
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

    // Client-side profile creation is forbidden for every role. The backend
    // provisioning path uses the Admin SDK and therefore bypasses these rules.
    runOrSkip('SECURITY: client CANNOT create a parent profile', async () => {
      await assertFails(
        createProfileAs('new-parent', {
          role: 'parent',
          email: 'newparent@example.com',
          displayName: 'New Parent',
          createdAt: new Date(),
        })
      );
    });

    runOrSkip('SECURITY: client CANNOT create a driver profile', async () => {
      await assertFails(
        createProfileAs('new-driver', {
          role: 'driver',
          email: 'newdriver@example.com',
          displayName: 'New Driver',
          createdAt: new Date(),
        })
      );
    });

    runOrSkip('SERVER-SIDE: admin CAN provision a parent profile', async () => {
      await assertSucceeds(
        testEnv.withSecurityRulesDisabled(async (ctx: any) => {
          await ctx.firestore().collection('users').doc('server-parent').set({
            role: 'parent',
            approved: false,
            email: 'serverparent@example.com',
            displayName: 'Server Parent',
            createdAt: new Date(),
          });
        })
      );
    });

    runOrSkip('LEGIT: user CAN update allowed profile fields (name, whatsapp)', async () => {
      await seedUser(testEnv, 'editable-user', {
        role: 'parent',
        name: 'Original',
        whatsapp: '+123',
        approved: false,
      });

      await assertSucceeds(
        updateProfileAs('editable-user', { name: 'Updated Name', whatsapp: '+456' })
      );
    });

    runOrSkip('ATTACK: user CANNOT add an approval flag to their profile', async () => {
      await seedUser(testEnv, 'unapproved-user', { role: 'driver', name: 'Driver' });

      await assertFails(updateProfileAs('unapproved-user', { approved: true }));
    });

    runOrSkip('ATTACK: user CANNOT approve themselves', async () => {
      await seedUser(testEnv, 'driver-user', { role: 'driver', approved: false });

      await assertFails(updateProfileAs('driver-user', { approved: true }));
    });

    runOrSkip('ATTACK: user CANNOT revoke their own approval', async () => {
      await seedUser(testEnv, 'approved-driver', { role: 'driver', approved: true });

      await assertFails(updateProfileAs('approved-driver', { approved: false }));
    });

    runOrSkip('ATTACK: user CANNOT remove the privileged approval field', async () => {
      await seedUser(testEnv, 'approved-driver-2', { role: 'driver', approved: true });
      const { deleteField } = jest.requireActual('@firebase/firestore');

      await assertFails(updateProfileAs('approved-driver-2', { approved: deleteField() }));
    });

    runOrSkip('ATTACK: user CANNOT remove the privileged role field', async () => {
      await seedUser(testEnv, 'parent-role', { role: 'parent', approved: false });
      const { deleteField } = jest.requireActual('@firebase/firestore');

      await assertFails(updateProfileAs('parent-role', { role: deleteField() }));
    });

    runOrSkip('ATTACK: user CANNOT add driver request state directly', async () => {
      await seedUser(testEnv, 'driver-request-add', {
        role: 'parent',
        approved: false,
      });

      await assertFails(
        updateProfileAs('driver-request-add', {
          driverRequestStatus: 'pending',
          driverRequestUpdatedAt: new Date(),
        })
      );
    });

    runOrSkip('ATTACK: user CANNOT change driver request state directly', async () => {
      await seedUser(testEnv, 'driver-request-change', {
        role: 'parent',
        approved: false,
        driverRequestStatus: 'pending',
        driverRequestUpdatedAt: new Date('2026-01-01'),
      });

      await assertFails(
        updateProfileAs('driver-request-change', {
          driverRequestStatus: 'approved',
        })
      );
    });

    runOrSkip('ATTACK: user CANNOT remove driver request state directly', async () => {
      await seedUser(testEnv, 'driver-request-remove', {
        role: 'parent',
        approved: false,
        driverRequestStatus: 'pending',
        driverRequestUpdatedAt: new Date('2026-01-01'),
      });
      const { deleteField } = jest.requireActual('@firebase/firestore');

      await assertFails(
        updateProfileAs('driver-request-remove', {
          driverRequestStatus: deleteField(),
          driverRequestUpdatedAt: deleteField(),
        })
      );
    });

    runOrSkip(
      'LEGIT: user CAN update normal fields while backend request state is unchanged',
      async () => {
        await seedUser(testEnv, 'driver-request-unchanged', {
          role: 'parent',
          approved: false,
          driverRequestStatus: 'pending',
          driverRequestUpdatedAt: new Date('2026-01-01'),
        });

        await assertSucceeds(
          updateProfileAs('driver-request-unchanged', {
            displayName: 'Updated display name',
          })
        );
      }
    );
  });
  // -------------------------------------------------------------------------
  // /users – child-data containment
  // -------------------------------------------------------------------------

  describe('/users – child-data containment', () => {
    const uid = 'parent-with-children';

    async function updateProfileAs(updates: Record<string, unknown>) {
      return testEnv
        .authenticatedContext(uid)
        .firestore()
        .collection('users')
        .doc(uid)
        .update(updates);
    }

    runOrSkip('BLOCKED: owner cannot add childrenCount', async () => {
      await seedUser(testEnv, uid, { role: 'parent', approved: false });

      await assertFails(updateProfileAs({ childrenCount: 1 }));
    });

    runOrSkip('BLOCKED: owner cannot add childrenNames', async () => {
      await seedUser(testEnv, uid, { role: 'parent', approved: false });

      await assertFails(updateProfileAs({ childrenNames: 'Child Name' }));
    });

    runOrSkip('BLOCKED: owner cannot add childrenAges', async () => {
      await seedUser(testEnv, uid, { role: 'parent', approved: false });

      await assertFails(updateProfileAs({ childrenAges: '7' }));
    });

    runOrSkip('BLOCKED: owner cannot add school', async () => {
      await seedUser(testEnv, uid, { role: 'parent', approved: false });

      await assertFails(updateProfileAs({ school: 'School Name' }));
    });

    runOrSkip('BLOCKED: owner cannot modify existing child data', async () => {
      await seedUser(testEnv, uid, {
        role: 'parent',
        approved: false,
        childrenCount: 1,
        childrenNames: 'Old Name',
        childrenAges: '7',
        school: 'Old School',
      });

      await assertFails(updateProfileAs({ childrenNames: 'New Name' }));
      await assertFails(updateProfileAs({ childrenAges: '8' }));
      await assertFails(updateProfileAs({ school: 'New School' }));
    });

    runOrSkip('LEGIT: owner can update non-child profile fields', async () => {
      await seedUser(testEnv, uid, {
        role: 'parent',
        approved: false,
        childrenCount: 1,
        childrenNames: 'Child Name',
        childrenAges: '7',
        school: 'School Name',
      });

      await assertSucceeds(
        updateProfileAs({ name: 'Updated Parent', emergencyContact: '+56912345678' })
      );
    });

    runOrSkip('BLOCKED: owner cannot write child data to another profile', async () => {
      await seedUser(testEnv, uid, { role: 'parent', approved: false });
      await seedUser(testEnv, 'other-parent', { role: 'parent', approved: false });

      await assertFails(
        testEnv
          .authenticatedContext(uid)
          .firestore()
          .collection('users')
          .doc('other-parent')
          .update({ childrenNames: 'Child Name' })
      );
    });

    runOrSkip('LEGIT: owner can remove existing child data', async () => {
      await seedUser(testEnv, uid, {
        role: 'parent',
        approved: false,
        childrenNames: 'Child Name',
        school: 'School Name',
      });
      const { deleteField } = jest.requireActual('@firebase/firestore');

      await assertSucceeds(
        updateProfileAs({ childrenNames: deleteField(), school: deleteField() })
      );
    });

    runOrSkip('BLOCKED: owner cannot recreate removed child data', async () => {
      await seedUser(testEnv, uid, {
        role: 'parent',
        approved: false,
        childrenNames: 'Child Name',
      });
      const { deleteField } = jest.requireActual('@firebase/firestore');

      await assertSucceeds(updateProfileAs({ childrenNames: deleteField() }));
      await assertFails(updateProfileAs({ childrenNames: 'Child Name Again' }));
    });
  });

  // -------------------------------------------------------------------------
  // /matches – ownership and authorization
  // -------------------------------------------------------------------------

  describe('/matches – ownership and authorization', () => {
    runOrSkip('allows the assigned parent to read the match', async () => {
      await seedMatchFixture(testEnv);

      await assertSucceeds(
        testEnv
          .authenticatedContext('match-parent')
          .firestore()
          .collection('matches')
          .doc('match-1')
          .get()
      );
    });

    runOrSkip('allows the assigned approved driver to read the match', async () => {
      await seedMatchFixture(testEnv);

      await assertSucceeds(
        testEnv
          .authenticatedContext('match-driver')
          .firestore()
          .collection('matches')
          .doc('match-1')
          .get()
      );
    });

    runOrSkip('prevents an unrelated user from reading the match', async () => {
      await seedMatchFixture(testEnv);
      await seedUser(testEnv, 'other-parent', { role: 'parent', approved: false });

      await assertFails(
        testEnv
          .authenticatedContext('other-parent')
          .firestore()
          .collection('matches')
          .doc('match-1')
          .get()
      );
    });

    runOrSkip('prevents an unapproved assigned driver from reading the match', async () => {
      await seedMatchFixture(testEnv);
      await seedUser(testEnv, 'match-driver', { role: 'driver', approved: false });

      await assertFails(
        testEnv
          .authenticatedContext('match-driver')
          .firestore()
          .collection('matches')
          .doc('match-1')
          .get()
      );
    });

    runOrSkip('allows an assigned parent to query only their active matches', async () => {
      await seedMatchFixture(testEnv, 'match-owned');
      await seedMatchFixture(testEnv, 'match-foreign', { parentId: 'other-parent' });
      await seedUser(testEnv, 'other-parent', { role: 'parent', approved: false });
      const matches = await testEnv
        .authenticatedContext('match-parent')
        .firestore()
        .collection('matches')
        .where('parentId', '==', 'match-parent')
        .where('status', '==', 'active')
        .get();

      expect(matches.docs.map((match) => match.id)).toEqual(['match-owned']);

      const foreignMatches = await testEnv
        .authenticatedContext('other-parent')
        .firestore()
        .collection('matches')
        .where('parentId', '==', 'other-parent')
        .where('status', '==', 'active')
        .get();

      expect(foreignMatches.docs.map((match) => match.id)).toEqual(['match-foreign']);
    });

    runOrSkip('prevents clients from creating or changing matches', async () => {
      await seedMatchFixture(testEnv);

      await assertFails(
        testEnv
          .authenticatedContext('match-parent')
          .firestore()
          .collection('matches')
          .doc('client-match')
          .set({ parentId: 'match-parent', driverId: 'match-driver', status: 'active' })
      );
      await assertFails(
        testEnv
          .authenticatedContext('match-parent')
          .firestore()
          .collection('matches')
          .doc('match-1')
          .update({ status: 'completed' })
      );
    });
  });

  // -------------------------------------------------------------------------
  // /matches/{matchId}/tracking/current – access and writes
  // -------------------------------------------------------------------------

  describe('/matches/{matchId}/tracking/current', () => {
    function freshTrackingData(overrides: Record<string, unknown> = {}) {
      const { Timestamp } = jest.requireActual('@firebase/firestore');
      return {
        latitude: -33.4489,
        longitude: -70.6693,
        speed: 0,
        active: true,
        updatedAt: Timestamp.now(),
        ...overrides,
      };
    }

    runOrSkip('allows the assigned parent to read fresh tracking', async () => {
      await seedMatchFixture(testEnv);
      await seedDocument(testEnv, 'matches/match-1/tracking/current', freshTrackingData());

      await assertSucceeds(
        testEnv
          .authenticatedContext('match-parent')
          .firestore()
          .doc('matches/match-1/tracking/current')
          .get()
      );
    });

    runOrSkip('prevents an unrelated user from reading tracking', async () => {
      await seedMatchFixture(testEnv);
      await seedUser(testEnv, 'other-parent', { role: 'parent', approved: false });
      await seedDocument(testEnv, 'matches/match-1/tracking/current', freshTrackingData());

      await assertFails(
        testEnv
          .authenticatedContext('other-parent')
          .firestore()
          .doc('matches/match-1/tracking/current')
          .get()
      );
    });

    runOrSkip('prevents participants from reading tracking for a completed match', async () => {
      await seedMatchFixture(testEnv, 'match-1', { status: 'completed' });
      await seedDocument(testEnv, 'matches/match-1/tracking/current', freshTrackingData());

      await assertFails(
        testEnv
          .authenticatedContext('match-parent')
          .firestore()
          .doc('matches/match-1/tracking/current')
          .get()
      );
    });

    runOrSkip('allows the assigned approved driver to update tracking', async () => {
      await seedMatchFixture(testEnv);
      const driverDb = testEnv.authenticatedContext('match-driver').firestore();

      await assertSucceeds(
        driverDb.doc('matches/match-1/tracking/current').set(freshTrackingData())
      );
    });

    runOrSkip('prevents the assigned parent from writing tracking', async () => {
      await seedMatchFixture(testEnv);

      await assertFails(
        testEnv
          .authenticatedContext('match-parent')
          .firestore()
          .doc('matches/match-1/tracking/current')
          .set(freshTrackingData())
      );
    });

    runOrSkip('prevents an unapproved driver from writing tracking', async () => {
      await seedMatchFixture(testEnv);
      await seedUser(testEnv, 'match-driver', { role: 'driver', approved: false });

      await assertFails(
        testEnv
          .authenticatedContext('match-driver')
          .firestore()
          .doc('matches/match-1/tracking/current')
          .set(freshTrackingData())
      );
    });

    runOrSkip('prevents an approved driver from forging another driverId', async () => {
      await seedMatchFixture(testEnv);

      await assertFails(
        testEnv
          .authenticatedContext('match-driver')
          .firestore()
          .doc('matches/match-1/tracking/current')
          .set(freshTrackingData({ driverId: 'another-driver' }))
      );
    });

    runOrSkip('prevents an approved driver from forging another matchId', async () => {
      await seedMatchFixture(testEnv);

      await assertFails(
        testEnv
          .authenticatedContext('match-driver')
          .firestore()
          .doc('matches/match-1/tracking/current')
          .set(freshTrackingData({ matchId: 'another-match' }))
      );
    });

    runOrSkip('prevents an approved driver from writing to another match', async () => {
      await seedMatchFixture(testEnv, 'match-owned');
      await seedMatchFixture(testEnv, 'match-foreign', { driverId: 'other-driver' });

      await assertFails(
        testEnv
          .authenticatedContext('match-driver')
          .firestore()
          .doc('matches/match-foreign/tracking/current')
          .set(freshTrackingData())
      );
    });

    runOrSkip('prevents an unauthenticated user from writing tracking', async () => {
      await seedMatchFixture(testEnv);

      await assertFails(
        testEnv
          .unauthenticatedContext()
          .firestore()
          .doc('matches/match-1/tracking/current')
          .set(freshTrackingData())
      );
    });

    runOrSkip.each(['completed', 'cancelled'])(
      'prevents writing tracking when the match is %s',
      async (status) => {
        await seedMatchFixture(testEnv, 'match-1', { status });

        await assertFails(
          testEnv
            .authenticatedContext('match-driver')
            .firestore()
            .doc('matches/match-1/tracking/current')
            .set(freshTrackingData())
        );
      }
    );

    runOrSkip('allows the assigned approved driver to read fresh tracking', async () => {
      await seedMatchFixture(testEnv);
      await seedDocument(testEnv, 'matches/match-1/tracking/current', freshTrackingData());

      await assertSucceeds(
        testEnv
          .authenticatedContext('match-driver')
          .firestore()
          .doc('matches/match-1/tracking/current')
          .get()
      );
    });

    runOrSkip('prevents global tracking and GPS history writes', async () => {
      const driverDb = testEnv.authenticatedContext('match-driver').firestore();

      await assertFails(driverDb.doc('tracking/current').set(freshTrackingData()));
      await assertFails(driverDb.collection('locations').doc('point-1').set(freshTrackingData()));
    });
  });

  // -------------------------------------------------------------------------
  // Account deletion requests and actor-scoped write freeze
  // -------------------------------------------------------------------------

  describe('/accountDeletionRequests – deletion freeze', () => {
    const seedDeletionRequest = async (uid: string, status: string) => {
      await seedDocument(testEnv, `accountDeletionRequests/${uid}`, {
        requestId: `request-${uid}`,
        status,
        phase: status === 'completed' ? 'completed' : 'matches',
      });
    };

    runOrSkip('allows the owner to read their deletion request', async () => {
      await seedDeletionRequest('deletion-owner', 'pending');

      await assertSucceeds(
        testEnv
          .authenticatedContext('deletion-owner')
          .firestore()
          .collection('accountDeletionRequests')
          .doc('deletion-owner')
          .get()
      );
    });

    runOrSkip('prevents another user from reading the deletion request', async () => {
      await seedDeletionRequest('deletion-owner', 'pending');

      await assertFails(
        testEnv
          .authenticatedContext('other-user')
          .firestore()
          .collection('accountDeletionRequests')
          .doc('deletion-owner')
          .get()
      );
    });

    runOrSkip('prevents clients from writing their deletion request', async () => {
      const requestRef = testEnv
        .authenticatedContext('deletion-owner')
        .firestore()
        .collection('accountDeletionRequests')
        .doc('deletion-owner');

      await assertFails(requestRef.set({ status: 'pending' }));
      await assertFails(requestRef.update({ status: 'completed' }));
      await assertFails(requestRef.delete());
    });

    runOrSkip.each(['pending', 'processing', 'failed'])(
      'freezes the owner profile while the request is %s',
      async (status) => {
        const uid = `frozen-profile-${status}`;
        await seedUser(testEnv, uid, { role: 'parent', approved: false });
        await seedDeletionRequest(uid, status);

        await assertFails(
          testEnv
            .authenticatedContext(uid)
            .firestore()
            .collection('users')
            .doc(uid)
            .update({ name: 'Blocked update' })
        );
      }
    );

    runOrSkip('unfreezes the owner profile after the request is completed', async () => {
      const uid = 'completed-profile';
      await seedUser(testEnv, uid, { role: 'parent', approved: false });
      await seedDeletionRequest(uid, 'completed');

      await assertSucceeds(
        testEnv
          .authenticatedContext(uid)
          .firestore()
          .collection('users')
          .doc(uid)
          .update({ name: 'Allowed update' })
      );
    });

    runOrSkip.each(['pending', 'processing', 'failed'])(
      'freezes route deletion while the request is %s',
      async (status) => {
        const uid = `frozen-route-${status}`;
        await seedUser(testEnv, uid, { role: 'driver', approved: true });
        await seedDocument(testEnv, `routes/route-${status}`, { driverId: uid });
        await seedDeletionRequest(uid, status);

        await assertFails(
          testEnv
            .authenticatedContext(uid)
            .firestore()
            .collection('routes')
            .doc(`route-${status}`)
            .delete()
        );
      }
    );

    runOrSkip('allows route deletion after the request is completed', async () => {
      const uid = 'completed-route';
      await seedUser(testEnv, uid, { role: 'driver', approved: true });
      await seedDocument(testEnv, 'routes/route-completed', { driverId: uid });
      await seedDeletionRequest(uid, 'completed');

      await assertSucceeds(
        testEnv
          .authenticatedContext(uid)
          .firestore()
          .collection('routes')
          .doc('route-completed')
          .delete()
      );
    });

    runOrSkip('does not let a target request freeze an administrator', async () => {
      await seedUser(testEnv, 'admin-without-request', { role: 'admin' });
      await seedUser(testEnv, 'route-target', { role: 'driver', approved: true });
      await seedDocument(testEnv, 'routes/admin-target-route', {
        driverId: 'route-target',
        reservedSeats: 0,
      });
      await seedDeletionRequest('route-target', 'pending');

      await assertSucceeds(
        testEnv
          .authenticatedContext('admin-without-request')
          .firestore()
          .collection('routes')
          .doc('admin-target-route')
          .delete()
      );
    });

    runOrSkip('freezes an administrator when the administrator has a request', async () => {
      await seedUser(testEnv, 'admin-with-request', { role: 'admin' });
      await seedUser(testEnv, 'other-route-owner', { role: 'driver', approved: true });
      await seedDocument(testEnv, 'routes/admin-own-request-route', {
        driverId: 'other-route-owner',
        reservedSeats: 0,
      });
      await seedDeletionRequest('admin-with-request', 'processing');

      await assertFails(
        testEnv
          .authenticatedContext('admin-with-request')
          .firestore()
          .collection('routes')
          .doc('admin-own-request-route')
          .delete()
      );
    });

    runOrSkip('does not let another participant request freeze shared chat writes', async () => {
      await seedUser(testEnv, 'chat-owner', { role: 'parent', approved: false });
      await seedUser(testEnv, 'chat-participant', { role: 'parent', approved: false });
      await seedDocument(testEnv, 'chats/shared-chat', {
        participants: ['chat-owner', 'chat-participant'],
        updatedAt: new Date(),
      });
      await seedDeletionRequest('chat-owner', 'pending');

      await assertSucceeds(
        testEnv
          .authenticatedContext('chat-participant')
          .firestore()
          .collection('chats')
          .doc('shared-chat')
          .update({ updatedAt: new Date() })
      );
      await assertFails(
        testEnv
          .authenticatedContext('chat-owner')
          .firestore()
          .collection('chats')
          .doc('shared-chat')
          .update({ updatedAt: new Date() })
      );
    });
  });

  // -------------------------------------------------------------------------
  // /passengers and /passengerAuthorizations – access & isolation
  // -------------------------------------------------------------------------

  describe('/passengers and /passengerAuthorizations', () => {
    const parentUid = 'passenger-parent-owner';
    const otherParentUid = 'passenger-parent-other';
    const passengerId = 'p_minor_test_1';
    const authId = `auth_${passengerId}`;

    beforeEach(async () => {
      await seedUser(testEnv, parentUid, { role: 'parent', approved: false });
      await seedUser(testEnv, otherParentUid, { role: 'parent', approved: false });
      await seedDocument(testEnv, `passengers/${passengerId}`, {
        passengerId,
        parentId: parentUid,
        passengerAlias: 'Pasajero Test',
        status: 'active',
      });
      await seedDocument(testEnv, `passengerAuthorizations/${authId}`, {
        authorizationId: authId,
        passengerId,
        guardianId: parentUid,
        status: 'active',
        responsibilityDeclared: true,
      });
    });

    runOrSkip('allows authorized parent guardian to read their passenger document', async () => {
      await assertSucceeds(
        testEnv
          .authenticatedContext(parentUid)
          .firestore()
          .collection('passengers')
          .doc(passengerId)
          .get()
      );
    });

    runOrSkip('denies read of passenger document to other adults', async () => {
      await assertFails(
        testEnv
          .authenticatedContext(otherParentUid)
          .firestore()
          .collection('passengers')
          .doc(passengerId)
          .get()
      );
    });

    runOrSkip('denies read of passenger document to unauthenticated users', async () => {
      await assertFails(
        testEnv.unauthenticatedContext().firestore().collection('passengers').doc(passengerId).get()
      );
    });

    runOrSkip(
      'allows authorized guardian to read their passengerAuthorization document',
      async () => {
        await assertSucceeds(
          testEnv
            .authenticatedContext(parentUid)
            .firestore()
            .collection('passengerAuthorizations')
            .doc(authId)
            .get()
        );
      }
    );

    runOrSkip('denies read of passengerAuthorization document to third parties', async () => {
      await assertFails(
        testEnv
          .authenticatedContext(otherParentUid)
          .firestore()
          .collection('passengerAuthorizations')
          .doc(authId)
          .get()
      );
    });

    runOrSkip('denies direct client writes on passengers collection', async () => {
      const db = testEnv.authenticatedContext(parentUid).firestore();
      await assertFails(
        db
          .collection('passengers')
          .doc('p_client_new')
          .set({ parentId: parentUid, passengerAlias: 'Hack' })
      );
      await assertFails(
        db.collection('passengers').doc(passengerId).update({ passengerAlias: 'Modified' })
      );
      await assertFails(db.collection('passengers').doc(passengerId).delete());
    });

    runOrSkip('denies direct client writes on passengerAuthorizations collection', async () => {
      const db = testEnv.authenticatedContext(parentUid).firestore();
      await assertFails(
        db
          .collection('passengerAuthorizations')
          .doc('auth_client_new')
          .set({ guardianId: parentUid, status: 'active' })
      );
      await assertFails(
        db.collection('passengerAuthorizations').doc(authId).update({ status: 'active' })
      );
      await assertFails(db.collection('passengerAuthorizations').doc(authId).delete());
    });

    runOrSkip('denies client updates and deletes of authorizationEvents evidence', async () => {
      const eventId = 'event-append-only';
      await seedDocument(testEnv, `authorizationEvents/${eventId}`, {
        eventId,
        authorizationId: authId,
        passengerId,
        actorId: parentUid,
        action: 'CREATED',
      });
      const db = testEnv.authenticatedContext(parentUid).firestore();
      await assertFails(
        db.collection('authorizationEvents').doc(eventId).update({ action: 'REWRITTEN' })
      );
      await assertFails(db.collection('authorizationEvents').doc(eventId).delete());
    });
  });

  // -------------------------------------------------------------------------
  // FKG-PR3 — Driver Revocation & Security Rules Hardening
  // -------------------------------------------------------------------------

  describe('FKG-PR3 — Driver Revocation & Security Rules Hardening', () => {
    function freshTrackingData(overrides: Record<string, unknown> = {}) {
      const { Timestamp } = jest.requireActual('@firebase/firestore');
      return {
        latitude: -33.4489,
        longitude: -70.6693,
        speed: 0,
        active: true,
        updatedAt: Timestamp.now(),
        ...overrides,
      };
    }

    runOrSkip('BLOCKED: revoked driver cannot create a vacancy', async () => {
      await seedUser(testEnv, 'revoked-driver', {
        role: 'parent',
        approved: false,
        driverRequestStatus: 'revoked',
      });

      await assertFails(
        testEnv
          .authenticatedContext('revoked-driver')
          .firestore()
          .collection('vacancies')
          .doc('vac-revoked')
          .set({
            driverId: 'revoked-driver',
            totalSeats: 5,
            availableSeats: 5,
            reservedSeats: 0,
            status: 'active',
          })
      );
    });

    runOrSkip('BLOCKED: revoked driver cannot edit an existing vacancy', async () => {
      await seedUser(testEnv, 'revoked-driver', {
        role: 'parent',
        approved: false,
        driverRequestStatus: 'revoked',
      });
      await seedDocument(testEnv, 'vacancies/vac-1', {
        driverId: 'revoked-driver',
        status: 'active',
        totalSeats: 5,
        availableSeats: 5,
        reservedSeats: 0,
      });

      await assertFails(
        testEnv
          .authenticatedContext('revoked-driver')
          .firestore()
          .collection('vacancies')
          .doc('vac-1')
          .update({ notes: 'Hack note' })
      );
    });

    runOrSkip('BLOCKED: revoked driver cannot write live tracking', async () => {
      await seedUser(testEnv, 'revoked-driver', {
        role: 'parent',
        approved: false,
        driverRequestStatus: 'revoked',
      });
      await seedMatchFixture(testEnv, 'match-revoked', {
        driverId: 'revoked-driver',
        status: 'active',
      });

      await assertFails(
        testEnv
          .authenticatedContext('revoked-driver')
          .firestore()
          .doc('matches/match-revoked/tracking/current')
          .set(freshTrackingData())
      );
    });

    runOrSkip(
      'BLOCKED: client cannot reactivate a vacancy cancelled by driver_revoked',
      async () => {
        await seedUser(testEnv, 'approved-driver', {
          role: 'driver',
          approved: true,
          driverRequestStatus: 'approved',
        });
        await seedDocument(testEnv, 'vacancies/vac-cancelled', {
          driverId: 'approved-driver',
          status: 'cancelled',
          cancellationReason: 'driver_revoked',
          totalSeats: 5,
          availableSeats: 5,
          reservedSeats: 0,
        });

        await assertFails(
          testEnv
            .authenticatedContext('approved-driver')
            .firestore()
            .collection('vacancies')
            .doc('vac-cancelled')
            .update({ status: 'active' })
        );
      }
    );

    runOrSkip(
      'BLOCKED: client cannot manipulate reservedSeats or capacity on vacancy',
      async () => {
        await seedUser(testEnv, 'approved-driver', {
          role: 'driver',
          approved: true,
          driverRequestStatus: 'approved',
        });
        await seedDocument(testEnv, 'vacancies/vac-active', {
          driverId: 'approved-driver',
          status: 'active',
          totalSeats: 5,
          availableSeats: 5,
          reservedSeats: 0,
        });

        await assertFails(
          testEnv
            .authenticatedContext('approved-driver')
            .firestore()
            .collection('vacancies')
            .doc('vac-active')
            .update({ reservedSeats: 5 })
        );
      }
    );

    runOrSkip(
      'LEGIT: approved driver can create vacancy and update non-controlled fields',
      async () => {
        await seedUser(testEnv, 'legit-driver', {
          role: 'driver',
          approved: true,
          driverRequestStatus: 'approved',
        });

        await assertSucceeds(
          testEnv
            .authenticatedContext('legit-driver')
            .firestore()
            .collection('vacancies')
            .doc('vac-legit')
            .set({
              driverId: 'legit-driver',
              totalSeats: 4,
              availableSeats: 4,
              reservedSeats: 0,
              status: 'active',
            })
        );

        await assertSucceeds(
          testEnv
            .authenticatedContext('legit-driver')
            .firestore()
            .collection('vacancies')
            .doc('vac-legit')
            .update({ notes: 'Avisar 10 min antes' })
        );
      }
    );

    runOrSkip(
      'BLOCKED: participant cannot alter participants array or matchId in chats',
      async () => {
        await seedUser(testEnv, 'chat-user-1', { role: 'parent', approved: false });
        await seedUser(testEnv, 'chat-user-2', { role: 'parent', approved: false });
        await seedDocument(testEnv, 'chats/chat-1', {
          participants: ['chat-user-1', 'chat-user-2'],
          matchId: 'match-123',
        });

        await assertFails(
          testEnv
            .authenticatedContext('chat-user-1')
            .firestore()
            .collection('chats')
            .doc('chat-1')
            .update({ participants: ['chat-user-1'] })
        );

        await assertFails(
          testEnv
            .authenticatedContext('chat-user-1')
            .firestore()
            .collection('chats')
            .doc('chat-1')
            .update({ matchId: 'hacked-match' })
        );
      }
    );

    runOrSkip('BLOCKED: user cannot send message with spoofed senderId', async () => {
      await seedUser(testEnv, 'chat-user-1', { role: 'parent', approved: false });
      await seedUser(testEnv, 'chat-user-2', { role: 'parent', approved: false });
      await seedDocument(testEnv, 'chats/chat-1', {
        participants: ['chat-user-1', 'chat-user-2'],
      });

      await assertFails(
        testEnv
          .authenticatedContext('chat-user-1')
          .firestore()
          .collection('chats')
          .doc('chat-1')
          .collection('messages')
          .doc('msg-1')
          .set({ senderId: 'chat-user-2', text: 'Impersonating user 2' })
      );
    });

    runOrSkip(
      'LEGIT: participant can send message with senderId matching request.auth.uid',
      async () => {
        await seedUser(testEnv, 'chat-user-1', { role: 'parent', approved: false });
        await seedUser(testEnv, 'chat-user-2', { role: 'parent', approved: false });
        await seedDocument(testEnv, 'chats/chat-1', {
          participants: ['chat-user-1', 'chat-user-2'],
        });

        await assertSucceeds(
          testEnv
            .authenticatedContext('chat-user-1')
            .firestore()
            .collection('chats')
            .doc('chat-1')
            .collection('messages')
            .doc('msg-1')
            .set({ senderId: 'chat-user-1', text: 'Hola!' })
        );
      }
    );
  });

  describe('Custody Chain & OTP Handover Rules', () => {
    runOrSkip('BLOCKED: client cannot read or write handoverOtps', async () => {
      await seedUser(testEnv, 'parent-custody', { role: 'parent' });
      await seedDocument(testEnv, 'handoverOtps/otp-1', {
        matchId: 'match-custody',
        passengerId: 'pass-1',
        pinHash: 'hash',
        status: 'active',
      });

      await assertFails(
        testEnv
          .authenticatedContext('parent-custody')
          .firestore()
          .collection('handoverOtps')
          .doc('otp-1')
          .get()
      );
      await assertFails(
        testEnv
          .authenticatedContext('parent-custody')
          .firestore()
          .collection('handoverOtps')
          .doc('otp-2')
          .set({ matchId: 'match-custody' })
      );
    });

    runOrSkip(
      'AUTHORIZATION: passengerStates and custodyEvents read restricted to match participants',
      async () => {
        await seedUser(testEnv, 'parent-p', { role: 'parent' });
        await seedUser(testEnv, 'driver-d', { role: 'driver', approved: true });
        await seedUser(testEnv, 'stranger-s', { role: 'parent' });
        await seedDocument(testEnv, 'matches/match-custody', {
          parentId: 'parent-p',
          driverId: 'driver-d',
          status: 'active',
        });
        await seedDocument(testEnv, 'passengerStates/state-1', {
          matchId: 'match-custody',
          passengerId: 'pass-1',
          state: 'EXPECTED',
        });
        await seedDocument(testEnv, 'custodyEvents/evt-1', {
          matchId: 'match-custody',
          passengerId: 'pass-1',
          nextState: 'BOARDING_CONFIRMED',
        });

        // Parent can read
        await assertSucceeds(
          testEnv
            .authenticatedContext('parent-p')
            .firestore()
            .collection('passengerStates')
            .doc('state-1')
            .get()
        );
        await assertSucceeds(
          testEnv
            .authenticatedContext('parent-p')
            .firestore()
            .collection('custodyEvents')
            .doc('evt-1')
            .get()
        );

        // Driver can read
        await assertSucceeds(
          testEnv
            .authenticatedContext('driver-d')
            .firestore()
            .collection('passengerStates')
            .doc('state-1')
            .get()
        );

        // Stranger denied
        await assertFails(
          testEnv
            .authenticatedContext('stranger-s')
            .firestore()
            .collection('passengerStates')
            .doc('state-1')
            .get()
        );
        await assertFails(
          testEnv
            .authenticatedContext('stranger-s')
            .firestore()
            .collection('custodyEvents')
            .doc('evt-1')
            .get()
        );

        // Direct client writes denied
        await assertFails(
          testEnv
            .authenticatedContext('driver-d')
            .firestore()
            .collection('passengerStates')
            .doc('state-1')
            .update({ state: 'HANDOVER_CONFIRMED' })
        );
      }
    );
  });
});
