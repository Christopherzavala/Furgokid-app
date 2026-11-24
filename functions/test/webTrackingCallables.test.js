'use strict';

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'test' });
}

const {
  buildSharedTrackingSnapshot,
  createTrackingShareLink,
  revokeTrackingShareLink,
  getSharedTrackingSnapshot,
} = require('../src/webTrackingCallables');

const makeFirestore = (initial = {}) => {
  const documents = new Map(Object.entries(initial));
  let autoIdCounter = 0;

  const makeRef = (path) => ({
    path,
    id: path.split('/').pop(),
    collection(name) {
      return makeCollection(`${path}/${name}`);
    },
    async get() {
      const data = documents.get(path);
      return {
        exists: data !== undefined,
        data: () => (data ? { ...data } : null),
        get: (field) => data?.[field],
      };
    },
    async update(data) {
      const existing = documents.get(path) || {};
      documents.set(path, { ...existing, ...data });
    },
    async set(data, options) {
      const existing = documents.get(path);
      documents.set(path, options?.merge && existing ? { ...existing, ...data } : data);
    },
  });

  const makeQuery = (path, filters = [], limit = Infinity) => ({
    async get() {
      const docs = [];
      for (const [docPath, data] of documents.entries()) {
        if (!docPath.startsWith(`${path}/`) || docPath.slice(path.length + 1).includes('/')) {
          continue;
        }
        const matches = filters.every(([field, op, expected]) => {
          if (op === '==') return data[field] === expected;
          if (op === 'in') return Array.isArray(expected) && expected.includes(data[field]);
          return true;
        });
        if (matches) {
          docs.push({
            id: docPath.split('/').pop(),
            ref: makeRef(docPath),
            data: () => ({ ...data }),
          });
        }
        if (docs.length >= limit) break;
      }
      return {
        docs,
        empty: docs.length === 0,
        forEach(callback) {
          docs.forEach(callback);
        },
      };
    },
  });

  const makeCollection = (path) => ({
    path,
    doc(id) {
      const resolvedId = id || `auto_inc_${++autoIdCounter}`;
      return makeRef(`${path}/${resolvedId}`);
    },
    where(field, op, value) {
      const filters = [[field, op, value]];
      const builder = {
        where(sF, sOp, sVal) {
          filters.push([sF, sOp, sVal]);
          return builder;
        },
        limit(limitCount) {
          return {
            get: () => makeQuery(path, filters, limitCount).get(),
          };
        },
        get: () => makeQuery(path, filters).get(),
      };
      return builder;
    },
  });

  return {
    _documents: documents,
    collection: makeCollection,
    async runTransaction(callback) {
      const transaction = {
        async get(ref) {
          const path = ref.path || ref;
          const data = documents.get(path);
          return {
            exists: data !== undefined,
            data: () => (data ? { ...data } : null),
            get: (field) => data?.[field],
          };
        },
        set(ref, data, options) {
          const path = ref.path || ref;
          const existing = documents.get(path);
          documents.set(path, options?.merge && existing ? { ...existing, ...data } : data);
        },
        update(ref, data) {
          const path = ref.path || ref;
          const existing = documents.get(path) || {};
          documents.set(path, { ...existing, ...data });
        },
      };
      return callback(transaction);
    },
  };
};

const setupFirestoreSpy = (mockDb) => {
  const spy = jest.spyOn(admin, 'firestore').mockReturnValue(mockDb);
  spy.FieldValue = {
    serverTimestamp: () => 'server-timestamp',
  };
  spy.Timestamp = {
    fromMillis: (ms) => ({
      toMillis: () => ms,
    }),
  };
  return spy;
};

describe('webTrackingCallables Unit Tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('buildSharedTrackingSnapshot', () => {
    test('1. Throws invalid-argument for invalid shareToken', async () => {
      const mockDb = makeFirestore();
      await expect(buildSharedTrackingSnapshot(mockDb, 'bad/token')).rejects.toMatchObject({
        code: 'invalid-argument',
      });
    });

    test('2. Throws not-found if trackingShare doc does not exist', async () => {
      const mockDb = makeFirestore();
      await expect(buildSharedTrackingSnapshot(mockDb, 'missing-token')).rejects.toMatchObject({
        code: 'not-found',
      });
    });

    test('3. Throws permission-denied if share link is revoked', async () => {
      const mockDb = makeFirestore({
        'trackingShares/revoked-token': {
          shareToken: 'revoked-token',
          matchId: 'match-1',
          revoked: true,
        },
      });

      await expect(buildSharedTrackingSnapshot(mockDb, 'revoked-token')).rejects.toMatchObject({
        code: 'permission-denied',
      });
    });

    test('4. Throws failed-precondition if share link is expired', async () => {
      const mockDb = makeFirestore({
        'trackingShares/expired-token': {
          shareToken: 'expired-token',
          matchId: 'match-1',
          revoked: false,
          expiresAt: { toMillis: () => Date.now() - 50000 },
        },
      });

      await expect(buildSharedTrackingSnapshot(mockDb, 'expired-token')).rejects.toMatchObject({
        code: 'failed-precondition',
      });
    });

    test('5. Throws not-found if match document is missing', async () => {
      const mockDb = makeFirestore({
        'trackingShares/valid-token': {
          shareToken: 'valid-token',
          matchId: 'match-missing',
          revoked: false,
          expiresAt: Date.now() + 100000,
        },
      });

      await expect(buildSharedTrackingSnapshot(mockDb, 'valid-token')).rejects.toMatchObject({
        code: 'not-found',
      });
    });

    test('6. Successfully projects PII-free tracking snapshot with active GPS and passengers', async () => {
      const mockDb = makeFirestore({
        'trackingShares/valid-token': {
          shareToken: 'valid-token',
          matchId: 'match-100',
          revoked: false,
          expiresAt: { toMillis: () => Date.now() + 3600000 },
        },
        'matches/match-100': {
          status: 'active',
          school: 'Colegio San Pedro',
          zone: 'Santiago',
          schedule: 'morning',
          parentId: 'parent-secret',
          driverId: 'driver-secret',
        },
        'matches/match-100/tracking/current': {
          active: true,
          latitude: -33.45,
          longitude: -70.66,
          speed: 40,
          updatedAt: '2026-11-24T12:00:00Z',
        },
        'passengerStates/ps1': {
          matchId: 'match-100',
          state: 'IN_TRANSIT',
          updatedAt: '2026-11-24T12:00:00Z',
        },
        'passengerStates/ps2': { matchId: 'match-100', state: 'EXPECTED' },
      });

      const res = await buildSharedTrackingSnapshot(mockDb, 'valid-token');
      expect(res.valid).toBe(true);
      expect(res.shareToken).toBe('valid-token');
      expect(res.matchId).toBe('match-100');
      expect(res.match.school).toBe('Colegio San Pedro');
      expect(res.match.parentId).toBeUndefined();
      expect(res.match.driverId).toBeUndefined();
      expect(res.tracking.active).toBe(true);
      expect(res.tracking.latitude).toBe(-33.45);
      expect(res.passengers.length).toBe(2);
      expect(res.passengers[0].aliasOrId).toBe('Pasajero 1');
      expect(res.passengers[0].state).toBe('IN_TRANSIT');
    });

    test('7. Handles fallback defaults when tracking or passenger state is missing', async () => {
      const mockDb = makeFirestore({
        'trackingShares/token-simple': {
          shareToken: 'token-simple',
          matchId: 'match-200',
          revoked: false,
          expiresAt: Date.now() + 3600000, // Number fallback
        },
        'matches/match-200': {
          status: 'active',
          zone: 'Providencia',
        },
      });

      const res = await buildSharedTrackingSnapshot(mockDb, 'token-simple');
      expect(res.valid).toBe(true);
      expect(res.match.school).toBe('Providencia');
      expect(res.tracking.active).toBe(false);
      expect(res.passengers).toEqual([]);
    });
  });

  describe('createTrackingShareLink', () => {
    test('8. Throws unauthenticated if auth is missing', async () => {
      await expect(createTrackingShareLink.run({})).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    test('9. Throws invalid-argument if matchId is missing or invalid', async () => {
      const mockDb = makeFirestore();
      setupFirestoreSpy(mockDb);

      await expect(
        createTrackingShareLink.run({ auth: { uid: 'user-1' }, data: { matchId: 'bad/id' } })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('10. Throws not-found if match document does not exist', async () => {
      const mockDb = makeFirestore();
      setupFirestoreSpy(mockDb);

      await expect(
        createTrackingShareLink.run({
          auth: { uid: 'user-1' },
          data: { matchId: 'match-missing' },
        })
      ).rejects.toMatchObject({ code: 'not-found' });
    });

    test('11. Throws permission-denied if caller is neither participant nor admin/ops', async () => {
      const mockDb = makeFirestore({
        'matches/match-1': { driverId: 'driver-1', parentId: 'parent-1' },
        'users/foreign-user': { role: 'parent' },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        createTrackingShareLink.run({
          auth: { uid: 'foreign-user' },
          data: { matchId: 'match-1' },
        })
      ).rejects.toMatchObject({ code: 'permission-denied' });
    });

    test('12. Successfully creates share link for match participant (driver/parent) or admin', async () => {
      const mockDb = makeFirestore({
        'matches/match-1': { driverId: 'driver-1', parentId: 'parent-1' },
        'users/driver-1': { role: 'driver' },
      });
      setupFirestoreSpy(mockDb);

      const res = await createTrackingShareLink.run({
        auth: { uid: 'driver-1' },
        data: {
          matchId: 'match-1',
          expiresInHours: 48,
          label: '  Viaje de la Tarde  ',
        },
      });

      expect(res.success).toBe(true);
      expect(res.shareToken).toBeDefined();
      expect(res.shareUrl).toContain(res.shareToken);
      expect(res.matchId).toBe('match-1');

      const shareDoc = mockDb._documents.get(`trackingShares/${res.shareToken}`);
      expect(shareDoc).toBeDefined();
      expect(shareDoc.ownerUid).toBe('driver-1');
      expect(shareDoc.driverId).toBe('driver-1');
      expect(shareDoc.parentId).toBe('parent-1');
      expect(shareDoc.label).toBe('Viaje de la Tarde');
      expect(shareDoc.revoked).toBe(false);
    });

    test('13. Rate limit enforcement (max 10 calls per 10 min window)', async () => {
      const mockDb = makeFirestore({
        'matches/match-1': { driverId: 'driver-1', parentId: 'parent-1' },
        'users/driver-1': { role: 'driver' },
      });
      setupFirestoreSpy(mockDb);

      const req = { auth: { uid: 'driver-1' }, data: { matchId: 'match-1' } };
      for (let i = 0; i < 10; i++) {
        await createTrackingShareLink.run(req);
      }

      await expect(createTrackingShareLink.run(req)).rejects.toMatchObject({
        code: 'resource-exhausted',
      });
    });
  });

  describe('revokeTrackingShareLink', () => {
    test('14. Throws unauthenticated if auth is missing', async () => {
      await expect(revokeTrackingShareLink.run({})).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    test('15. Throws invalid-argument if shareToken is missing or invalid', async () => {
      const mockDb = makeFirestore();
      setupFirestoreSpy(mockDb);

      await expect(
        revokeTrackingShareLink.run({ auth: { uid: 'user-1' }, data: { shareToken: 'bad/token' } })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('16. Throws not-found if share link document does not exist', async () => {
      const mockDb = makeFirestore();
      setupFirestoreSpy(mockDb);

      await expect(
        revokeTrackingShareLink.run({
          auth: { uid: 'user-1' },
          data: { shareToken: 'token-missing' },
        })
      ).rejects.toMatchObject({ code: 'not-found' });
    });

    test('17. Throws permission-denied if caller is neither owner nor admin/ops', async () => {
      const mockDb = makeFirestore({
        'trackingShares/token-1': { shareToken: 'token-1', ownerUid: 'owner-user' },
        'users/foreign-user': { role: 'parent' },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        revokeTrackingShareLink.run({
          auth: { uid: 'foreign-user' },
          data: { shareToken: 'token-1' },
        })
      ).rejects.toMatchObject({ code: 'permission-denied' });
    });

    test('18. Allows owner or admin/ops to revoke tracking share link', async () => {
      const mockDb = makeFirestore({
        'trackingShares/token-1': { shareToken: 'token-1', ownerUid: 'owner-user', revoked: false },
        'users/owner-user': { role: 'parent' },
        'users/admin-ops': { role: 'ops' },
      });
      setupFirestoreSpy(mockDb);

      const resOwner = await revokeTrackingShareLink.run({
        auth: { uid: 'owner-user' },
        data: { shareToken: 'token-1' },
      });

      expect(resOwner.success).toBe(true);
      expect(resOwner.revoked).toBe(true);

      const doc1 = mockDb._documents.get('trackingShares/token-1');
      expect(doc1.revoked).toBe(true);

      // Admin/Ops revocation
      const resAdmin = await revokeTrackingShareLink.run({
        auth: { uid: 'admin-ops' },
        data: { shareToken: 'token-1' },
      });
      expect(resAdmin.success).toBe(true);
    });
  });

  describe('getSharedTrackingSnapshot', () => {
    test('19. Delegates public tracking snapshot call to buildSharedTrackingSnapshot', async () => {
      const mockDb = makeFirestore({
        'trackingShares/token-public': {
          shareToken: 'token-public',
          matchId: 'match-300',
          revoked: false,
          expiresAt: Date.now() + 3600000,
        },
        'matches/match-300': { status: 'active', school: 'Escolar Public' },
      });
      setupFirestoreSpy(mockDb);

      const res = await getSharedTrackingSnapshot.run({
        data: { shareToken: 'token-public' },
      });

      expect(res.valid).toBe(true);
      expect(res.shareToken).toBe('token-public');
      expect(res.match.school).toBe('Escolar Public');
    });
  });
});
