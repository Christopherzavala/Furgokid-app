'use strict';

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'test' });
}

const {
  haversineDistanceKm,
  computeOrderedStopsAndEta,
  saveMultiSchoolRoute,
  advanceRouteStop,
} = require('../src/multiSchoolRouteCallables');

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
      return { docs, empty: docs.length === 0 };
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
  return spy;
};

describe('multiSchoolRouteCallables Unit Tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('haversineDistanceKm & computeOrderedStopsAndEta helpers', () => {
    test('1. haversineDistanceKm calculates distance accurately between GPS points', () => {
      // Santiago Centro to Providencia (~4.5 - 5 km)
      const dist = haversineDistanceKm(-33.4372, -70.6506, -33.4263, -70.6106);
      expect(dist).toBeGreaterThan(3);
      expect(dist).toBeLessThan(7);
    });

    test('2. computeOrderedStopsAndEta handles missing origin, missing location and status overrides', () => {
      const stops = [
        {
          stopId: 's1',
          order: 2,
          status: 'COMPLETED',
          location: { latitude: -33.4, longitude: -70.6 },
        },
        {
          stopId: 's2',
          order: 1,
          type: 'pickup',
          location: { latitude: -33.41, longitude: -70.61 },
        },
        { stopId: 's3', order: 3, type: 'dropoff' }, // no location
      ];

      const computed = computeOrderedStopsAndEta(stops, null);
      expect(computed[0].stopId).toBe('s2');
      expect(computed[0].estimatedArrivalMin).toBe(0); // no originLoc => 0
      expect(computed[1].stopId).toBe('s1');
      expect(computed[1].estimatedArrivalMin).toBeNull(); // COMPLETED => null
      expect(computed[2].stopId).toBe('s3');
      expect(computed[2].estimatedArrivalMin).toBeNull(); // no coords => null
    });
  });

  describe('saveMultiSchoolRoute', () => {
    test('3. Throws unauthenticated if auth is missing', async () => {
      await expect(saveMultiSchoolRoute.run({})).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    test('4. Throws permission-denied if user is not an approved driver', async () => {
      const mockDb = makeFirestore({
        'users/parent-1': { role: 'parent', approved: true },
        'users/unapproved-driver': { role: 'driver', approved: false },
      });
      setupFirestoreSpy(mockDb);

      await expect(
        saveMultiSchoolRoute.run({
          auth: { uid: 'parent-1' },
          data: { name: 'Route 1', shift: 'morning', stops: [{ stopId: 's1', type: 'pickup' }] },
        })
      ).rejects.toMatchObject({ code: 'permission-denied' });

      await expect(
        saveMultiSchoolRoute.run({
          auth: { uid: 'unapproved-driver' },
          data: { name: 'Route 1', shift: 'morning', stops: [{ stopId: 's1', type: 'pickup' }] },
        })
      ).rejects.toMatchObject({ code: 'permission-denied' });
    });

    test('5. Throws invalid-argument if name, shift, or stops array are invalid', async () => {
      const mockDb = makeFirestore({
        'users/driver-1': { role: 'driver', approved: true },
      });
      setupFirestoreSpy(mockDb);
      const auth = { uid: 'driver-1' };

      await expect(
        saveMultiSchoolRoute.run({
          auth,
          data: { name: '  ', shift: 'morning', stops: [{ stopId: 's1', type: 'pickup' }] },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });

      await expect(
        saveMultiSchoolRoute.run({
          auth,
          data: { name: 'Route 1', shift: 'night', stops: [{ stopId: 's1', type: 'pickup' }] },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });

      await expect(
        saveMultiSchoolRoute.run({ auth, data: { name: 'Route 1', shift: 'morning', stops: [] } })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('6. Throws invalid-argument for stop with invalid stopId, type, or coordinates', async () => {
      const mockDb = makeFirestore({
        'users/driver-1': { role: 'driver', approved: true },
      });
      setupFirestoreSpy(mockDb);
      const auth = { uid: 'driver-1' };

      // Invalid stopId
      await expect(
        saveMultiSchoolRoute.run({
          auth,
          data: { name: 'Route 1', shift: 'morning', stops: [{ type: 'pickup' }] },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });

      // Invalid type
      await expect(
        saveMultiSchoolRoute.run({
          auth,
          data: {
            name: 'Route 1',
            shift: 'morning',
            stops: [{ stopId: 's1', type: 'invalid_type' }],
          },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });

      // Bad latitude
      await expect(
        saveMultiSchoolRoute.run({
          auth,
          data: {
            name: 'Route 1',
            shift: 'morning',
            stops: [{ stopId: 's1', type: 'pickup', location: { latitude: 100, longitude: -70 } }],
          },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });

      // Bad longitude
      await expect(
        saveMultiSchoolRoute.run({
          auth,
          data: {
            name: 'Route 1',
            shift: 'morning',
            stops: [{ stopId: 's1', type: 'pickup', location: { latitude: -33, longitude: -200 } }],
          },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('7. Successfully creates/updates multi-school route with custom ID or generated ID', async () => {
      const mockDb = makeFirestore({
        'users/driver-1': { role: 'driver', approved: true },
      });
      setupFirestoreSpy(mockDb);

      const resCustom = await saveMultiSchoolRoute.run({
        auth: { uid: 'driver-1' },
        data: {
          routeId: 'custom_route_100',
          name: '  Ruta Mañana Colegio San Pedro  ',
          shift: 'morning',
          originLocation: { latitude: -33.43, longitude: -70.65 },
          stops: [
            {
              stopId: 'stop-pickup-1',
              order: 1,
              type: 'pickup',
              location: { latitude: -33.44, longitude: -70.66 },
            },
            {
              stopId: 'stop-school-1',
              order: 2,
              type: 'school',
              location: { latitude: -33.45, longitude: -70.67 },
            },
          ],
        },
      });

      expect(resCustom.success).toBe(true);
      expect(resCustom.routeId).toBe('custom_route_100');
      expect(resCustom.stopsCount).toBe(2);
      expect(resCustom.status).toBe('ACTIVE');

      const savedDoc = mockDb._documents.get('routes/custom_route_100');
      expect(savedDoc).toBeDefined();
      expect(savedDoc.name).toBe('Ruta Mañana Colegio San Pedro');
      expect(savedDoc.shift).toBe('morning');
      expect(savedDoc.stops[0].estimatedArrivalMin).toBeGreaterThan(0);

      // Test auto generated route ID
      const resAuto = await saveMultiSchoolRoute.run({
        auth: { uid: 'driver-1' },
        data: {
          name: 'Ruta Tarde',
          shift: 'afternoon',
          stops: [{ stopId: 's1', order: 1, type: 'dropoff' }],
        },
      });
      expect(resAuto.routeId.startsWith('route_driver-1_afternoon_')).toBe(true);
    });

    test('8. Rate limit enforcement (max 10 calls per 10 min window)', async () => {
      const mockDb = makeFirestore({
        'users/driver-1': { role: 'driver', approved: true },
      });
      setupFirestoreSpy(mockDb);

      const req = {
        auth: { uid: 'driver-1' },
        data: { name: 'Route 1', shift: 'morning', stops: [{ stopId: 's1', type: 'pickup' }] },
      };

      for (let i = 0; i < 10; i++) {
        await saveMultiSchoolRoute.run(req);
      }

      await expect(saveMultiSchoolRoute.run(req)).rejects.toMatchObject({
        code: 'resource-exhausted',
      });
    });
  });

  describe('advanceRouteStop', () => {
    const baseRoute = {
      routeId: 'route_100',
      driverId: 'driver-1',
      name: 'Ruta Mañana',
      shift: 'morning',
      stops: [
        {
          stopId: 'stop-1',
          order: 1,
          type: 'pickup',
          status: 'PENDING',
          location: { latitude: -33.44, longitude: -70.66 },
        },
        {
          stopId: 'stop-2',
          order: 2,
          type: 'school',
          status: 'PENDING',
          location: { latitude: -33.45, longitude: -70.67 },
        },
      ],
    };

    test('9. Throws unauthenticated if auth is missing', async () => {
      await expect(advanceRouteStop.run({})).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    test('10. Throws invalid-argument if routeId, stopId or status are invalid', async () => {
      const mockDb = makeFirestore({
        'users/driver-1': { role: 'driver', approved: true },
      });
      setupFirestoreSpy(mockDb);
      const auth = { uid: 'driver-1' };

      await expect(
        advanceRouteStop.run({
          auth,
          data: { routeId: 'bad/id', stopId: 's1', status: 'COMPLETED' },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });

      await expect(
        advanceRouteStop.run({
          auth,
          data: { routeId: 'route_1', stopId: '', status: 'COMPLETED' },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });

      await expect(
        advanceRouteStop.run({
          auth,
          data: { routeId: 'route_1', stopId: 's1', status: 'INVALID_STATUS' },
        })
      ).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    test('11. Throws not-found if route document does not exist', async () => {
      const mockDb = makeFirestore();
      setupFirestoreSpy(mockDb);

      await expect(
        advanceRouteStop.run({
          auth: { uid: 'driver-1' },
          data: { routeId: 'route_missing', stopId: 'stop-1', status: 'COMPLETED' },
        })
      ).rejects.toMatchObject({ code: 'not-found' });
    });

    test('12. Throws permission-denied if caller is not the assigned driver', async () => {
      const mockDb = makeFirestore({
        'routes/route_100': baseRoute,
      });
      setupFirestoreSpy(mockDb);

      await expect(
        advanceRouteStop.run({
          auth: { uid: 'other-driver' },
          data: { routeId: 'route_100', stopId: 'stop-1', status: 'COMPLETED' },
        })
      ).rejects.toMatchObject({ code: 'permission-denied' });
    });

    test('13. Successfully advances stop status to COMPLETED or SKIPPED and recomputes ETAs', async () => {
      const mockDb = makeFirestore({
        'routes/route_100': baseRoute,
      });
      setupFirestoreSpy(mockDb);

      const res = await advanceRouteStop.run({
        auth: { uid: 'driver-1' },
        data: {
          routeId: 'route_100',
          stopId: 'stop-1',
          status: 'COMPLETED',
          currentLocation: { latitude: -33.44, longitude: -70.66 },
        },
      });

      expect(res.success).toBe(true);
      expect(res.routeId).toBe('route_100');
      expect(res.stopId).toBe('stop-1');
      expect(res.status).toBe('COMPLETED');
      expect(res.stops).toBeDefined();

      const routeDoc = mockDb._documents.get('routes/route_100');
      expect(routeDoc.stops[0].status).toBe('COMPLETED');
      expect(routeDoc.stops[0].estimatedArrivalMin).toBeNull();
      expect(routeDoc.stops[1].status).toBe('PENDING');
    });
  });
});
