const {
  createPassengerAuthorizationManager,
  sanitizePassengerData,
} = require('../src/passengerAuthorization');
const {
  updatePassengerAuthorizationStatusCallable,
} = require('../src/passengerAuthorizationCallables');

const makeFirestore = (initial = {}) => {
  const documents = new Map(Object.entries(initial));
  const makeRef = (path) => ({
    path,
    id: path.split('/').pop(),
    collection(name) {
      return makeCollection(`${path}/${name}`);
    },
    async get() {
      return makeSnapshot(path, documents.get(path));
    },
  });
  const makeCollection = (path) => ({
    path,
    doc(id) {
      return makeRef(`${path}/${id}`);
    },
    where(field, op, value) {
      return {
        where: (secondField, secondOp, secondValue) =>
          makeQuery(path, [
            [field, op, value],
            [secondField, secondOp, secondValue],
          ]),
        limit: (limit) => makeQuery(path, [[field, op, value]], limit),
        get: () => makeQuery(path, [[field, op, value]]).get(),
      };
    },
  });
  const makeQuery = (path, filters, limit = Infinity) => ({
    async get() {
      const docs = [];
      for (const [docPath, data] of documents.entries()) {
        if (!docPath.startsWith(`${path}/`) || docPath.slice(path.length + 1).includes('/'))
          continue;
        const matches = filters.every(([field, op, expected]) => {
          if (op !== '==') return false;
          return data[field] === expected;
        });
        if (matches)
          docs.push({ id: docPath.split('/').pop(), ref: makeRef(docPath), data: () => data });
        if (docs.length >= limit) break;
      }
      return { docs };
    },
  });
  const firestore = {
    collection: makeCollection,
    async runTransaction(callback) {
      const writes = [];
      const transaction = {
        async get(ref) {
          if (writes.length) throw new Error('transaction reads must precede writes');
          return makeSnapshot(ref.path, documents.get(ref.path));
        },
        set(ref, data, options) {
          writes.push({ type: 'set', ref, data, options });
        },
        update(ref, data) {
          writes.push({ type: 'update', ref, data });
        },
        create(ref, data) {
          writes.push({ type: 'create', ref, data });
        },
        delete(ref) {
          writes.push({ type: 'delete', ref });
        },
      };
      const result = await callback(transaction);
      for (const write of writes) {
        const existing = documents.get(write.ref.path);
        if (write.type === 'delete') documents.delete(write.ref.path);
        if (write.type === 'create') {
          if (existing) throw new Error('document already exists');
          documents.set(write.ref.path, write.data);
        }
        if (write.type === 'set') {
          documents.set(
            write.ref.path,
            write.options?.merge && existing ? { ...existing, ...write.data } : write.data
          );
        }
        if (write.type === 'update') {
          if (!existing) throw new Error('document does not exist');
          const next = { ...existing };
          for (const [key, value] of Object.entries(write.data)) {
            next[key] =
              value && typeof value === 'object' && '__increment' in value
                ? (next[key] || 0) + value.__increment
                : value;
          }
          documents.set(write.ref.path, next);
        }
      }
      return result;
    },
    documents,
  };
  return firestore;
};

const makeSnapshot = (path, data) => ({
  id: path.split('/').pop(),
  exists: Boolean(data),
  data: () => data,
  get: (field) => data?.[field],
});

const eligibleGuardian = (overrides = {}) => ({
  role: 'parent',
  adultEligibility: {
    status: 'eligible',
    method: 'backend_recorded',
    noticeVersion: 'privacy-v1',
    recordedAt: new Date(),
  },
  ...overrides,
});

const activeLeaseFixture = ({
  matchOverrides = {},
  authorizationOverrides = {},
  passengerOverrides = {},
} = {}) => ({
  'users/guardian-A': eligibleGuardian(),
  'passengers/passenger-A': {
    passengerId: 'passenger-A',
    parentId: 'guardian-A',
    latestAuthorizationId: 'authorization-A',
    status: 'revoked',
    ...passengerOverrides,
  },
  'passengerAuthorizations/authorization-A': {
    authorizationId: 'authorization-A',
    passengerId: 'passenger-A',
    guardianId: 'guardian-A',
    status: 'revoked',
    cleanupStatus: 'pending',
    cleanupLeaseOwner: 'worker-A',
    cleanupLeaseId: 'lease-A',
    cleanupGeneration: 1,
    cleanupLeaseExpiresAt: new Date(Date.now() + 60000),
    ...authorizationOverrides,
  },
  'matches/match-A': {
    parentId: 'guardian-A',
    passengerIds: ['passenger-A'],
    status: 'active',
    ...matchOverrides,
  },
  'matches/match-A/tracking/current': { latitude: 1, longitude: 2 },
});

const fakeFieldValue = {
  serverTimestamp: () => new Date(),
  increment: (n) => ({ __increment: n }),
};

describe('passenger authorization and fenced cleanup', () => {
  test.each(['active', 'rejected', 'expired'])(
    'public callable denies client transition to %s',
    async (newStatus) => {
      await expect(
        updatePassengerAuthorizationStatusCallable.run({
          auth: { uid: 'guardian-A' },
          data: { passengerId: 'passenger-A', newStatus },
        })
      ).rejects.toMatchObject({ code: 'permission-denied' });
    }
  );

  test('public callable rejects unauthenticated revocation', async () => {
    await expect(
      updatePassengerAuthorizationStatusCallable.run({
        data: { passengerId: 'passenger-A', newStatus: 'revoked' },
      })
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  test('rejects specialNeeds and other disallowed passenger fields', () => {
    expect(() =>
      sanitizePassengerData({ passengerAlias: 'A', specialNeeds: 'synthetic sensitive value' })
    ).toThrow(/disallowed/);
  });

  test('requires backend eligibility distinct from the functional parent role', async () => {
    const firestore = makeFirestore({ 'users/guardian-A': { role: 'parent' } });
    const manager = createPassengerAuthorizationManager({ firestore, fieldValue: fakeFieldValue });
    await expect(
      manager.createPassengerWithDeclaration({
        adultUid: 'guardian-A',
        passengerId: 'passenger-A',
        requestId: 'request-guardian-A-0001',
        responsibilityDeclared: true,
        privacyNoticeAccepted: true,
        privacyNoticeVersion: 'privacy-v1',
        authorizationTextVersion: 'authorization-v1',
      })
    ).rejects.toThrow(/eligibility is not established/);
  });

  test('stores identity, responsibility declaration and notice versions separately', async () => {
    const firestore = makeFirestore({ 'users/guardian-A': eligibleGuardian() });
    const manager = createPassengerAuthorizationManager({ firestore, fieldValue: fakeFieldValue });
    const result = await manager.createPassengerWithDeclaration({
      adultUid: 'guardian-A',
      passengerId: 'passenger-A',
      requestId: 'request-guardian-A-0002',
      passengerAlias: '  Child A  ',
      responsibilityDeclared: true,
      privacyNoticeAccepted: true,
      privacyNoticeVersion: 'privacy-v1',
      authorizationTextVersion: 'authorization-v2',
    });
    const auth = firestore.documents.get(`passengerAuthorizations/${result.authorizationId}`);
    expect(result.status).toBe('active');
    expect(auth).toMatchObject({
      guardianId: 'guardian-A',
      passengerId: 'passenger-A',
      responsibilityDeclared: true,
      privacyNoticeAccepted: true,
      privacyNoticeVersion: 'privacy-v1',
      authorizationTextVersion: 'authorization-v2',
    });
    expect(firestore.documents.get('passengers/passenger-A').passengerAlias).toBe('Child A');
  });

  test('replays the persisted result without duplicating authorization or event', async () => {
    const firestore = makeFirestore({ 'users/guardian-A': eligibleGuardian() });
    const manager = createPassengerAuthorizationManager({ firestore, fieldValue: fakeFieldValue });
    const input = {
      adultUid: 'guardian-A',
      passengerId: 'passenger-replay',
      requestId: 'stable-request-0001',
      passengerAlias: 'Alias',
      responsibilityDeclared: true,
      privacyNoticeAccepted: true,
      privacyNoticeVersion: 'privacy-v1',
      authorizationTextVersion: 'authorization-v1',
    };
    const first = await manager.createPassengerWithDeclaration(input);
    const repeated = await manager.createPassengerWithDeclaration(input);
    expect(repeated).toEqual(first);
    expect(
      [...firestore.documents.keys()].filter((key) => key.startsWith('passengerAuthorizations/'))
    ).toHaveLength(1);
    expect(
      [...firestore.documents.keys()].filter((key) => key.startsWith('authorizationEvents/'))
    ).toHaveLength(1);
  });

  test('rejects reuse of requestId with different content and isolates UIDs', async () => {
    const firestore = makeFirestore({
      'users/guardian-A': eligibleGuardian(),
      'users/guardian-B': eligibleGuardian(),
    });
    const manager = createPassengerAuthorizationManager({ firestore, fieldValue: fakeFieldValue });
    const input = {
      adultUid: 'guardian-A',
      passengerId: 'passenger-request',
      requestId: 'same-request-key-001',
      passengerAlias: 'Alias',
      responsibilityDeclared: true,
      privacyNoticeAccepted: true,
      privacyNoticeVersion: 'privacy-v1',
      authorizationTextVersion: 'authorization-v1',
    };
    await manager.createPassengerWithDeclaration(input);
    await expect(
      manager.createPassengerWithDeclaration({ ...input, passengerAlias: 'Other' })
    ).rejects.toMatchObject({ code: 'already-exists' });
    const other = await manager.createPassengerWithDeclaration({
      ...input,
      adultUid: 'guardian-B',
      passengerId: 'passenger-other',
    });
    expect(other.status).toBe('active');
  });

  test('revocation records pending cleanup and does not execute the worker inline', async () => {
    const firestore = makeFirestore({
      'users/guardian-A': eligibleGuardian(),
      'passengers/passenger-A': {
        passengerId: 'passenger-A',
        parentId: 'guardian-A',
        latestAuthorizationId: 'authorization-A',
        status: 'active',
      },
      'passengerAuthorizations/authorization-A': {
        authorizationId: 'authorization-A',
        passengerId: 'passenger-A',
        guardianId: 'guardian-A',
        status: 'active',
        cleanupStatus: 'none',
        cleanupGeneration: 0,
      },
    });
    const manager = createPassengerAuthorizationManager({ firestore, fieldValue: fakeFieldValue });
    const retrySpy = jest.spyOn(manager, 'retryPendingRevocationCleanups');
    await manager.updateAuthorizationStatus({
      adultUid: 'guardian-A',
      passengerId: 'passenger-A',
      newStatus: 'revoked',
    });
    expect(retrySpy).not.toHaveBeenCalled();
    expect(firestore.documents.get('passengerAuthorizations/authorization-A').cleanupStatus).toBe(
      'pending'
    );
    expect(
      [...firestore.documents.keys()].some((key) => key.startsWith('authorizationEvents/'))
    ).toBe(true);
  });

  test('repeated revocation does not create a duplicate status event', async () => {
    const firestore = makeFirestore({
      'users/guardian-A': eligibleGuardian(),
      'passengers/passenger-A': {
        passengerId: 'passenger-A',
        parentId: 'guardian-A',
        latestAuthorizationId: 'authorization-A',
        status: 'active',
      },
      'passengerAuthorizations/authorization-A': {
        authorizationId: 'authorization-A',
        passengerId: 'passenger-A',
        guardianId: 'guardian-A',
        status: 'active',
        cleanupStatus: 'none',
        cleanupGeneration: 0,
      },
    });
    const manager = createPassengerAuthorizationManager({ firestore, fieldValue: fakeFieldValue });
    await manager.updateAuthorizationStatus({
      adultUid: 'guardian-A',
      passengerId: 'passenger-A',
      newStatus: 'revoked',
    });
    const eventCount = [...firestore.documents.keys()].filter((key) =>
      key.startsWith('authorizationEvents/')
    ).length;
    await manager.updateAuthorizationStatus({
      adultUid: 'guardian-A',
      passengerId: 'passenger-A',
      newStatus: 'revoked',
    });
    expect(
      [...firestore.documents.keys()].filter((key) => key.startsWith('authorizationEvents/'))
    ).toHaveLength(eventCount);
    expect(firestore.documents.get('passengerAuthorizations/authorization-A').cleanupStatus).toBe(
      'pending'
    );
  });

  test('refuses a cleanup if the candidate match link changed before the transaction', async () => {
    const firestore = makeFirestore(
      activeLeaseFixture({ matchOverrides: { passengerIds: ['passenger-B'] } })
    );
    const manager = createPassengerAuthorizationManager({ firestore, fieldValue: fakeFieldValue });
    const result = await manager.retryPendingRevocationCleanups({ workerId: 'worker-A' });
    expect(result).toEqual({ recoveredCount: 0, failedCount: 0 });
    expect(firestore.documents.has('matches/match-A/tracking/current')).toBe(true);
  });

  test('refuses to lease a cleanup already held by another worker', async () => {
    const firestore = makeFirestore(
      activeLeaseFixture({
        authorizationOverrides: { cleanupLeaseOwner: 'worker-B', cleanupLeaseId: 'lease-B' },
      })
    );
    const manager = createPassengerAuthorizationManager({ firestore, fieldValue: fakeFieldValue });
    const result = await manager.retryPendingRevocationCleanups({ workerId: 'worker-A' });
    expect(result).toEqual({ recoveredCount: 0, failedCount: 0 });
    expect(
      firestore.documents.get('passengerAuthorizations/authorization-A').cleanupLeaseOwner
    ).toBe('worker-B');
  });

  test('uses one transaction to validate all identities and delete only linked current tracking', async () => {
    const firestore = makeFirestore(
      activeLeaseFixture({
        authorizationOverrides: {
          cleanupLeaseOwner: null,
          cleanupLeaseId: null,
          cleanupGeneration: 0,
          cleanupLeaseExpiresAt: null,
        },
      })
    );
    const manager = createPassengerAuthorizationManager({ firestore, fieldValue: fakeFieldValue });
    const result = await manager.retryPendingRevocationCleanups({ workerId: 'worker-A' });
    expect(result).toEqual({ recoveredCount: 1, failedCount: 0 });
    expect(firestore.documents.has('matches/match-A/tracking/current')).toBe(false);
    expect(firestore.documents.get('passengerAuthorizations/authorization-A')).toMatchObject({
      cleanupStatus: 'completed',
      cleanupLeaseId: null,
    });
  });
});
