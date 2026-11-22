const mockHttpsCallable = jest.fn();

jest.mock('firebase/functions', () => ({
  httpsCallable: (functions, name) => {
    mockHttpsCallable.mockImplementation(async (data) => ({
      data: { success: true, preferences: data.preferences, name },
    }));
    return mockHttpsCallable;
  },
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn().mockResolvedValue({
    exists: () => true,
    data: () => ({
      alertPreferences: {
        boardingAlert: false,
        etaProximityAlert: true,
        handoverAlert: true,
        absenceAlert: true,
      },
    }),
  }),
}));

jest.mock('../../config/firebase', () => ({
  auth: { currentUser: { uid: 'user-1' } },
  db: {},
  functions: {},
}));

import {
  DEFAULT_ALERT_PREFERENCES,
  fetchAlertPreferences,
  resolveAlertPreferences,
  saveAlertPreferences,
} from '../alertPreferencesService';

describe('alertPreferencesService unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('resolveAlertPreferences handles invalid values gracefully', () => {
    expect(resolveAlertPreferences(null)).toEqual(DEFAULT_ALERT_PREFERENCES);
    expect(resolveAlertPreferences({ handoverAlert: false }).handoverAlert).toBe(false);
  });

  test('fetchAlertPreferences retrieves and resolves preferences from firestore', async () => {
    const prefs = await fetchAlertPreferences('user-1');
    expect(prefs.boardingAlert).toBe(false);
    expect(prefs.etaProximityAlert).toBe(true);
  });

  test('saveAlertPreferences calls updateAlertPreferences callable', async () => {
    const res = await saveAlertPreferences({ boardingAlert: false });
    expect(res.boardingAlert).toBe(false);
  });
});
