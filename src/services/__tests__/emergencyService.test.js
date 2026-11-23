const mockHttpsCallable = jest.fn();

jest.mock('firebase/functions', () => ({
  httpsCallable: (functions, name) => {
    mockHttpsCallable.mockImplementation(async (data) => ({
      data: { success: true, incidentId: 'inc-1', name, data },
    }));
    return mockHttpsCallable;
  },
}));

jest.mock('../../config/firebase', () => ({
  auth: { currentUser: { uid: 'user-1' } },
  functions: {},
}));

import { resolveSosAlert, triggerSosAlert } from '../emergencyService';

describe('emergencyService unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('triggerSosAlert calls triggerSosAlert callable', async () => {
    const res = await triggerSosAlert({
      matchId: 'match-1',
      location: { latitude: -33.4, longitude: -70.6 },
      reason: 'Test emergency',
    });
    expect(res.name).toBe('triggerSosAlert');
    expect(res.data).toEqual({
      matchId: 'match-1',
      location: { latitude: -33.4, longitude: -70.6 },
      reason: 'Test emergency',
    });
  });

  test('resolveSosAlert calls resolveSosAlert callable', async () => {
    const res = await resolveSosAlert({
      incidentId: 'inc-1',
      resolutionNotes: 'False alarm resolved',
    });
    expect(res.name).toBe('resolveSosAlert');
    expect(res.data).toEqual({
      incidentId: 'inc-1',
      resolutionNotes: 'False alarm resolved',
    });
  });
});
