'use strict';

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'test' });
}

const {
  createTrackingShareLink,
  revokeTrackingShareLink,
  getSharedTrackingSnapshot,
  buildSharedTrackingSnapshot,
} = require('../src/webTrackingCallables');

const makeFirestore = (initial = {}) => {
  const documents = new Map(Object.entries(initial));

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
      return { docs, empty: docs.length === 0 };
    },
  });

  const makeCollection = (path) => ({
    path,
    doc(id) {
      return makeRef(`${path}/${id}`);
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
          };
        },
        set(ref, data, options) {
          const path = ref.path || ref;
          const existing = documents.get(path);
          documents.set(path, options?.merge && existing ? { ...existing, ...data } : data);
        },
        update(ref, data) {
          const path = ref.path || ref;
          const existing = documents.get(path);
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
    fromMillis: (ms) => ({ toMillis: () => ms }),
  };
  return spy;
};

describe('webTrackingCallables Unit Tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('buildSharedTrackingSnapshot', () => {
    test('1. Throws invalid-argument if shareToken is missing or malformed', async () => {
      const mockDb = makeFirestore({});
      await expect(buildSharedTrackingSnapshot(mockDb, 'bad/token')).rejects.toMatchObject({
        code: 'invalid-argument',
      });
    });

    test('2. Throws not-found if tracking share document does not exist', async () => {
      const mockDb = makeFirestore({});
      await expect(buildSharedTrackingSnapshot(mockDb, 'token_missing')).rejects.toMatchObject({
        code: 'not-found',
      });
    });

    test('3. Throws permission-denied if share link is revoked', async () => {
      const mockDb = makeFirestore({
        'trackingShares/token_revoked': { revoked: true },
      });
      await expect(buildSharedTrackingSnapshot(mockDb, 'token_revoked')).rejects.toMatchObject({
        code: 'permission-denied',
      });
    });

    test('4. Throws failed-precondition if share link has expired', async () => {
      const mockDb = makeFirestore({
        'trackingShares/token_expired': { revoked: false, expiresAt: Date.now() - 1000 },
      });
      await expect(buildSharedTrackingSnapshot(mockDb, 'token_expired')).rejects.toMatchObject({
        code: 'failed-precondition',
      });
    });

    test('5. Throws not-found if associated match record does not exist', async () => {
      const mockDb = makeFirestore({
        'trackingShares/token_valid': {
          revoked: false,
          expiresAt: Date.now() + 3600000,
          matchId: 'match-missing',
        },
      });
      await expect(buildSharedTrackingSnapshot(mockDb, 'token_valid')).rejects.toMatchObject({
        code: 'not-found',
      });
    });

    test('6. Successfully builds snapshot with tracking and passenger states (omitting PII)', async () => {
      const mockDb = makeFirestore({
        'trackingShares/token_valid': {
          revoked: false,
          expiresAt: Date.now() + 3600000,
          matchId: 'match-1',
        },
        'matches/match-1': {
          status: 'active',
          school: 'Colegio San Pedro',
          zone: 'Centro',
          schedule: 'morning',
        },
        'matches/match-1/tracking/current': {
          active: true,
          latitude: -33.4,
          longitude: -70.6,
          speed: 10,
        },
        'passengerStates/match-1_p1': { matchId: 'match-1', state: 'IN_TRANSIT' },
      });

      const snapshot = await buildSharedTrackingSnapshot(mockDb, 'token_valid');
      expect(snapshot.valid).toBe(true);
      expect(snapshot.match.school).toBe('Colegio San Pedro');
      expect(snapshot.tracking.active).toBe(true);
      expect(snapshot.passengers).toHaveLength(1);
      expect(snapshot.passengers[0].state).toBe('IN_TRANSIT');
    });
  });

  describe('createTrackingShareLink', () => {
    test('7. Throws unauthenticated if auth is missing', async () => {
      await expect(createTrackingShareLink.run({})).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    test('8. Throws invalid-argument if matchId is missing or malformed', async () => {
      const mockDb = makeFirestore({});
      setupFirestoreSpy(mockDb);

      await expect(
        createTrackingShareLink.run({ auth: { uid: 'user-1' }, data: { matchId: 'bad/id' } })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('9. Throws not-found if match record does not exist', async () => {
      const mockDb = makeFirestore({});
      setupFirestoreSpy(mockDb);

      await expect(
        createTrackingShareLink.run({
          auth: { uid: 'user-1' },
          data: { matchId: 'match-missing' },
        })
      ).rejects.toMatchObject({ code: 'not-found' });
    });

    test('10. Throws permission-denied if user is neither participant nor admin/ops', async () => {
      const mockDb = makeFirestore({
        'matches/match-1': { driverId: 'driver-1', parentId: 'parent-1' },
        'users/user-stranger': { role: 'parent' },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        createTrackingShareLink.run({
          auth: { uid: 'user-stranger' },
          data: { matchId: 'match-1' },
        })
      ).rejects.toMatchObject({ code: 'permission-denied' });
    });

    test('11. Successfully creates share link as match participant or admin', async () => {
      const mockDb = makeFirestore({
        'matches/match-1': { driverId: 'driver-1', parentId: 'parent-1' },
        'users/driver-1': { role: 'driver' },
      });
      setupFirestoreSpy(mockDb);

      const res = await createTrackingShareLink.run({
        auth: { uid: 'driver-1' },
        data: { matchId: 'match-1', expiresInHours: 12, label: 'Enlace Test' },
      });

      expect(res.success).toBe(true);
      expect(res.shareToken).toBeDefined();
      expect(res.shareUrl).toContain('tracking.html?token=');

      const savedShare = mockDb._documents.get(`trackingShares/${res.shareToken}`);
      expect(savedShare).toBeDefined();
      expect(savedShare.label).toBe('Enlace Test');
    });
  });

  describe('revokeTrackingShareLink', () => {
    test('12. Throws unauthenticated if auth is missing', async () => {
      await expect(revokeTrackingShareLink.run({})).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    test('13. Throws invalid-argument if shareToken is missing or malformed', async () => {
      const mockDb = makeFirestore({});
      setupFirestoreSpy(mockDb);

      await expect(
        revokeTrackingShareLink.run({ auth: { uid: 'user-1' }, data: { shareToken: 'bad/token' } })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('14. Throws not-found if share link record does not exist', async () => {
      const mockDb = makeFirestore({});
      setupFirestoreSpy(mockDb);

      await expect(
        revokeTrackingShareLink.run({
          auth: { uid: 'user-1' },
          data: { shareToken: 'token_missing' },
        })
      ).rejects.toMatchObject({ code: 'not-found' });
    });

    test('15. Throws permission-denied if caller is neither owner nor admin/ops', async () => {
      const mockDb = makeFirestore({
        'trackingShares/token_1': { ownerUid: 'owner-1' },
        'users/user-other': { role: 'parent' },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        revokeTrackingShareLink.run({
          auth: { uid: 'user-other' },
          data: { shareToken: 'token_1' },
        })
      ).rejects.toMatchObject({ code: 'permission-denied' });
    });

    test('16. Successfully revokes share link as owner or admin', async () => {
      const mockDb = makeFirestore({
        'trackingShares/token_1': { ownerUid: 'owner-1', revoked: false },
        'users/admin-1': { role: 'admin' },
      });
      setupFirestoreSpy(mockDb);

      const res = await revokeTrackingShareLink.run({
        auth: { uid: 'admin-1' },
        data: { shareToken: 'token_1' },
      });

      expect(res.success).toBe(true);
      expect(res.revoked).toBe(true);

      const updatedShare = mockDb._documents.get('trackingShares/token_1');
      expect(updatedShare.revoked).toBe(true);
    });
  });

  describe('getSharedTrackingSnapshot', () => {
    test('17. Calls buildSharedTrackingSnapshot successfully', async () => {
      const mockDb = makeFirestore({
        'trackingShares/token_valid': {
          revoked: false,
          expiresAt: Date.now() + 3600000,
          matchId: 'match-1',
        },
        'matches/match-1': { status: 'active', school: 'Colegio' },
      });
      setupFirestoreSpy(mockDb);

      const res = await getSharedTrackingSnapshot.run({
        data: { shareToken: 'token_valid' },
      });

      expect(res.valid).toBe(true);
      expect(res.match.school).toBe('Colegio');
    });
  });
});
