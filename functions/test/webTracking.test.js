'use strict';

const { buildSharedTrackingSnapshot } = require('../src/webTrackingCallables');

const makeMockDbForWebTracking = (shareDocData) => {
  const store = new Map();
  if (shareDocData) {
    store.set(`trackingShares/${shareDocData.shareToken}`, shareDocData);
  }
  store.set('matches/match-1', {
    status: 'active',
    school: 'Colegio San Pedro',
    zone: 'Santiago Centro',
    schedule: 'morning',
    parentId: 'parent-1',
    driverId: 'driver-1',
  });

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
            collection() {
              return {
                doc() {
                  return {
                    async get() {
                      return { exists: false, data: () => null };
                    },
                  };
                },
              };
            },
          };
        },
        where() {
          return {
            async get() {
              return { docs: [] };
            },
          };
        },
      };
    },
  };
};

describe('Web Tracking Unit Tests', () => {
  test('buildSharedTrackingSnapshot rejects revoked token', async () => {
    const mockDb = makeMockDbForWebTracking({
      shareToken: 'token-revoked',
      matchId: 'match-1',
      revoked: true,
      expiresAt: Date.now() + 3600000,
    });

    await expect(buildSharedTrackingSnapshot(mockDb, 'token-revoked')).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  test('buildSharedTrackingSnapshot rejects expired token', async () => {
    const mockDb = makeMockDbForWebTracking({
      shareToken: 'token-expired',
      matchId: 'match-1',
      revoked: false,
      expiresAt: Date.now() - 3600000,
    });

    await expect(buildSharedTrackingSnapshot(mockDb, 'token-expired')).rejects.toMatchObject({
      code: 'failed-precondition',
    });
  });

  test('buildSharedTrackingSnapshot projects snapshot without PII for valid token', async () => {
    const mockDb = makeMockDbForWebTracking({
      shareToken: 'token-valid',
      matchId: 'match-1',
      revoked: false,
      expiresAt: Date.now() + 3600000,
    });

    const snapshot = await buildSharedTrackingSnapshot(mockDb, 'token-valid');
    expect(snapshot.valid).toBe(true);
    expect(snapshot.match.school).toBe('Colegio San Pedro');
    expect(snapshot.match.parentId).toBeUndefined(); // PII excluded
    expect(snapshot.match.driverId).toBeUndefined(); // PII excluded
  });
});
