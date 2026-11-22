/**
 * Alert Preferences & Enriched Push Payload Module (Ola 4 - #8)
 *
 * Defines default notification preferences, preference normalization helpers,
 * event filtering, and actionable push notification payload construction (cost $0).
 */

const { HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { enforceRateLimit } = require('./securityGuard');

const DEFAULT_ALERT_PREFERENCES = Object.freeze({
  boardingAlert: true,
  etaProximityAlert: true,
  handoverAlert: true,
  absenceAlert: true,
});

function resolveAlertPreferences(rawPrefs) {
  if (!rawPrefs || typeof rawPrefs !== 'object') {
    return { ...DEFAULT_ALERT_PREFERENCES };
  }
  return {
    boardingAlert: rawPrefs.boardingAlert !== false,
    etaProximityAlert: rawPrefs.etaProximityAlert !== false,
    handoverAlert: rawPrefs.handoverAlert !== false,
    absenceAlert: rawPrefs.absenceAlert !== false,
  };
}

function shouldSendAlertForEvent(prefs, eventType) {
  const resolved = resolveAlertPreferences(prefs);
  const type = (eventType || '').toUpperCase();

  if (type === 'BOARDING' || type === 'IN_TRANSIT') return resolved.boardingAlert;
  if (type === 'ETA' || type === 'PROXIMITY') return resolved.etaProximityAlert;
  if (type === 'HANDOVER' || type === 'ARRIVAL') return resolved.handoverAlert;
  if (type === 'ABSENCE') return resolved.absenceAlert;

  return true;
}

function buildActionablePushPayload({ eventType, title, body, matchId, passengerId, shareToken }) {
  const type = (eventType || 'GENERAL').toUpperCase();
  let screen = 'TrackingMap';
  let action = 'OPEN_TRACKING';

  if (type === 'ABSENCE') {
    action = 'REPORT_ABSENCE';
  }

  return {
    sound: 'default',
    title: title || 'FurgoKid Notificación',
    body: body || 'Actualización de tu transporte escolar',
    data: {
      type,
      screen,
      action,
      matchId: matchId || '',
      passengerId: passengerId || '',
      shareToken: shareToken || '',
      timestamp: Date.now().toString(),
    },
    priority: 'high',
    channelId: 'urgent',
  };
}

async function updateAlertPreferencesCallable(request, db) {
  const uid = request?.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }

  await enforceRateLimit(db, {
    uid,
    action: 'updateAlertPreferences',
    maxRequests: 10,
    windowMs: 10 * 60 * 1000,
  });

  const rawPrefs = request?.data?.preferences;
  const normalized = resolveAlertPreferences(rawPrefs);
  const serverNow = admin.firestore.FieldValue.serverTimestamp();

  await db.collection('users').doc(uid).set(
    {
      alertPreferences: normalized,
      updatedAt: serverNow,
    },
    { merge: true }
  );

  return {
    success: true,
    preferences: normalized,
  };
}

module.exports = {
  DEFAULT_ALERT_PREFERENCES,
  resolveAlertPreferences,
  shouldSendAlertForEvent,
  buildActionablePushPayload,
  updateAlertPreferencesCallable,
};
