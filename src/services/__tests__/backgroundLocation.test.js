const mockCleanupMatchTracking = jest.fn();
const mockClearTrackingMatchId = jest.fn();
const mockPublishCurrentLocation = jest.fn();
const mockStopLocationUpdatesAsync = jest.fn();

let mockCapturedTask = null;

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3, High: 4 },
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 1, longitude: 2 } })),
  hasStartedLocationUpdatesAsync: jest.fn(async () => false),
  startLocationUpdatesAsync: jest.fn(async () => undefined),
  stopLocationUpdatesAsync: (...args) => mockStopLocationUpdatesAsync(...args),
}));

jest.mock('expo-task-manager', () => ({
  isTaskDefined: jest.fn(() => false),
  defineTask: jest.fn((name, task) => {
    mockCapturedTask = task;
  }),
}));

jest.mock('../../config/firebase', () => ({
  auth: { currentUser: { uid: 'driver-1' } },
}));

jest.mock('../matchTrackingService', () => ({
  authorizeTrackingSession: jest.fn(async () => 'match-1'),
  cleanupMatchTracking: (...args) => mockCleanupMatchTracking(...args),
  clearTrackingMatchId: (...args) => mockClearTrackingMatchId(...args),
  getTrackingMatchId: jest.fn(async () => 'match-1'),
  isAuthorizationError: jest.fn(
    (error) => error?.code === 'functions/permission-denied' || error?.code === 'unauthenticated'
  ),
  publishCurrentLocation: (...args) => mockPublishCurrentLocation(...args),
  setTrackingMatchId: jest.fn(async () => undefined),
  shouldPublishLocation: jest.fn(() => true),
}));

const loadService = () => {
  jest.resetModules();
  mockCapturedTask = null;
  return require('../backgroundLocation');
};

describe('background location task', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStopLocationUpdatesAsync.mockResolvedValue(undefined);
    mockClearTrackingMatchId.mockResolvedValue(undefined);
    mockCleanupMatchTracking.mockResolvedValue({ status: 'stopped' });
  });

  test('cleans the tracked match when publication is rejected by authorization', async () => {
    loadService();
    mockPublishCurrentLocation.mockRejectedValueOnce(
      Object.assign(new Error('permission denied'), { code: 'functions/permission-denied' })
    );

    await mockCapturedTask({
      data: { locations: [{ coords: { latitude: 1, longitude: 2, speed: 3 } }] },
      error: null,
    });

    expect(mockCleanupMatchTracking).toHaveBeenCalledWith('match-1');
    expect(mockStopLocationUpdatesAsync).toHaveBeenCalled();
    expect(mockClearTrackingMatchId).toHaveBeenCalled();
  });

  test('keeps the scope when publication fails for a transient error', async () => {
    loadService();
    mockPublishCurrentLocation.mockRejectedValueOnce(new Error('network unavailable'));

    await mockCapturedTask({
      data: { locations: [{ coords: { latitude: 1, longitude: 2, speed: 3 } }] },
      error: null,
    });

    expect(mockCleanupMatchTracking).not.toHaveBeenCalled();
    expect(mockClearTrackingMatchId).not.toHaveBeenCalled();
  });
});
