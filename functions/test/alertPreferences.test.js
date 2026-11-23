'use strict';

const {
  resolveAlertPreferences,
  shouldSendAlertForEvent,
  buildActionablePushPayload,
  updateAlertPreferencesCallable,
} = require('../src/alertPreferences');

describe('Alert Preferences & Enriched Push Unit Tests', () => {
  test('resolveAlertPreferences normalizes raw preferences correctly', () => {
    const res = resolveAlertPreferences({ boardingAlert: false });
    expect(res.boardingAlert).toBe(false);
    expect(res.etaProximityAlert).toBe(true);
    expect(res.handoverAlert).toBe(true);
    expect(res.absenceAlert).toBe(true);
  });

  test('shouldSendAlertForEvent filters according to event type', () => {
    const prefs = { boardingAlert: false, absenceAlert: true };
    expect(shouldSendAlertForEvent(prefs, 'BOARDING')).toBe(false);
    expect(shouldSendAlertForEvent(prefs, 'ABSENCE')).toBe(true);
  });

  test('buildActionablePushPayload creates correct structured payload', () => {
    const payload = buildActionablePushPayload({
      eventType: 'ABSENCE',
      title: 'Ausencia',
      body: 'Estudiante ausente',
      matchId: 'match-1',
    });
    expect(payload.data.type).toBe('ABSENCE');
    expect(payload.data.action).toBe('REPORT_ABSENCE');
    expect(payload.title).toBe('Ausencia');
  });

  test('updateAlertPreferencesCallable requires authentication', async () => {
    await expect(updateAlertPreferencesCallable({}, {})).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });
});
