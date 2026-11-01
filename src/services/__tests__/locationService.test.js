const mockStartBackgroundLocation = jest.fn();
const mockStopBackgroundLocation = jest.fn();
const mockCleanupMatchTracking = jest.fn();
const mockClearTrackingMatchId = jest.fn();
const mockAuthorizeTrackingSession = jest.fn();

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3, High: 4 },
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 1, longitude: 2 } })),
  hasStartedLocationUpdatesAsync: jest.fn(async () => false),
  requestBackgroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  startLocationUpdatesAsync: jest.fn(async () => undefined),
  stopLocationUpdatesAsync: jest.fn(async () => undefined),
  watchPositionAsync: jest.fn(async () => ({ remove: jest.fn() })),
}));

jest.mock('../backgroundLocation', () => ({
  LOCATION_TASK_NAME: 'furgokid-background-location',
  startBackgroundLocation: (...args) => mockStartBackgroundLocation(...args),
  stopBackgroundLocation: (...args) => mockStopBackgroundLocation(...args),
}));

jest.mock('../matchTrackingService', () => ({
  authorizeTrackingSession: (...args) => mockAuthorizeTrackingSession(...args),
  cleanupMatchTracking: (...args) => mockCleanupMatchTracking(...args),
  clearTrackingMatchId: (...args) => mockClearTrackingMatchId(...args),
  getTrackingMatchId: jest.fn(async () => 'match-1'),
  hasRecentSuccessfulPublication: jest.fn(() => true),
  isAuthorizationError: jest.fn(() => false),
  publishCurrentLocation: jest.fn(async () => undefined),
  setTrackingMatchId: jest.fn(async () => undefined),
}));

jest.mock('../analyticsService', () => ({
  __esModule: true,
  default: {
    trackAppError: jest.fn(),
    trackPerformance: jest.fn(),
  },
}));

const loadService = () => {
  jest.resetModules();
  return require('../locationService');
};

describe('location service stop contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStopBackgroundLocation.mockResolvedValue(true);
    mockCleanupMatchTracking.mockResolvedValue({ status: 'stopped' });
    mockClearTrackingMatchId.mockResolvedValue(undefined);
  });

  test('attempts backend cleanup even when the local sensor fails to stop', async () => {
    const service = loadService();
    mockStopBackgroundLocation.mockRejectedValueOnce(new Error('sensor unavailable'));

    await expect(service.stopLocationTracking('match-1')).resolves.toBe(false);
    expect(mockCleanupMatchTracking).toHaveBeenCalledWith('match-1');
    expect(mockClearTrackingMatchId).toHaveBeenCalled();
  });

  test('does not report success when backend cleanup fails', async () => {
    const service = loadService();
    mockCleanupMatchTracking.mockRejectedValueOnce(new Error('network unavailable'));

    await expect(service.stopLocationTracking('match-1')).resolves.toBe(false);
    expect(mockClearTrackingMatchId).not.toHaveBeenCalled();
  });

  test('reports success only after local stop and backend cleanup succeed', async () => {
    const service = loadService();

    await expect(service.stopLocationTracking('match-1')).resolves.toBe(true);
    expect(mockStopBackgroundLocation).toHaveBeenCalled();
    expect(mockCleanupMatchTracking).toHaveBeenCalledWith('match-1');
  });

  test('resolves the persisted match id when cleanup is called without one', async () => {
    const service = loadService();

    await expect(service.stopLocationTracking()).resolves.toBe(true);
    expect(mockCleanupMatchTracking).toHaveBeenCalledWith('match-1');
    expect(mockClearTrackingMatchId).toHaveBeenCalled();
  });
});
