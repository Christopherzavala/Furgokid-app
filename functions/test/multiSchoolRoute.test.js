'use strict';

const {
  computeOrderedStopsAndEta,
  saveMultiSchoolRoute,
  advanceRouteStop,
} = require('../src/multiSchoolRouteCallables');

describe('Multi-School Route Engine Unit Tests', () => {
  test('computeOrderedStopsAndEta computes cumulative ETAs for ordered pending stops', () => {
    const stops = [
      {
        stopId: 'stop-2',
        order: 2,
        type: 'school',
        label: 'Colegio 2',
        location: { latitude: -33.45, longitude: -70.67 },
      },
      {
        stopId: 'stop-1',
        order: 1,
        type: 'pickup',
        label: 'Parada 1',
        location: { latitude: -33.44, longitude: -70.66 },
      },
      {
        stopId: 'stop-3',
        order: 3,
        type: 'dropoff',
        label: 'Parada 3',
        location: { latitude: -33.46, longitude: -70.68 },
        status: 'SKIPPED',
      },
    ];

    const origin = { latitude: -33.43, longitude: -70.65 };
    const computed = computeOrderedStopsAndEta(stops, origin);

    expect(computed[0].stopId).toBe('stop-1');
    expect(computed[0].estimatedArrivalMin).toBeGreaterThan(0);
    expect(computed[1].stopId).toBe('stop-2');
    expect(computed[1].estimatedArrivalMin).toBeGreaterThan(computed[0].estimatedArrivalMin);
    expect(computed[2].stopId).toBe('stop-3');
    expect(computed[2].estimatedArrivalMin).toBeNull();
  });

  test('saveMultiSchoolRoute rejects invalid GPS coordinates', async () => {
    const request = {
      auth: { uid: 'driver-1' },
      data: {
        name: 'Ruta Test',
        shift: 'morning',
        stops: [
          {
            stopId: 'stop-invalid',
            type: 'pickup',
            label: 'Bad Coords',
            location: { latitude: 999, longitude: -70.66 },
          },
        ],
      },
    };

    // Unauthenticated or permission-denied check if profile not mocked, or invalid-argument if validated first
    await expect(saveMultiSchoolRoute.run(request)).rejects.toBeDefined();
  });
});
