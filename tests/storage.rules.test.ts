if (!process.env.FIREBASE_EMULATOR_HOST) {
  process.env.FIREBASE_EMULATOR_HOST = '127.0.0.1:8080';
}
if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';
}
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';

describe('Firebase Storage Rules', () => {
  let testEnv: any;
  const projectId = 'furgokid';

  const isEmulatorMode =
    !!process.env.FIREBASE_EMULATOR_HOST || process.env.npm_lifecycle_event === 'test:rules';
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
      firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8'),
        host: '127.0.0.1',
        port: 8080,
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
    await testEnv.clearFirestore();
  });

  async function seedUser(uid: string, data: Record<string, unknown>): Promise<void> {
    await testEnv.withSecurityRulesDisabled(async (ctx: any) => {
      await ctx.firestore().collection('users').doc(uid).set(data);
    });
  }

  describe('Driver Documents Storage Rules', () => {
    runOrSkip(
      'prevents unauthenticated user from reading or uploading driver documents',
      async () => {
        const unauthCtx = testEnv.unauthenticatedContext();
        await assertFails(
          unauthCtx.storage().ref('driver-documents/driver-1/license.pdf').getDownloadURL()
        );
        await assertFails(
          unauthCtx
            .storage()
            .ref('driver-documents/driver-1/license.pdf')
            .put(Buffer.from('pdf content'), { contentType: 'application/pdf' })
        );
      }
    );

    runOrSkip(
      'prevents authenticated user from reading or writing another driver documents',
      async () => {
        await seedUser('driver-1', { role: 'driver', approved: true });
        await seedUser('driver-2', { role: 'driver', approved: true });

        const driver2Ctx = testEnv.authenticatedContext('driver-2');
        await assertFails(
          driver2Ctx.storage().ref('driver-documents/driver-1/license.pdf').getDownloadURL()
        );
        await assertFails(
          driver2Ctx
            .storage()
            .ref('driver-documents/driver-1/license.pdf')
            .put(Buffer.from('pdf content'), { contentType: 'application/pdf' })
        );
      }
    );

    runOrSkip('allows driver owner to upload valid PDF/image under 10MB', async () => {
      await seedUser('driver-1', { role: 'driver', approved: true });
      const driver1Ctx = testEnv.authenticatedContext('driver-1');

      // Valid PDF upload
      await assertSucceeds(
        driver1Ctx
          .storage()
          .ref('driver-documents/driver-1/license.pdf')
          .put(Buffer.from('pdf content'), { contentType: 'application/pdf' })
      );

      // Valid Image upload
      await assertSucceeds(
        driver1Ctx
          .storage()
          .ref('driver-documents/driver-1/id.jpeg')
          .put(Buffer.from('image content'), { contentType: 'image/jpeg' })
      );
    });

    runOrSkip('rejects invalid MIME type or oversized files (>10MB)', async () => {
      await seedUser('driver-1', { role: 'driver', approved: true });
      const driver1Ctx = testEnv.authenticatedContext('driver-1');

      // Invalid MIME type (e.g. application/x-msdownload)
      await assertFails(
        driver1Ctx
          .storage()
          .ref('driver-documents/driver-1/malicious.exe')
          .put(Buffer.from('exe content'), { contentType: 'application/x-msdownload' })
      );

      // Oversized file (>10MB)
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
      await assertFails(
        driver1Ctx
          .storage()
          .ref('driver-documents/driver-1/huge.pdf')
          .put(largeBuffer, { contentType: 'application/pdf' })
      );
    });

    runOrSkip('allows admin to read driver documents', async () => {
      await seedUser('admin-1', { role: 'admin' });
      await seedUser('driver-1', { role: 'driver', approved: true });

      // First upload file as owner
      const driver1Ctx = testEnv.authenticatedContext('driver-1');
      await assertSucceeds(
        driver1Ctx
          .storage()
          .ref('driver-documents/driver-1/license.pdf')
          .put(Buffer.from('pdf content'), { contentType: 'application/pdf' })
      );

      // Admin reads file
      const adminCtx = testEnv.authenticatedContext('admin-1');
      await assertSucceeds(
        adminCtx.storage().ref('driver-documents/driver-1/license.pdf').getDownloadURL()
      );
    });
  });
});
