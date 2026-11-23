'use strict';

const { assertSchoolAdminOrOps } = require('../src/schoolB2bCallables');

const makeMockDbForB2b = ({ schoolAdmins = [] } = {}) => {
  const store = new Map();
  store.set('schools/school_12345', {
    schoolId: 'school_12345',
    name: 'Colegio San Pedro',
    rbd: '12345',
    adminUids: schoolAdmins,
    authorizedDriverIds: [],
  });
  store.set('users/user-admin', { role: 'school_admin', schoolId: 'school_12345' });
  store.set('users/user-other', { role: 'parent' });

  return {
    collection(name) {
      return {
        doc(id) {
          const path = `${name}/${id}`;
          return {
            path,
            async get() {
              const data = store.get(path);
              return { exists: data !== undefined, data: () => data };
            },
          };
        },
      };
    },
  };
};

describe('School B2B & Fleet Unit Tests', () => {
  test('assertSchoolAdminOrOps allows school admin of the target school', async () => {
    const mockDb = makeMockDbForB2b({ schoolAdmins: ['user-admin'] });
    const result = await assertSchoolAdminOrOps('user-admin', 'school_12345', mockDb);
    expect(result).toBe(true);
  });

  test('assertSchoolAdminOrOps denies unauthorized third party user', async () => {
    const mockDb = makeMockDbForB2b({ schoolAdmins: ['user-admin'] });
    await expect(
      assertSchoolAdminOrOps('user-other', 'school_12345', mockDb)
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
