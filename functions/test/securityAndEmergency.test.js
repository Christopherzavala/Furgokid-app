'use strict';

const { enforceRateLimit, validateLocationTelemetry } = require('../src/securityGuard');

const makeMockDbForRateLimit = (initialData = {}) => {
  const store = new Map(Object.entries(initialData));
  return {
    collection(name) {
      return {
        doc(id) {
          return {
            path: `${name}/${id}`,
            async get() {
              const data = store.get(`${name}/${id}`);
              return { exists: data !== undefined, data: () => data };
            },
          };
        },
      };
    },
    async runTransaction(updateFunction) {
      const transaction = {
        async get(ref) {
          const data = store.get(ref.path);
          return { exists: data !== undefined, data: () => data };
        },
        set(ref, data, options) {
          const existing = store.get(ref.path);
          store.set(ref.path, options?.merge && existing ? { ...existing, ...data } : data);
        },
      };
      return updateFunction(transaction);
    },
  };
};

describe('Security & Emergency Unit Tests', () => {
  test('enforceRateLimit allows requests under threshold and blocks when exceeded', async () => {
    const mockDb = makeMockDbForRateLimit();
    const uid = 'user-1';
    const action = 'testAction';

    // 3 requests allowed (max 3)
    await enforceRateLimit(mockDb, { uid, action, maxRequests: 3, windowMs: 60000 });
    await enforceRateLimit(mockDb, { uid, action, maxRequests: 3, windowMs: 60000 });
    await enforceRateLimit(mockDb, { uid, action, maxRequests: 3, windowMs: 60000 });

    // 4th request should throw resource-exhausted
    await expect(
      enforceRateLimit(mockDb, { uid, action, maxRequests: 3, windowMs: 60000 })
    ).rejects.toMatchObject({ code: 'resource-exhausted' });
  });

  test('validateLocationTelemetry detects impossible GPS jumps (spoofing)', async () => {
    const mockDb = {
      collection: () => ({
        add: jest.fn().mockResolvedValue({ id: 'log-1' }),
      }),
    };

    const prevPoint = { latitude: -33.4489, longitude: -70.6693, timestamp: 1000 };
    // Move ~100km in 1 second -> speed > 45 mps
    const nextPoint = { latitude: -34.4489, longitude: -70.6693, timestamp: 2000 };

    const isValid = await validateLocationTelemetry(mockDb, {
      userId: 'driver-1',
      prevPoint,
      nextPoint,
      maxSpeedMps: 45,
    });

    expect(isValid).toBe(false);
  });
});
