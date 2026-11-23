'use strict';

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'test' });
}

const {
  DEFAULT_ALERT_PREFERENCES,
  resolveAlertPreferences,
  shouldSendAlertForEvent,
  buildActionablePushPayload,
  updateAlertPreferencesCallable,
} = require('../src/alertPreferences');

const makeFirestore = (initial = {}) => {
  const documents = new Map(Object.entries(initial));

  const makeRef = (path) => ({
    path,
    id: path.split('/').pop(),
    async get() {
      const data = documents.get(path);
      return {
        exists: data !== undefined,
        data: () => (data ? { ...data } : null),
        get: (field) => data?.[field],
      };
    },
    async set(data, options) {
      const existing = documents.get(path);
      documents.set(path, options?.merge && existing ? { ...existing, ...data } : data);
    },
  });

  return {
    _documents: documents,
    collection(name) {
      return {
        doc(id) {
          return makeRef(`${name}/${id}`);
        },
      };
    },
    async runTransaction(callback) {
      const transaction = {
        async get(ref) {
          const path = ref.path || ref;
          const data = documents.get(path);
          return {
            exists: data !== undefined,
            data: () => (data ? { ...data } : null),
          };
        },
        set(ref, data, options) {
          const path = ref.path || ref;
          const existing = documents.get(path);
          documents.set(path, options?.merge && existing ? { ...existing, ...data } : data);
        },
        update(ref, data) {
          const path = ref.path || ref;
          const existing = documents.get(path);
          documents.set(path, { ...existing, ...data });
        },
      };
      return callback(transaction);
    },
  };
};

const setupFirestoreSpy = (mockDb) => {
  const spy = jest.spyOn(admin, 'firestore').mockReturnValue(mockDb);
  spy.FieldValue = {
    serverTimestamp: () => 'server-timestamp',
  };
  return spy;
};

describe('alertPreferences Unit Tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('DEFAULT_ALERT_PREFERENCES is frozen and has correct defaults', () => {
    expect(DEFAULT_ALERT_PREFERENCES.boardingAlert).toBe(true);
    expect(DEFAULT_ALERT_PREFERENCES.etaProximityAlert).toBe(true);
    expect(DEFAULT_ALERT_PREFERENCES.handoverAlert).toBe(true);
    expect(DEFAULT_ALERT_PREFERENCES.absenceAlert).toBe(true);
  });

  test('resolveAlertPreferences handles falsy or non-object rawPrefs', () => {
    expect(resolveAlertPreferences(null)).toEqual(DEFAULT_ALERT_PREFERENCES);
    expect(resolveAlertPreferences('invalid')).toEqual(DEFAULT_ALERT_PREFERENCES);
    expect(resolveAlertPreferences({ boardingAlert: false })).toEqual({
      ...DEFAULT_ALERT_PREFERENCES,
      boardingAlert: false,
    });
  });

  test('shouldSendAlertForEvent evaluates event types correctly', () => {
    const prefs = {
      boardingAlert: false,
      etaProximityAlert: true,
      handoverAlert: false,
      absenceAlert: true,
    };

    expect(shouldSendAlertForEvent(prefs, 'BOARDING')).toBe(false);
    expect(shouldSendAlertForEvent(prefs, 'IN_TRANSIT')).toBe(false);
    expect(shouldSendAlertForEvent(prefs, 'ETA')).toBe(true);
    expect(shouldSendAlertForEvent(prefs, 'PROXIMITY')).toBe(true);
    expect(shouldSendAlertForEvent(prefs, 'HANDOVER')).toBe(false);
    expect(shouldSendAlertForEvent(prefs, 'ARRIVAL')).toBe(false);
    expect(shouldSendAlertForEvent(prefs, 'ABSENCE')).toBe(true);
    expect(shouldSendAlertForEvent(prefs, 'UNKNOWN_EVENT')).toBe(true);
    expect(shouldSendAlertForEvent(null, 'BOARDING')).toBe(true);
  });

  test('buildActionablePushPayload builds payloads for different event types', () => {
    const absencePayload = buildActionablePushPayload({
      eventType: 'ABSENCE',
      title: 'Ausencia',
      body: 'Estudiante ausente',
      matchId: 'm-1',
      passengerId: 'p-1',
      shareToken: 'token-1',
    });
    expect(absencePayload.data.action).toBe('REPORT_ABSENCE');
    expect(absencePayload.data.matchId).toBe('m-1');

    const defaultPayload = buildActionablePushPayload({
      eventType: 'BOARDING',
    });
    expect(defaultPayload.data.action).toBe('OPEN_TRACKING');
    expect(defaultPayload.title).toBe('FurgoKid Notificación');
  });

  describe('updateAlertPreferencesCallable', () => {
    test('1. Throws unauthenticated if auth is missing', async () => {
      const mockDb = makeFirestore({});
      await expect(updateAlertPreferencesCallable({}, mockDb)).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    test('2. Successfully updates user alert preferences in Firestore', async () => {
      const mockDb = makeFirestore({
        'users/user-1': { role: 'parent' },
      });
      setupFirestoreSpy(mockDb);

      const request = {
        auth: { uid: 'user-1' },
        data: { preferences: { boardingAlert: false } },
      };

      const res = await updateAlertPreferencesCallable(request, mockDb);
      expect(res.success).toBe(true);
      expect(res.preferences.boardingAlert).toBe(false);

      const savedUser = mockDb._documents.get('users/user-1');
      expect(savedUser.alertPreferences.boardingAlert).toBe(false);
    });
  });
});
