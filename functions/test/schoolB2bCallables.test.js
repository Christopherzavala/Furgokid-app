'use strict';

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'test' });
}

const {
  registerSchoolB2b,
  authorizeSchoolDriver,
  getSchoolArrivalsSnapshot,
  assertSchoolAdminOrOps,
} = require('../src/schoolB2bCallables');

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
      for (const [k, v] of Object.entries(data)) {
        if (v && typeof v === 'object' && v._arrayUnion) {
          const currentArr = Array.isArray(existing[k]) ? existing[k] : [];
          if (!currentArr.includes(v._arrayUnion)) {
            existing[k] = [...currentArr, v._arrayUnion];
          }
        } else if (v && typeof v === 'object' && v._arrayRemove) {
          const currentArr = Array.isArray(existing[k]) ? existing[k] : [];
          existing[k] = currentArr.filter((item) => item !== v._arrayRemove);
        } else {
          existing[k] = v;
        }
      }
      documents.set(path, existing);
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
        forEach: (cb) => docs.forEach(cb),
      };
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
    arrayUnion: (val) => ({ _arrayUnion: val }),
    arrayRemove: (val) => ({ _arrayRemove: val }),
  };
  return spy;
};

describe('schoolB2bCallables Unit Tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('assertSchoolAdminOrOps', () => {
    test('1. Throws unauthenticated if uid is missing', async () => {
      const mockDb = makeFirestore({});
      await expect(assertSchoolAdminOrOps(null, 'school_1', mockDb)).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    test('2. Allows global admin or ops users regardless of schoolId', async () => {
      const mockDb = makeFirestore({
        'users/admin-1': { role: 'admin' },
      });
      await expect(assertSchoolAdminOrOps('admin-1', 'school_1', mockDb)).resolves.toBe(true);
    });

    test('3. Throws invalid-argument if schoolId is missing for non-global admin', async () => {
      const mockDb = makeFirestore({
        'users/user-1': { role: 'parent' },
      });
      await expect(assertSchoolAdminOrOps('user-1', null, mockDb)).rejects.toMatchObject({
        code: 'invalid-argument',
      });
    });

    test('4. Throws not-found when school record does not exist', async () => {
      const mockDb = makeFirestore({
        'users/user-1': { role: 'parent' },
      });
      await expect(
        assertSchoolAdminOrOps('user-1', 'school_missing', mockDb)
      ).rejects.toMatchObject({
        code: 'not-found',
      });
    });

    test('5. Throws permission-denied when user is not a school admin for that school', async () => {
      const mockDb = makeFirestore({
        'users/user-1': { role: 'parent' },
        'schools/school_1': { adminUids: ['other-admin'] },
      });
      await expect(assertSchoolAdminOrOps('user-1', 'school_1', mockDb)).rejects.toMatchObject({
        code: 'permission-denied',
      });
    });

    test('6. Allows school admin matching adminUids array, schoolId, or schoolRole', async () => {
      const mockDb = makeFirestore({
        'users/user-1': { role: 'school_admin' },
        'schools/school_1': { adminUids: ['user-1'] },
      });
      await expect(assertSchoolAdminOrOps('user-1', 'school_1', mockDb)).resolves.toBe(true);
    });
  });

  describe('registerSchoolB2b', () => {
    test('7. Throws unauthenticated if auth is missing', async () => {
      await expect(registerSchoolB2b.run({})).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    test('8. Throws invalid-argument for missing or invalid form fields', async () => {
      const mockDb = makeFirestore({});
      setupFirestoreSpy(mockDb);

      const auth = { uid: 'user-1' };

      await expect(
        registerSchoolB2b.run({ auth, data: { rbd: '123', commune: 'Stgo', address: 'Av 1' } })
      ).rejects.toMatchObject({ code: 'invalid-argument' });

      await expect(
        registerSchoolB2b.run({
          auth,
          data: { name: 'Colegio 1', commune: 'Stgo', address: 'Av 1' },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });

      await expect(
        registerSchoolB2b.run({ auth, data: { name: 'Colegio 1', rbd: '123', address: 'Av 1' } })
      ).rejects.toMatchObject({ code: 'invalid-argument' });

      await expect(
        registerSchoolB2b.run({ auth, data: { name: 'Colegio 1', rbd: '123', commune: 'Stgo' } })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('9. Successfully registers new school and sets caller as school_admin', async () => {
      const mockDb = makeFirestore({
        'users/user-1': { role: 'parent' },
      });
      setupFirestoreSpy(mockDb);

      const res = await registerSchoolB2b.run({
        auth: { uid: 'user-1' },
        data: {
          name: '  Colegio San Pedro  ',
          rbd: ' 12345 ',
          commune: ' Santiago ',
          address: ' Av. Principal 123 ',
          gateLocation: { latitude: -33.45, longitude: -70.66 },
        },
      });

      expect(res.success).toBe(true);
      expect(res.schoolId).toBe('school_12345');
      expect(res.name).toBe('Colegio San Pedro');

      const savedSchool = mockDb._documents.get('schools/school_12345');
      expect(savedSchool).toBeDefined();
      expect(savedSchool.adminUids).toContain('user-1');
      expect(savedSchool.rbd).toBe('12345');

      const updatedUser = mockDb._documents.get('users/user-1');
      expect(updatedUser.schoolId).toBe('school_12345');
      expect(updatedUser.role).toBe('school_admin');
    });

    test('10. Merges adminUids if school record already exists and preserves global admin role', async () => {
      const mockDb = makeFirestore({
        'schools/school_12345': {
          schoolId: 'school_12345',
          adminUids: ['existing-admin'],
          authorizedDriverIds: ['driver-1'],
        },
        'users/global-admin': { role: 'admin' },
      });
      setupFirestoreSpy(mockDb);

      const res = await registerSchoolB2b.run({
        auth: { uid: 'global-admin' },
        data: {
          name: 'Colegio San Pedro',
          rbd: '12345',
          commune: 'Santiago',
          address: 'Av. Principal 123',
        },
      });

      expect(res.success).toBe(true);
      const savedSchool = mockDb._documents.get('schools/school_12345');
      expect(savedSchool.adminUids).toEqual(['existing-admin', 'global-admin']);
      expect(savedSchool.authorizedDriverIds).toEqual(['driver-1']);

      const updatedUser = mockDb._documents.get('users/global-admin');
      expect(updatedUser.role).toBe('admin'); // Preserved global admin role
      expect(updatedUser.schoolRole).toBe('school_admin');
    });
  });

  describe('authorizeSchoolDriver', () => {
    test('11. Throws invalid-argument for invalid schoolId, driverId, or action', async () => {
      const mockDb = makeFirestore({});
      setupFirestoreSpy(mockDb);
      const auth = { uid: 'admin-1' };

      await expect(
        authorizeSchoolDriver.run({
          auth,
          data: { schoolId: 'bad/id', driverId: 'driver-1', action: 'authorize' },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });

      await expect(
        authorizeSchoolDriver.run({
          auth,
          data: { schoolId: 'school_1', driverId: 'driver-1', action: 'invalid_action' },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('12. Throws not-found when authorizing non-existent driver', async () => {
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

    test('13. Throws failed-precondition when driver is unapproved or not driver role', async () => {
      const mockDb = makeFirestore({
        'users/admin-1': { role: 'admin' },
        'users/unapproved-driver': { role: 'driver', approved: false },
        'schools/school_1': { adminUids: ['admin-1'] },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        authorizeSchoolDriver.run({
          auth: { uid: 'admin-1' },
          data: { schoolId: 'school_1', driverId: 'unapproved-driver', action: 'authorize' },
        })
      ).rejects.toMatchObject({ code: 'failed-precondition' });
    });

    test('14. Successfully authorizes approved driver using arrayUnion', async () => {
      const mockDb = makeFirestore({
        'users/admin-1': { role: 'admin' },
        'users/approved-driver': { role: 'driver', approved: true },
        'schools/school_1': { adminUids: ['admin-1'], authorizedDriverIds: [] },
      });
      setupFirestoreSpy(mockDb);

      const res = await authorizeSchoolDriver.run({
        auth: { uid: 'admin-1' },
        data: { schoolId: 'school_1', driverId: 'approved-driver', action: 'authorize' },
      });

      expect(res.success).toBe(true);
      expect(res.action).toBe('authorize');

      const schoolDoc = mockDb._documents.get('schools/school_1');
      expect(schoolDoc.authorizedDriverIds).toContain('approved-driver');
    });

    test('15. Successfully revokes authorized driver using arrayRemove', async () => {
      const mockDb = makeFirestore({
        'users/admin-1': { role: 'admin' },
        'schools/school_1': { adminUids: ['admin-1'], authorizedDriverIds: ['approved-driver'] },
      });
      setupFirestoreSpy(mockDb);

      const res = await authorizeSchoolDriver.run({
        auth: { uid: 'admin-1' },
        data: { schoolId: 'school_1', driverId: 'approved-driver', action: 'revoke' },
      });

      expect(res.success).toBe(true);
      expect(res.action).toBe('revoke');

      const schoolDoc = mockDb._documents.get('schools/school_1');
      expect(schoolDoc.authorizedDriverIds).not.toContain('approved-driver');
    });
  });

  describe('getSchoolArrivalsSnapshot', () => {
    test('16. Throws invalid-argument for invalid schoolId', async () => {
      await expect(
        getSchoolArrivalsSnapshot.run({ auth: { uid: 'admin-1' }, data: { schoolId: 'bad/id' } })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('17. Throws not-found when school record does not exist', async () => {
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

    test('18. Returns aggregated arrivals metrics and student custody counts', async () => {
      const mockDb = makeFirestore({
        'users/admin-1': { role: 'admin' },
        'schools/school_1': { name: 'Colegio San Pedro', authorizedDriverIds: ['driver-1'] },
        'matches/match-1': { status: 'active', schoolId: 'school_1' },
        'passengerStates/match-1_pass-1': { matchId: 'match-1', state: 'IN_TRANSIT' },
        'passengerStates/match-1_pass-2': { matchId: 'match-1', state: 'HANDOVER_CONFIRMED' },
      });
      setupFirestoreSpy(mockDb);

      const res = await getSchoolArrivalsSnapshot.run({
        auth: { uid: 'admin-1' },
        data: { schoolId: 'school_1' },
      });

      expect(res.schoolId).toBe('school_1');
      expect(res.schoolName).toBe('Colegio San Pedro');
      expect(res.activeMatchesCount).toBe(1);
      expect(res.counts.IN_TRANSIT).toBe(1);
      expect(res.counts.HANDOVER_CONFIRMED).toBe(1);
      expect(res.counts.EXPECTED).toBe(0);
    });
  });
});
