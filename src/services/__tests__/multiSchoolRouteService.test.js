const mockHttpsCallable = jest.fn();

jest.mock('firebase/functions', () => ({
  httpsCallable: (functions, name) => {
    mockHttpsCallable.mockImplementation(async (data) => ({
      data: { success: true, routeId: 'route-1', name, data },
    }));
    return mockHttpsCallable;
  },
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  getDocs: jest.fn().mockResolvedValue({ docs: [] }),
  query: jest.fn(),
  where: jest.fn(),
}));

jest.mock('../../config/firebase', () => ({
  auth: { currentUser: { uid: 'driver-1' } },
  db: {},
  functions: {},
}));

import {
  advanceRouteStop,
  computeOrderedStopsAndEta,
  fetchDriverRoutes,
  saveMultiSchoolRoute,
} from '../multiSchoolRouteService';

describe('multiSchoolRouteService unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('computeOrderedStopsAndEta calculates ordered ETAs in client', () => {
    const stops = [
      { stopId: 's1', order: 1, type: 'pickup', location: { latitude: -33.44, longitude: -70.66 } },
      { stopId: 's2', order: 2, type: 'school', location: { latitude: -33.46, longitude: -70.68 } },
    ];
    const origin = { latitude: -33.43, longitude: -70.65 };
    const res = computeOrderedStopsAndEta(stops, origin);
    expect(res).toHaveLength(2);
    expect(res[0].estimatedArrivalMin).toBeGreaterThan(0);
    expect(res[1].estimatedArrivalMin).toBeGreaterThan(res[0].estimatedArrivalMin);
  });

  test('saveMultiSchoolRoute calls saveMultiSchoolRoute callable', async () => {
    const res = await saveMultiSchoolRoute({
      name: 'Ruta Mañana',
      shift: 'morning',
      stops: [],
    });
    expect(res.name).toBe('saveMultiSchoolRoute');
  });

  test('advanceRouteStop calls advanceRouteStop callable', async () => {
    const res = await advanceRouteStop({
      routeId: 'route-1',
      stopId: 'stop-1',
      status: 'COMPLETED',
    });
    expect(res.name).toBe('advanceRouteStop');
    expect(res.data).toEqual({
      routeId: 'route-1',
      stopId: 'stop-1',
      status: 'COMPLETED',
    });
  });

  test('fetchDriverRoutes returns route objects array', async () => {
    const routes = await fetchDriverRoutes('driver-1');
    expect(Array.isArray(routes)).toBe(true);
  });
});
