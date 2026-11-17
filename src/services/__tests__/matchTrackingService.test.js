const mockSetDoc = jest.fn();
const mockCallable = jest.fn();
const mockGetDocs = jest.fn(async () => ({ docs: [] }));
const mockQuery = jest.fn(() => ({}));
const mockWhere = jest.fn(() => ({}));
const mockAuth = { currentUser: null };
const mockStorage = {
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
};

jest.mock('@react-native-async-storage/async-storage', () => mockStorage);
jest.mock('../../config/firebase', () => ({
  auth: mockAuth,
  db: {},
  functions: {},
}));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({})),
  doc: jest.fn((_db, ...parts) => ({ path: parts.join('/') })),
  getDocs: (...args) => mockGetDocs(...args),
  query: (...args) => mockQuery(...args),
  serverTimestamp: jest.fn(() => 'server-timestamp'),
  setDoc: (...args) => mockSetDoc(...args),
  where: (...args) => mockWhere(...args),
}));
jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(() => mockCallable),
}));

const loadService = () => {
  jest.resetModules();
  return require('../matchTrackingService');
};

describe('match tracking client service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.currentUser = {
      uid: 'authenticated-driver',
      getIdToken: jest.fn(async () => 'id-token'),
    };
    mockSetDoc.mockResolvedValue(undefined);
    mockGetDocs.mockResolvedValue({ docs: [] });
    mockCallable.mockResolvedValue({ data: { matchId: 'match-1' } });
  });

  test('publishes only the canonical per-match current document', async () => {
    const service = loadService();

    await service.publishCurrentLocation('match-1', {
      latitude: -33.4489,
      longitude: -70.6693,
      speed: 4,
    });

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [reference, data] = mockSetDoc.mock.calls[0];
    expect(reference.path).toBe('matches/match-1/tracking/current');
    expect(data).toEqual({
      latitude: -33.4489,
      longitude: -70.6693,
      speed: 4,
      active: true,
      updatedAt: 'server-timestamp',
    });
    expect(data).not.toHaveProperty('driverId');
    expect(data).not.toHaveProperty('matchId');
    expect(data).not.toHaveProperty('userId');
  });

  test('does not count a network failure as a successful publication', async () => {
    const service = loadService();
    mockSetDoc.mockRejectedValueOnce({ code: 'unavailable' });

    await expect(
      service.publishCurrentLocation('match-1', { latitude: 1, longitude: 2 })
    ).rejects.toMatchObject({ code: 'unavailable' });
    expect(service.hasRecentSuccessfulPublication()).toBe(false);
  });

  test('requires authentication before publishing', async () => {
    const service = loadService();
    mockAuth.currentUser = null;

    await expect(
      service.publishCurrentLocation('match-1', { latitude: 1, longitude: 2 })
    ).rejects.toMatchObject({ code: 'unauthenticated' });
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  test('rejects invalid coordinates and invalid match IDs', async () => {
    const service = loadService();

    await expect(
      service.publishCurrentLocation('match-1', { latitude: 91, longitude: 2 })
    ).rejects.toThrow('Invalid location coordinates');
    await expect(
      service.publishCurrentLocation('../match', { latitude: 1, longitude: 2 })
    ).rejects.toThrow('valid matchId');
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  test('requests backend authorization with only the match ID', async () => {
    const service = loadService();

    await expect(service.authorizeTrackingSession('match-1')).resolves.toBe('match-1');
    expect(mockCallable).toHaveBeenCalledWith({ matchId: 'match-1' });
  });

  test('requests backend cleanup with only the match ID', async () => {
    const service = loadService();
    mockCallable.mockResolvedValueOnce({ data: { status: 'stopped' } });

    await expect(service.cleanupMatchTracking('match-1')).resolves.toEqual({ status: 'stopped' });
    expect(mockCallable).toHaveBeenCalledWith({ matchId: 'match-1' });
  });

  test('logout cleanup accepts no client identity fields', async () => {
    const service = loadService();
    mockCallable.mockResolvedValueOnce({ data: { status: 'cleaned' } });

    await expect(service.cleanupDriverTracking()).resolves.toEqual({ status: 'cleaned' });
    expect(mockCallable).toHaveBeenCalledWith({});
    expect(mockStorage.removeItem).toHaveBeenCalledWith('@furgokid/active_tracking_match_id');
  });

  test('lists parent matches only through the authenticated parent scope', async () => {
    const service = loadService();
    mockGetDocs.mockResolvedValueOnce({
      docs: [{ id: 'match-1', data: () => ({ parentId: 'authenticated-driver' }) }],
    });

    await expect(service.getActiveParentMatches()).resolves.toEqual([
      { id: 'match-1', parentId: 'authenticated-driver' },
    ]);
    expect(mockWhere).toHaveBeenCalledWith('parentId', '==', 'authenticated-driver');
    expect(mockWhere).toHaveBeenCalledWith('status', '==', 'active');
  });

  test('recognizes Firestore, callable and expired-session authorization failures', () => {
    const service = loadService();

    expect(service.isAuthorizationError({ code: 'permission-denied' })).toBe(true);
    expect(service.isAuthorizationError({ code: 'functions/permission-denied' })).toBe(true);
    expect(service.isAuthorizationError({ code: 'auth/user-token-expired' })).toBe(true);
    expect(service.isAuthorizationError({ code: 'unavailable' })).toBe(false);
  });

  test('suppresses insignificant movement but allows a heartbeat update', () => {
    const service = loadService();
    const point = { latitude: 0, longitude: 0 };

    expect(service.shouldPublishLocation(point, { latitude: 0, longitude: 0 }, 1000, 1000)).toBe(
      false
    );
    expect(
      service.shouldPublishLocation(point, { latitude: 0.001, longitude: 0 }, 1000, 1000)
    ).toBe(true);
    expect(service.shouldPublishLocation(point, { latitude: 0, longitude: 0 }, 40000, 1000)).toBe(
      true
    );
  });
});
