/**
 * Emergency & SOS Incident Management Callables
 *
 * Allows matched drivers and parents to trigger instant SOS alerts,
 * registering incidents, notifying counterparts/admins, and resolving alerts.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { enforceRateLimit, getCallableSecurityOptions } = require('./securityGuard');

const VALID_DOCUMENT_ID = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 1500 &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/');

exports.triggerSosAlert = onCall(getCallableSecurityOptions(), async (request) => {
  const uid = request?.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }

  const db = admin.firestore();
  await enforceRateLimit(db, {
    uid,
    action: 'triggerSosAlert',
    maxRequests: 3,
    windowMs: 15 * 60 * 1000,
  });

  const { matchId, location, reason } = request?.data || {};
  if (!VALID_DOCUMENT_ID(matchId)) {
    throw new HttpsError('invalid-argument', 'Valid matchId is required.');
  }

  const matchRef = db.collection('matches').doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) {
    throw new HttpsError('not-found', 'Match record not found.');
  }
  const match = matchSnap.data();

  const isDriver = match.driverId === uid;
  const isParent = match.parentId === uid;
  if (!isDriver && !isParent) {
    throw new HttpsError('permission-denied', 'Only match participants can trigger SOS alerts.');
  }

  const role = isDriver ? 'driver' : 'parent';
  const incidentId = db.collection('emergencyIncidents').doc().id;
  const serverNow = admin.firestore.FieldValue.serverTimestamp();

  const incidentData = {
    incidentId,
    matchId,
    triggeredBy: uid,
    role,
    location: location || null,
    reason: typeof reason === 'string' ? reason.trim() : 'Emergencia en ruta',
    status: 'ACTIVE',
    createdAt: serverNow,
    updatedAt: serverNow,
  };

  await db.runTransaction(async (transaction) => {
    transaction.set(db.collection('emergencyIncidents').doc(incidentId), incidentData);
    transaction.update(matchRef, {
      emergencyActive: true,
      activeIncidentId: incidentId,
      updatedAt: serverNow,
    });
  });

  // Notify counterpart and admins via FCM if tokens exist
  const recipients = new Set();
  if (isDriver && match.parentId) recipients.add(match.parentId);
  if (isParent && match.driverId) recipients.add(match.driverId);

  // Add admins / ops
  try {
    const adminSnap = await db.collection('users').where('role', 'in', ['admin', 'ops']).get();
    adminSnap.forEach((docSnap) => recipients.add(docSnap.id));
  } catch (err) {
    console.warn('Failed to query admin/ops users for SOS notification:', err?.message);
  }

  for (const recipientId of recipients) {
    try {
      const userDoc = await db.collection('users').doc(recipientId).get();
      const token = userDoc.exists ? userDoc.data()?.fcmToken || userDoc.data()?.pushToken : null;
      if (token && typeof token === 'string') {
        await admin.messaging().send({
          token,
          notification: {
            title: '🚨 ¡ALERTA SOS ACTIVADA!',
            body: `Se ha reportado una emergencia en el viaje (${
              role === 'driver' ? 'Conductor' : 'Apoderado'
            }).`,
          },
          data: { matchId, incidentId, type: 'SOS_EMERGENCY' },
        });
      }
    } catch (pushErr) {
      console.warn(`Failed to send SOS push notification to ${recipientId}:`, pushErr?.message);
    }
  }

  return {
    success: true,
    incidentId,
    status: 'ACTIVE',
  };
});

exports.resolveSosAlert = onCall(getCallableSecurityOptions(), async (request) => {
  const uid = request?.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }

  const { incidentId, resolutionNotes } = request?.data || {};
  if (!VALID_DOCUMENT_ID(incidentId)) {
    throw new HttpsError('invalid-argument', 'Valid incidentId is required.');
  }

  const db = admin.firestore();
  const incidentRef = db.collection('emergencyIncidents').doc(incidentId);
  const incidentSnap = await incidentRef.get();
  if (!incidentSnap.exists) {
    throw new HttpsError('not-found', 'Incident record not found.');
  }
  const incident = incidentSnap.data();

  const matchRef = db.collection('matches').doc(incident.matchId);
  const matchSnap = await matchRef.get();
  const match = matchSnap.exists ? matchSnap.data() : {};

  const userDoc = await db.collection('users').doc(uid).get();
  const userRole = userDoc.exists ? userDoc.data()?.role : null;
  const isAdminOrOps = ['admin', 'ops'].includes(userRole);
  const isParticipant = match.driverId === uid || match.parentId === uid;

  if (!isAdminOrOps && !isParticipant) {
    throw new HttpsError('permission-denied', 'Not authorized to resolve this emergency.');
  }

  const serverNow = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (transaction) => {
    transaction.update(incidentRef, {
      status: 'RESOLVED',
      resolvedAt: serverNow,
      resolvedBy: uid,
      resolutionNotes: typeof resolutionNotes === 'string' ? resolutionNotes.trim() : '',
      updatedAt: serverNow,
    });
    transaction.update(matchRef, {
      emergencyActive: false,
      activeIncidentId: null,
      updatedAt: serverNow,
    });
  });

  return {
    success: true,
    incidentId,
    status: 'RESOLVED',
  };
});
