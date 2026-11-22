const mockHttpsCallable = jest.fn();

jest.mock('firebase/functions', () => ({
  httpsCallable: (functions, name) => {
    mockHttpsCallable.mockImplementation(async (data) => ({
      data: { success: true, snapshot: { activeEmergencies: [] }, name, data },
    }));
    return mockHttpsCallable;
  },
}));

jest.mock('../../config/firebase', () => ({
  auth: { currentUser: { uid: 'admin-1' } },
  functions: {},
}));

import {
  fetchOpsDashboardSnapshot,
  resolveEmergencyIncident,
  reviewDriverApplication,
} from '../adminOpsService';

describe('adminOpsService unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('fetchOpsDashboardSnapshot calls getOpsDashboardSnapshot callable', async () => {
    const res = await fetchOpsDashboardSnapshot();
    expect(res.name).toBe('getOpsDashboardSnapshot');
  });

  test('reviewDriverApplication calls reviewDriverRequest callable', async () => {
    const res = await reviewDriverApplication({
      driverId: 'driver-1',
      decision: 'approve',
      reason: 'Verified',
    });
    expect(res.name).toBe('reviewDriverRequest');
    expect(res.data).toEqual({
      targetUid: 'driver-1',
      decision: 'approve',
      reason: 'Verified',
    });
  });

  test('resolveEmergencyIncident calls resolveSosAlert callable', async () => {
    const res = await resolveEmergencyIncident({
      incidentId: 'inc-1',
      resolutionNotes: 'Resolved by ops',
    });
    expect(res.name).toBe('resolveSosAlert');
    expect(res.data).toEqual({
      incidentId: 'inc-1',
      resolutionNotes: 'Resolved by ops',
    });
  });
});
