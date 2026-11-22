'use strict';

const { assertAdminOrOps } = require('../src/adminOpsCallables');

const makeMockDbForOps = (userRole = 'parent') => ({
  collection(name) {
    return {
      doc(id) {
        return {
          async get() {
            if (name === 'users') {
              return { exists: true, data: () => ({ role: userRole }) };
            }
            return { exists: false, data: () => null };
          },
        };
      },
      where() {
        return {
          limit() {
            return {
              async get() {
                return { docs: [] };
              },
            };
          },
        };
      },
      limit() {
        return {
          async get() {
            return { docs: [] };
          },
        };
      },
    };
  },
});

describe('Admin Ops Unit Tests', () => {
  test('assertAdminOrOps denies access to parent role without admin/ops claims', async () => {
    const mockDb = makeMockDbForOps('parent');
    const request = { auth: { uid: 'parent-1', token: { role: 'parent' } } };

    await expect(assertAdminOrOps(request, mockDb)).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  test('assertAdminOrOps allows access to admin token role', async () => {
    const mockDb = makeMockDbForOps('parent');
    const request = { auth: { uid: 'admin-1', token: { role: 'admin' } } };

    const uid = await assertAdminOrOps(request, mockDb);
    expect(uid).toBe('admin-1');
  });

  test('assertAdminOrOps allows access to ops role from user profile', async () => {
    const mockDb = makeMockDbForOps('ops');
    const request = { auth: { uid: 'ops-1', token: {} } };

    const uid = await assertAdminOrOps(request, mockDb);
    expect(uid).toBe('ops-1');
  });
});
