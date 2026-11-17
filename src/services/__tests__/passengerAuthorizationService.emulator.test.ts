// This suite requires local Auth, Functions, and Firestore emulators only.
process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'demo-api-key';
process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN = 'demo-furgokid.firebaseapp.com';
process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'demo-furgokid';
process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET = 'demo-furgokid.appspot.com';
process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = '000000000000';
process.env.EXPO_PUBLIC_FIREBASE_APP_ID = '1:000000000000:web:demo';

jest.unmock('firebase/app');
jest.unmock('firebase/auth');
jest.unmock('firebase/firestore');
jest.unmock('firebase/functions');
jest.unmock('../../config/firebase');
jest.unmock('../../utils/secureStorage');

const memorySecureStore = new Map<string, string>();
jest.doMock('expo-secure-store', () => ({
  isAvailableAsync: async () => true,
  setItemAsync: async (key: string, value: string) => {
    memorySecureStore.set(key, value);
  },
  getItemAsync: async (key: string) => memorySecureStore.get(key) ?? null,
  deleteItemAsync: async (key: string) => {
    memorySecureStore.delete(key);
  },
}));

const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  deleteUser,
  signOut,
} = require('firebase/auth');
const { connectAuthEmulator } = require('firebase/auth');
const {
  connectFirestoreEmulator,
  collection,
  getDocs,
  getDocsFromServer,
  getDocFromServer,
  doc,
  setDoc,
  query,
  where,
  deleteDoc,
} = require('firebase/firestore');
const { connectFunctionsEmulator } = require('firebase/functions');
const { auth, db, functions } = require('../../config/firebase');
const {
  default: passengerService,
  createPassengerAuthorizationService,
} = require('../passengerAuthorizationService');

const projectId = 'demo-furgokid';
const emulatorHost = '127.0.0.1';
const testPrefix = `g221-${Date.now()}`;
let rulesEnvironment: any;
let emulatorConnected = false;
const accounts: Array<{ uid: string; email: string; password: string }> = [];
const passengerIds: string[] = [];
const authorizationIds: string[] = [];

jest.setTimeout(45000);

const createAdult = async (suffix: string, eligible = true) => {
  const email = `${testPrefix}-${suffix}@example.invalid`;
  const password = `Test-${suffix}-Password-123!`;
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  accounts.push({ uid: credential.user.uid, email, password });
  await rulesEnvironment.withSecurityRulesDisabled(async (context: any) => {
    const profile: Record<string, any> = { role: 'parent' };
    if (eligible)
      profile.adultEligibility = {
        status: 'eligible',
        method: 'synthetic_emulator_fixture',
        noticeVersion: 'privacy-v1',
        recordedAt: new Date(),
      };
    await setDoc(doc(context.firestore(), 'users', credential.user.uid), profile);
  });
  return credential.user.uid;
};

beforeAll(async () => {
  if (
    process.env.FIRESTORE_EMULATOR_HOST &&
    !/^127\.0\.0\.1:8080$|^localhost:8080$/i.test(process.env.FIRESTORE_EMULATOR_HOST)
  ) {
    throw new Error(
      'Refusing to run passenger client integration outside local Firestore Emulator.'
    );
  }
  if (process.env.GCLOUD_PROJECT && !process.env.GCLOUD_PROJECT.startsWith('demo-')) {
    throw new Error('Refusing non-demo GCLOUD_PROJECT for passenger client integration.');
  }
  process.env.GCLOUD_PROJECT = projectId;
  process.env.GOOGLE_CLOUD_PROJECT = projectId;
  process.env.FIRESTORE_EMULATOR_HOST = `${emulatorHost}:8080`;
  connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, emulatorHost, 8080);
  connectFunctionsEmulator(functions, emulatorHost, 5001);
  emulatorConnected = true;
  const rules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
  rulesEnvironment = await initializeTestEnvironment({
    projectId,
    firestore: { host: emulatorHost, port: 8080, rules },
  });
});

afterEach(async () => {
  if (auth.currentUser) await signOut(auth);
});

afterAll(async () => {
  if (rulesEnvironment) {
    await rulesEnvironment.withSecurityRulesDisabled(async (context: any) => {
      const store = context.firestore();
      const refs = [
        ...passengerIds.map((id) => doc(store, 'passengers', id)),
        ...authorizationIds.map((id) => doc(store, 'passengerAuthorizations', id)),
      ];
      for (const uid of accounts.map((account) => account.uid)) refs.push(doc(store, 'users', uid));
      for (const authorizationId of authorizationIds) {
        const eventSnapshot = await getDocs(
          query(
            collection(store, 'authorizationEvents'),
            where('authorizationId', '==', authorizationId)
          )
        );
        for (const event of eventSnapshot.docs)
          refs.push(doc(store, 'authorizationEvents', event.id));
      }
      await Promise.all(refs.map((ref) => deleteDoc(ref).catch(() => undefined)));
    });
    await rulesEnvironment.cleanup();
  }
  if (emulatorConnected) {
    if (auth.currentUser) await signOut(auth);
    for (const account of accounts) {
      try {
        await signInWithEmailAndPassword(auth, account.email, account.password);
        if (auth.currentUser) await deleteUser(auth.currentUser);
      } catch {
        /* Emulator fixture may already have been removed. */
      }
    }
    if (auth.currentUser) await signOut(auth);
  }
  memorySecureStore.clear();
});

describe('passengerAuthorizationService with local Firebase Emulators and active Rules', () => {
  test('Auth UID reaches callable, onboarding persists and client reads owner documents', async () => {
    const uid = await createAdult('owner');
    const passengerId = `${testPrefix}-passenger-owner`;
    passengerIds.push(passengerId);
    const result = await passengerService.onboardPassenger({
      passengerId,
      passengerAlias: 'Synthetic Alias',
      purpose: 'school_transport',
      privacyNoticeVersion: 'privacy-v1',
      authorizationTextVersion: 'authorization-v1',
      responsibilityDeclared: true,
      privacyNoticeAccepted: true,
    });
    expect(auth.currentUser?.uid).toBe(uid);
    expect(result.result).toMatchObject({
      passengerId,
      status: 'active',
      responsibilityDeclared: true,
      privacyNoticeAccepted: true,
    });
    const passengers = await passengerService.getPassengers();
    expect(passengers).toHaveLength(1);
    expect(passengers[0]).toMatchObject({ passengerId, status: 'active' });
    const persisted = await getDocFromServer(
      doc(db, 'passengerAuthorizations', result.result.authorizationId)
    );
    expect(persisted.exists()).toBe(true);
    expect(persisted.data()?.guardianId).toBe(uid);
    expect(persisted.data()?.requestFingerprint).toEqual(expect.any(String));
    authorizationIds.push(result.result.authorizationId);
  });

  test('Rules deny cross-adult reads and direct client writes; service returns unknown for foreign auth', async () => {
    const ownerUid = await createAdult('rules-owner');
    const passengerId = `${testPrefix}-passenger-rules`;
    passengerIds.push(passengerId);
    const result = await passengerService.onboardPassenger({
      passengerId,
      passengerAlias: 'Synthetic Rules Alias',
      purpose: 'extracurricular_transport',
      privacyNoticeVersion: 'privacy-v1',
      authorizationTextVersion: 'authorization-v1',
      responsibilityDeclared: true,
      privacyNoticeAccepted: true,
    });
    authorizationIds.push(result.result.authorizationId);
    await signOut(auth);
    await createAdult('rules-other');
    await expect(getDocFromServer(doc(db, 'passengers', passengerId))).rejects.toMatchObject({
      code: 'permission-denied',
    });
    await expect(
      getDocFromServer(doc(db, 'passengerAuthorizations', result.result.authorizationId))
    ).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(
      getDocsFromServer(
        query(
          collection(db, 'authorizationEvents'),
          where('authorizationId', '==', result.result.authorizationId)
        )
      )
    ).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(
      setDoc(doc(db, 'passengers', passengerId), { parentId: auth.currentUser?.uid })
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(
      (await passengerService.getPassengerAuthorization(result.result.authorizationId)).status
    ).toBe('unknown');
    expect(await passengerService.getPassengers()).toEqual([]);
    expect(ownerUid).not.toBe(auth.currentUser?.uid);
  });

  test('uneligible adult and unauthenticated calls are denied; service keeps errors opaque', async () => {
    const uid = await createAdult('uneligible', false);
    const input = {
      passengerId: `${testPrefix}-passenger-uneligible`,
      passengerAlias: 'Synthetic',
      purpose: 'school_transport' as const,
      privacyNoticeVersion: 'privacy-v1',
      authorizationTextVersion: 'authorization-v1',
      responsibilityDeclared: true as const,
      privacyNoticeAccepted: true as const,
    };
    await expect(passengerService.onboardPassenger(input)).rejects.toMatchObject({
      code: 'functions/failed-precondition',
      kind: 'known',
    });
    expect(uid).toBe(auth.currentUser?.uid);
    await signOut(auth);
    await expect(passengerService.getPassengers()).rejects.toMatchObject({
      code: 'functions/unauthenticated',
    });
  });

  test('pending request survives service recreation, remains UID-scoped and uses real secureStorage wrapper', async () => {
    const uid = await createAdult('pending');
    const passengerId = `${testPrefix}-passenger-pending`;
    const operation = await passengerService.createOperation(passengerId);
    expect((await passengerService.getPendingOperations())[0]).toMatchObject({
      requestId: operation.requestId,
      passengerId,
    });
    const restartedService = createPassengerAuthorizationService();
    expect(await restartedService.getPendingOperations()).toContainEqual({
      requestId: operation.requestId,
      passengerId,
    });
    await signOut(auth);
    await createAdult('pending-other');
    expect(await passengerService.getPendingOperations()).toEqual([]);
    await expect(
      passengerService.onboardPassenger(
        {
          passengerId,
          passengerAlias: 'Synthetic',
          purpose: 'school_transport',
          privacyNoticeVersion: 'privacy-v1',
          authorizationTextVersion: 'authorization-v1',
          responsibilityDeclared: true,
          privacyNoticeAccepted: true,
        },
        operation.requestId
      )
    ).rejects.toMatchObject({ code: 'operation-not-found' });
    expect(uid).not.toBe(auth.currentUser?.uid);
  });

  test('retries after a committed callable whose response is deliberately discarded', async () => {
    const uid = await createAdult('lost-response');
    const passengerId = `${testPrefix}-passenger-lost-response`;
    passengerIds.push(passengerId);
    const operation = await passengerService.createOperation(passengerId);
    const input = {
      passengerId,
      passengerAlias: 'Synthetic Retry Alias',
      purpose: 'school_transport' as const,
      privacyNoticeVersion: 'privacy-v1',
      authorizationTextVersion: 'authorization-v1',
      responsibilityDeclared: true as const,
      privacyNoticeAccepted: true as const,
    };
    const { httpsCallable } = require('firebase/functions');
    const actualCallable = httpsCallable(functions, 'onboardPassenger');
    await actualCallable({ ...input, requestId: operation.requestId });
    // The callable has committed; deliberately discard its successful response to model a lost reply.
    const recovered = await passengerService.onboardPassenger(input);
    authorizationIds.push(recovered.result.authorizationId);
    expect(recovered.operationId).toBe(operation.requestId);
    expect(await passengerService.getPendingOperations()).toEqual([]);
    const passenger = await getDocFromServer(doc(db, 'passengers', passengerId));
    expect(passenger.data()).toMatchObject({
      parentId: uid,
      latestAuthorizationId: recovered.result.authorizationId,
      status: 'active',
    });
    expect(
      (
        await getDocFromServer(doc(db, 'passengerAuthorizations', recovered.result.authorizationId))
      ).exists()
    ).toBe(true);
  });

  test('callable revocation persists immediately, is repeatable, and cannot elevate status', async () => {
    const uid = await createAdult('revoke');
    const passengerId = `${testPrefix}-passenger-revoke`;
    passengerIds.push(passengerId);
    const created = await passengerService.onboardPassenger({
      passengerId,
      passengerAlias: 'Synthetic Revocation',
      purpose: 'school_transport',
      privacyNoticeVersion: 'privacy-v1',
      authorizationTextVersion: 'authorization-v1',
      responsibilityDeclared: true,
      privacyNoticeAccepted: true,
    });
    authorizationIds.push(created.result.authorizationId);
    const revoked = await passengerService.revokePassengerAuthorization(
      passengerId,
      created.result.authorizationId
    );
    expect(revoked.status).toBe('revoked');
    expect(
      await passengerService.revokePassengerAuthorization(
        passengerId,
        created.result.authorizationId
      )
    ).toMatchObject({ status: 'revoked' });
    for (const status of ['active', 'rejected', 'expired']) {
      const { httpsCallable } = require('firebase/functions');
      await expect(
        httpsCallable(
          functions,
          'updatePassengerAuthorizationStatus'
        )({ passengerId, authorizationId: created.result.authorizationId, newStatus: status })
      ).rejects.toMatchObject({ code: 'functions/permission-denied' });
    }
    expect(uid).toBe(auth.currentUser?.uid);
  });
});
