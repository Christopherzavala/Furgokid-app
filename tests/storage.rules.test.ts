if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
}
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';

describe('Storage Security Rules', () => {
  let testEnv: any;
  const projectId = 'furgokid';

  const isEmulatorMode =
    !!process.env.FIREBASE_STORAGE_EMULATOR_HOST ||
    !!process.env.FIREBASE_EMULATOR_HOST ||
    process.env.npm_lifecycle_event === 'test:rules';
  const runOrSkip = isEmulatorMode ? it : it.skip;

  beforeAll(async () => {
    if (!isEmulatorMode) return;
    testEnv = await initializeTestEnvironment({
      projectId,
      storage: {
        rules: fs.readFileSync('storage.rules', 'utf8'),
        host: '127.0.0.1',
        port: 9199,
      },
    });
  });

  afterAll(async () => {
    if (!isEmulatorMode) return;
    await testEnv.cleanup();
  });

  afterEach(async () => {
    if (!isEmulatorMode) return;
    await testEnv.clearStorage();
  });

  // -------------------------------------------------------------------------
  // Default deny & list blocking
  // -------------------------------------------------------------------------
  describe('Default deny & unauthenticated access', () => {
    runOrSkip('BLOCKED: unauthenticated user cannot read or write to storage', async () => {
      const storage = testEnv.unauthenticatedContext().storage();
      const ref = storage.ref('random/file.txt');

      await assertFails(ref.getDownloadURL());
      await assertFails(ref.put(Buffer.from('hello'), { contentType: 'text/plain' }));
    });

    runOrSkip('BLOCKED: listing files is denied for arbitrary paths', async () => {
      const storage = testEnv.authenticatedContext('user1').storage();
      const ref = storage.ref('users/user1/profile');

      await assertFails(ref.listAll());
    });
  });

  // -------------------------------------------------------------------------
  // User Profile Images
  // -------------------------------------------------------------------------
  describe('User profile images (/users/{userId}/profile/{fileName})', () => {
    const userId = 'user-alice';
    const profilePath = `users/${userId}/profile/avatar.jpg`;

    runOrSkip('LEGIT: user can upload valid 5MB JPEG image to their profile', async () => {
      const storage = testEnv.authenticatedContext(userId).storage();
      const ref = storage.ref(profilePath);

      await assertSucceeds(ref.put(Buffer.from('fake-image-data'), { contentType: 'image/jpeg' }));
    });

    runOrSkip(
      'BLOCKED: user cannot upload non-image file (e.g. text/html) to profile',
      async () => {
        const storage = testEnv.authenticatedContext(userId).storage();
        const ref = storage.ref(`users/${userId}/profile/script.html`);

        await assertFails(ref.put(Buffer.from('<html></html>'), { contentType: 'text/html' }));
      }
    );

    runOrSkip('BLOCKED: user cannot upload file to another user profile', async () => {
      const storage = testEnv.authenticatedContext('attacker').storage();
      const ref = storage.ref(profilePath);

      await assertFails(ref.put(Buffer.from('fake-image-data'), { contentType: 'image/jpeg' }));
    });

    runOrSkip('LEGIT: authenticated user can read another user profile avatar', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        await ctx
          .storage()
          .ref(profilePath)
          .put(Buffer.from('avatar'), { contentType: 'image/jpeg' });
      });

      const storage = testEnv.authenticatedContext('other-user').storage();
      const ref = storage.ref(profilePath);

      await assertSucceeds(ref.getDownloadURL());
    });
  });

  // -------------------------------------------------------------------------
  // Driver Sensitive Documents
  // -------------------------------------------------------------------------
  describe('Driver documents (/drivers/{driverId}/documents/{fileName})', () => {
    const driverId = 'driver-bob';
    const docPath = `drivers/${driverId}/documents/license.pdf`;

    runOrSkip('LEGIT: driver can upload PDF or image document', async () => {
      const storage = testEnv.authenticatedContext(driverId).storage();
      const ref = storage.ref(docPath);

      await assertSucceeds(ref.put(Buffer.from('pdf-content'), { contentType: 'application/pdf' }));
    });

    runOrSkip('BLOCKED: another user cannot read driver documents', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        await ctx
          .storage()
          .ref(docPath)
          .put(Buffer.from('pdf-content'), { contentType: 'application/pdf' });
      });

      const storage = testEnv.authenticatedContext('attacker').storage();
      const ref = storage.ref(docPath);

      await assertFails(ref.getDownloadURL());
    });

    runOrSkip('LEGIT: admin can read driver documents', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        await ctx
          .storage()
          .ref(docPath)
          .put(Buffer.from('pdf-content'), { contentType: 'application/pdf' });
      });

      const storage = testEnv.authenticatedContext('admin-user', { role: 'admin' }).storage();
      const ref = storage.ref(docPath);

      await assertSucceeds(ref.getDownloadURL());
    });
  });

  // -------------------------------------------------------------------------
  // Passenger Minor Documents
  // -------------------------------------------------------------------------
  describe('Passenger minor documents (/passengers/{parentId}/{passengerId}/{fileName})', () => {
    const parentId = 'parent-carol';
    const passengerId = 'p_minor_1';
    const docPath = `passengers/${parentId}/${passengerId}/consent.pdf`;

    runOrSkip('LEGIT: parent can upload passenger document PDF', async () => {
      const storage = testEnv.authenticatedContext(parentId).storage();
      const ref = storage.ref(docPath);

      await assertSucceeds(ref.put(Buffer.from('consent-pdf'), { contentType: 'application/pdf' }));
    });

    runOrSkip('BLOCKED: foreign user cannot read minor passenger document', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        await ctx
          .storage()
          .ref(docPath)
          .put(Buffer.from('consent-pdf'), { contentType: 'application/pdf' });
      });

      const storage = testEnv.authenticatedContext('stranger').storage();
      const ref = storage.ref(docPath);

      await assertFails(ref.getDownloadURL());
    });

    runOrSkip('LEGIT: admin can read passenger minor document', async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
        await ctx
          .storage()
          .ref(docPath)
          .put(Buffer.from('consent-pdf'), { contentType: 'application/pdf' });
      });

      const storage = testEnv.authenticatedContext('admin-user', { role: 'admin' }).storage();
      const ref = storage.ref(docPath);

      await assertSucceeds(ref.getDownloadURL());
    });
  });
});
