const mockHttpsCallable = jest.fn();

jest.mock('firebase/functions', () => ({
  httpsCallable: (functions, name) => {
    mockHttpsCallable.mockImplementation(async (data) => ({
      data: { success: true, schoolId: 'school_123', name, data },
    }));
    return mockHttpsCallable;
  },
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  getDocs: jest.fn().mockResolvedValue({ docs: [] }),
}));

jest.mock('../../config/firebase', () => ({
  auth: { currentUser: { uid: 'user-1' } },
  db: {},
  functions: {},
}));

import {
  authorizeSchoolDriver,
  fetchDriverFleet,
  fetchSchoolArrivalsSnapshot,
  registerSchoolB2b,
  upsertDriverFleetAsset,
  verifyDriverFleetAsset,
} from '../schoolB2bService';

describe('schoolB2bService unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('registerSchoolB2b calls registerSchoolB2b callable', async () => {
    const res = await registerSchoolB2b({
      name: 'Colegio San Pedro',
      rbd: '12345',
      commune: 'Santiago',
      address: 'Av. Principal 123',
    });
    expect(res.name).toBe('registerSchoolB2b');
    expect(res.data.rbd).toBe('12345');
  });

  test('authorizeSchoolDriver calls authorizeSchoolDriver callable', async () => {
    const res = await authorizeSchoolDriver({
      schoolId: 'school_12345',
      driverId: 'driver-1',
      action: 'authorize',
    });
    expect(res.name).toBe('authorizeSchoolDriver');
    expect(res.data).toEqual({
      schoolId: 'school_12345',
      driverId: 'driver-1',
      action: 'authorize',
    });
  });

  test('fetchSchoolArrivalsSnapshot calls getSchoolArrivalsSnapshot callable', async () => {
    const res = await fetchSchoolArrivalsSnapshot({ schoolId: 'school_12345' });
    expect(res.name).toBe('getSchoolArrivalsSnapshot');
  });

  test('upsertDriverFleetAsset calls upsertDriverFleetAsset callable', async () => {
    const res = await upsertDriverFleetAsset({
      assetType: 'vehicle',
      payload: { plate: 'ABCD12', brand: 'Toyota', model: 'HiAce' },
    });
    expect(res.name).toBe('upsertDriverFleetAsset');
  });

  test('verifyDriverFleetAsset calls verifyDriverFleetAsset callable', async () => {
    const res = await verifyDriverFleetAsset({
      driverId: 'driver-1',
      assetType: 'vehicle',
      assetId: 'veh_ABCD12',
      decision: 'approve',
    });
    expect(res.name).toBe('verifyDriverFleetAsset');
  });

  test('fetchDriverFleet returns vehicles and assistants arrays', async () => {
    const res = await fetchDriverFleet('driver-1');
    expect(res.vehicles).toBeDefined();
    expect(res.assistants).toBeDefined();
  });
});
