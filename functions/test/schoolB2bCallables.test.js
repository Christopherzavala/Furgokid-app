'use strict';

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'test' });
}

const {
  assertSchoolAdminOrOps,
  registerSchoolB2b,
  authorizeSchoolDriver,
  getSchoolArrivalsSnapshot,
} = require('../src/schoolB2bCallables');

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
      const updated = { ...existing };
      for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === 'object' && Array.isArray(v.unionElements)) {
          updated[k] = Array.from(new Set([...(updated[k] || []), ...v.unionElements]));
        } else if (v && typeof v === 'object' && Array.isArray(v.removeElements)) {
          updated[k] = (updated[k] || []).filter((item) => !v.removeElements.includes(item));
        } else {
          updated[k] = v;
        }
      }
      documents.set(path, updated);
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
          const updated = { ...existing };
          for (const [k, v] of Object.entries(data)) {
            if (v && typeof v === 'object' && Array.isArray(v.unionElements)) {
              updated[k] = Array.from(new Set([...(updated[k] || []), ...v.unionElements]));
            } else if (v && typeof v === 'object' && Array.isArray(v.removeElements)) {
              updated[k] = (updated[k] || []).filter((item) => !v.removeElements.includes(item));
            } else {
              updated[k] = v;
            }
          }
          documents.set(path, updated);
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
    arrayUnion: (...elements) => ({ unionElements: elements }),
    arrayRemove: (...elements) => ({ removeElements: elements }),
  };
  return spy;
};

describe('schoolB2bCallables Unit Tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('assertSchoolAdminOrOps', () => {
    test('1. Throws unauthenticated if uid is missing', async () => {
      const mockDb = makeFirestore();
      await expect(assertSchoolAdminOrOps(null, 'school_1', mockDb)).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    test('2. Allows global admin or ops user', async () => {
      const mockDb = makeFirestore({
        'users/admin-user': { role: 'admin' },
        'users/ops-user': { role: 'ops' },
      });

      await expect(assertSchoolAdminOrOps('admin-user', 'school_1', mockDb)).resolves.toBe(true);
      await expect(assertSchoolAdminOrOps('ops-user', 'school_1', mockDb)).resolves.toBe(true);
    });

    test('3. Throws invalid-argument if schoolId is missing for non-global admin', async () => {
      const mockDb = makeFirestore({
        'users/user-1': { role: 'parent' },
      });

      await expect(assertSchoolAdminOrOps('user-1', null, mockDb)).rejects.toMatchObject({
        code: 'invalid-argument',
      });
    });

    test('4. Throws not-found if school document does not exist', async () => {
      const mockDb = makeFirestore({
        'users/user-1': { role: 'school_admin' },
      });

      await expect(
        assertSchoolAdminOrOps('user-1', 'school_missing', mockDb)
      ).rejects.toMatchObject({
        code: 'not-found',
      });
    });

    test('5. Throws permission-denied for unauthorized user', async () => {
      const mockDb = makeFirestore({
        'users/user-other': { role: 'parent', schoolId: 'school_2' },
        'schools/school_1': { adminUids: ['user-admin'] },
      });

      await expect(assertSchoolAdminOrOps('user-other', 'school_1', mockDb)).rejects.toMatchObject({
        code: 'permission-denied',
      });
    });

    test('6. Allows school admin by adminUids, schoolId or schoolRole', async () => {
      const mockDb = makeFirestore({
        'users/user-admin': { role: 'parent' },
        'users/user-school-id': { role: 'parent', schoolId: 'school_1' },
        'users/user-school-role': { schoolRole: 'school_admin' },
        'schools/school_1': { adminUids: ['user-admin'] },
      });

      await expect(assertSchoolAdminOrOps('user-admin', 'school_1', mockDb)).resolves.toBe(true);
      await expect(assertSchoolAdminOrOps('user-school-id', 'school_1', mockDb)).resolves.toBe(
        true
      );
      await expect(assertSchoolAdminOrOps('user-school-role', 'school_1', mockDb)).resolves.toBe(
        true
      );
    });
  });

  describe('registerSchoolB2b', () => {
    test('7. Throws unauthenticated if auth is missing', async () => {
      await expect(registerSchoolB2b.run({})).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    test('8. Throws invalid-argument if name, rbd, commune, or address are invalid', async () => {
      const mockDb = makeFirestore();
      setupFirestoreSpy(mockDb);
      const auth = { uid: 'user-1' };

      await expect(registerSchoolB2b.run({ auth, data: { name: '  ' } })).rejects.toMatchObject({
        code: 'invalid-argument',
      });

      await expect(
        registerSchoolB2b.run({ auth, data: { name: 'School 1', rbd: '  ' } })
      ).rejects.toMatchObject({ code: 'invalid-argument' });

      await expect(
        registerSchoolB2b.run({ auth, data: { name: 'School 1', rbd: '123', commune: '  ' } })
      ).rejects.toMatchObject({ code: 'invalid-argument' });

      await expect(
        registerSchoolB2b.run({
          auth,
          data: { name: 'School 1', rbd: '123', commune: 'Santiago', address: '  ' },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('9. Successfully registers new school and sets user as school_admin', async () => {
      const mockDb = makeFirestore({
        'users/user-1': { role: 'parent' },
      });
      setupFirestoreSpy(mockDb);

      const res = await registerSchoolB2b.run({
        auth: { uid: 'user-1' },
        data: {
          name: '  Colegio San Pedro  ',
          rbd: '12345-K',
          commune: 'Santiago',
          address: 'Av. Principal 123',
          gateLocation: { latitude: -33.4, longitude: -70.6 },
          schedules: { entry: '08:00', exit: '16:00' },
        },
      });

      expect(res.success).toBe(true);
      expect(res.schoolId).toBe('school_12345_k');
      expect(res.name).toBe('Colegio San Pedro');
      expect(res.role).toBe('school_admin');

      const schoolDoc = mockDb._documents.get('schools/school_12345_k');
      expect(schoolDoc).toBeDefined();
      expect(schoolDoc.name).toBe('Colegio San Pedro');
      expect(schoolDoc.rbd).toBe('12345-K');
      expect(schoolDoc.adminUids).toEqual(['user-1']);
      expect(schoolDoc.status).toBe('ACTIVE');

      const userDoc = mockDb._documents.get('users/user-1');
      expect(userDoc.role).toBe('school_admin');
      expect(userDoc.schoolId).toBe('school_12345_k');
    });

    test('10. Updates existing school, appends admin, and preserves global admin role', async () => {
      const mockDb = makeFirestore({
        'schools/school_999': {
          schoolId: 'school_999',
          adminUids: ['user-existing'],
          authorizedDriverIds: ['driver-1'],
          createdAt: 'old-timestamp',
        },
        'users/admin-ops': { role: 'admin' },
      });
      setupFirestoreSpy(mockDb);

      const res = await registerSchoolB2b.run({
        auth: { uid: 'admin-ops' },
        data: {
          name: 'Colegio Norte',
          rbd: '999',
          commune: 'Concepcion',
          address: 'Calle 1',
        },
      });

      expect(res.success).toBe(true);
      const schoolDoc = mockDb._documents.get('schools/school_999');
      expect(schoolDoc.adminUids).toEqual(['user-existing', 'admin-ops']);
      expect(schoolDoc.authorizedDriverIds).toEqual(['driver-1']);
      expect(schoolDoc.createdAt).toBe('old-timestamp');

      // Admin role preserved
      const userDoc = mockDb._documents.get('users/admin-ops');
      expect(userDoc.role).toBe('admin');
      expect(userDoc.schoolRole).toBe('school_admin');
    });

    test('11. Rate limit enforcement (max 5 calls per 10 min window)', async () => {
      const mockDb = makeFirestore({
        'users/user-1': { role: 'parent' },
      });
      setupFirestoreSpy(mockDb);

      const req = {
        auth: { uid: 'user-1' },
        data: { name: 'School', rbd: '111', commune: 'Commune', address: 'Addr' },
      };

      for (let i = 0; i < 5; i++) {
        await registerSchoolB2b.run(req);
      }

      await expect(registerSchoolB2b.run(req)).rejects.toMatchObject({
        code: 'resource-exhausted',
      });
    });
  });

  describe('authorizeSchoolDriver', () => {
    test('12. Throws invalid-argument if schoolId, driverId or action are invalid', async () => {
      const mockDb = makeFirestore({
        'users/admin-1': { role: 'admin' },
      });
      setupFirestoreSpy(mockDb);
      const auth = { uid: 'admin-1' };

      await expect(
        authorizeSchoolDriver.run({
          auth,
          data: { schoolId: 'bad/id', driverId: 'drv1', action: 'authorize' },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });

      await expect(
        authorizeSchoolDriver.run({
          auth,
          data: { schoolId: 'school_1', driverId: 'drv1', action: 'invalid_action' },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('13. Authorize: Throws not-found if driver user doc does not exist', async () => {
      const mockDb = makeFirestore({
        'users/admin-1': { role: 'admin' },
        'schools/school_1': { adminUids: ['admin-1'] },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        authorizeSchoolDriver.run({
          auth: { uid: 'admin-1' },
          data: { schoolId: 'school_1', driverId: 'driver-missing', action: 'authorize' },
        })
      ).rejects.toMatchObject({ code: 'not-found' });
    });

    test('14. Authorize: Throws failed-precondition if driver is not approved or not role driver', async () => {
      const mockDb = makeFirestore({
        'users/admin-1': { role: 'admin' },
        'schools/school_1': { adminUids: ['admin-1'] },
        'users/driver-unapproved': { role: 'driver', approved: false },
        'users/parent-user': { role: 'parent', approved: true },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        authorizeSchoolDriver.run({
          auth: { uid: 'admin-1' },
          data: { schoolId: 'school_1', driverId: 'driver-unapproved', action: 'authorize' },
        })
      ).rejects.toMatchObject({ code: 'failed-precondition' });

      await expect(
        authorizeSchoolDriver.run({
          auth: { uid: 'admin-1' },
          data: { schoolId: 'school_1', driverId: 'parent-user', action: 'authorize' },
        })
      ).rejects.toMatchObject({ code: 'failed-precondition' });
    });

    test('15. Successfully authorizes approved driver with arrayUnion', async () => {
      const mockDb = makeFirestore({
        'users/admin-1': { role: 'admin' },
        'schools/school_1': { adminUids: ['admin-1'], authorizedDriverIds: ['driver-old'] },
        'users/driver-ok': { role: 'driver', approved: true },
      });
      setupFirestoreSpy(mockDb);

      const res = await authorizeSchoolDriver.run({
        auth: { uid: 'admin-1' },
        data: { schoolId: 'school_1', driverId: 'driver-ok', action: 'authorize' },
      });

      expect(res.success).toBe(true);
      expect(res.action).toBe('authorize');

      const schoolDoc = mockDb._documents.get('schools/school_1');
      expect(schoolDoc.authorizedDriverIds).toContain('driver-ok');
    });

    test('16. Successfully revokes driver authorization with arrayRemove', async () => {
      const mockDb = makeFirestore({
        'users/admin-1': { role: 'admin' },
        'schools/school_1': {
          adminUids: ['admin-1'],
          authorizedDriverIds: ['driver-1', 'driver-2'],
        },
      });
      setupFirestoreSpy(mockDb);

      const res = await authorizeSchoolDriver.run({
        auth: { uid: 'admin-1' },
        data: { schoolId: 'school_1', driverId: 'driver-1', action: 'revoke' },
      });

      expect(res.success).toBe(true);
      expect(res.action).toBe('revoke');

      const schoolDoc = mockDb._documents.get('schools/school_1');
      expect(schoolDoc.authorizedDriverIds).toEqual(['driver-2']);
    });

    test('17. Rate limit enforcement (max 10 calls per 10 min window)', async () => {
      const mockDb = makeFirestore({
        'users/admin-1': { role: 'admin' },
        'schools/school_1': { adminUids: ['admin-1'] },
      });
      setupFirestoreSpy(mockDb);

      const req = {
        auth: { uid: 'admin-1' },
        data: { schoolId: 'school_1', driverId: 'driver-1', action: 'revoke' },
      };

      for (let i = 0; i < 10; i++) {
        await authorizeSchoolDriver.run(req);
      }

      await expect(authorizeSchoolDriver.run(req)).rejects.toMatchObject({
        code: 'resource-exhausted',
      });
    });
  });

  describe('getSchoolArrivalsSnapshot', () => {
    test('18. Throws invalid-argument if schoolId is missing or invalid', async () => {
      const mockDb = makeFirestore({
        'users/admin-1': { role: 'admin' },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        getSchoolArrivalsSnapshot.run({
          auth: { uid: 'admin-1' },
          data: { schoolId: 'bad/id' },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('19. Throws not-found if school document does not exist', async () => {
      const mockDb = makeFirestore({
        'users/admin-1': { role: 'admin' },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        getSchoolArrivalsSnapshot.run({
          auth: { uid: 'admin-1' },
          data: { schoolId: 'school_missing' },
        })
      ).rejects.toMatchObject({ code: 'not-found' });
    });

    test('20. Returns correct arrival counts from matches and passenger states', async () => {
      const mockDb = makeFirestore({
        'users/admin-1': { role: 'admin' },
        'schools/school_1': {
          schoolId: 'school_1',
          name: 'Colegio San Pedro',
          authorizedDriverIds: ['driver-1'],
        },
        'matches/m1': { status: 'active', schoolId: 'school_1' },
        'matches/m2': { status: 'active', school: '  colegio san pedro  ' },
        'matches/m3': { status: 'active', schoolId: 'school_other' },
        'passengerStates/ps1': { matchId: 'm1', state: 'EXPECTED' },
        'passengerStates/ps2': { matchId: 'm1', state: 'IN_TRANSIT' },
        'passengerStates/ps3': { matchId: 'm2', state: 'HANDOVER_CONFIRMED' },
      });
      setupFirestoreSpy(mockDb);

      const res = await getSchoolArrivalsSnapshot.run({
        auth: { uid: 'admin-1' },
        data: { schoolId: 'school_1' },
      });

      expect(res.schoolId).toBe('school_1');
      expect(res.schoolName).toBe('Colegio San Pedro');
      expect(res.authorizedDriverIds).toEqual(['driver-1']);
      expect(res.activeMatchesCount).toBe(2);
      expect(res.counts.EXPECTED).toBe(1);
      expect(res.counts.IN_TRANSIT).toBe(1);
      expect(res.counts.HANDOVER_CONFIRMED).toBe(1);
      expect(res.counts.ABSENT).toBe(0);
      expect(res.retrievedAt).toBeDefined();
    });
  });
});
