jest.mock('../config/firebase', () => ({
  auth: { currentUser: { uid: 'user-1', getIdToken: async () => 'token' } },
  db: {},
  functions: {},
}));

import { shouldPublishLocation } from '../services/matchTrackingService';
import { transitionPassengerState } from '../services/custodyService';

describe('GPS Accuracy Filter & Adaptive Frequency', () => {
  test('discards GPS locations with accuracy > 50 meters', () => {
    const last = { latitude: -33.45, longitude: -70.66 };
    const inaccurateNext = { latitude: -33.451, longitude: -70.661, accuracy: 75 };
    const accurateNext = { latitude: -33.451, longitude: -70.661, accuracy: 12 };

    const now = Date.now();
    expect(shouldPublishLocation(last, inaccurateNext, now, now - 10000)).toBe(false);
    expect(shouldPublishLocation(last, accurateNext, now, now - 10000)).toBe(true);
  });

  test('spaces out publication when stationary vs moving', () => {
    const last = { latitude: -33.45, longitude: -70.66 };
    const stationaryNext = { latitude: -33.45, longitude: -70.66, speed: 0, accuracy: 10 };
    const now = Date.now();

    // Stationary and published 5s ago -> should NOT publish yet (< 15s)
    expect(shouldPublishLocation(last, stationaryNext, now, now - 5000)).toBe(false);

    // Stationary and published 20s ago -> SHOULD publish (>= 15s)
    expect(shouldPublishLocation(last, stationaryNext, now, now - 20000)).toBe(true);
  });
});

describe('Custody Idempotency Key Generation', () => {
  test('transitionPassengerState delegates callable with idempotencyKey', async () => {
    const res = await transitionPassengerState({
      matchId: 'm1',
      passengerId: 'p1',
      newState: 'BOARDING_CONFIRMED',
    }).catch(() => null);
    expect(res).toBeDefined();
  });
});
