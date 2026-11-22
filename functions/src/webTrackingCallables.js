/**
 * Shared Web Tracking & WhatsApp Shortcut Callables (Ola 4 - #7 & #8)
 *
 * Allows authorized parents and drivers to generate temporary, secure, PII-free
 * live tracking share tokens viewable on the web and shareable via WhatsApp (wa.me).
 */

const crypto = require('node:crypto');
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

async function buildSharedTrackingSnapshot(db, shareToken) {
  if (!VALID_DOCUMENT_ID(shareToken)) {
    throw new HttpsError('invalid-argument', 'Valid shareToken is required.');
  }

  const shareRef = db.collection('trackingShares').doc(shareToken);
  const shareSnap = await shareRef.get();

  if (!shareSnap.exists) {
    throw new HttpsError('not-found', 'Share link not found or invalid.');
  }

  const shareData = shareSnap.data();

  if (shareData.revoked === true) {
    throw new HttpsError('permission-denied', 'This tracking link has been revoked by the owner.');
  }

  const nowMs = Date.now();
  const expiresAtMs = shareData.expiresAt?.toMillis
    ? shareData.expiresAt.toMillis()
    : Number(shareData.expiresAt) || 0;

  if (expiresAtMs > 0 && expiresAtMs <= nowMs) {
    throw new HttpsError('failed-precondition', 'This tracking link has expired.');
  }

  const matchId = shareData.matchId;
  const matchSnap = await db.collection('matches').doc(matchId).get();
  if (!matchSnap.exists) {
    throw new HttpsError('not-found', 'Match information is no longer available.');
  }
  const match = matchSnap.data();

  // Fetch current tracking location
  const trackingSnap = await db
    .collection('matches')
    .doc(matchId)
    .collection('tracking')
    .doc('current')
    .get();

  const trackingData = trackingSnap.exists ? trackingSnap.data() : null;

  // Fetch passenger states for this match without PII
  const passengerStatesSnap = await db
    .collection('passengerStates')
    .where('matchId', '==', matchId)
    .get();

  const passengers = passengerStatesSnap.docs.map((d, index) => {
    const data = d.data();
    return {
      aliasOrId: `Pasajero ${index + 1}`,
      state: data.state || 'EXPECTED',
      updatedAt: data.updatedAt || null,
    };
  });

  return {
    valid: true,
    shareToken,
    matchId,
    expiresAt: expiresAtMs,
    match: {
      status: match.status || 'active',
      school: match.school || match.zone || 'Transporte Escolar',
      zone: match.zone || '',
      shift: match.schedule || 'Escolar',
    },
    tracking: trackingData
      ? {
          active: Boolean(trackingData.active),
          latitude: trackingData.latitude,
          longitude: trackingData.longitude,
          speed: trackingData.speed || 0,
          updatedAt: trackingData.updatedAt || null,
        }
      : { active: false },
    passengers,
  };
}

exports.createTrackingShareLink = onCall(getCallableSecurityOptions(), async (request) => {
  const uid = request?.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }

  const { matchId, expiresInHours = 24, label } = request?.data || {};

  if (!VALID_DOCUMENT_ID(matchId)) {
    throw new HttpsError('invalid-argument', 'Valid matchId is required.');
  }

  const db = admin.firestore();
  await enforceRateLimit(db, {
    uid,
    action: 'createTrackingShareLink',
    maxRequests: 10,
    windowMs: 10 * 60 * 1000,
  });

  const matchSnap = await db.collection('matches').doc(matchId).get();
  if (!matchSnap.exists) {
    throw new HttpsError('not-found', 'Match record not found.');
  }
  const match = matchSnap.data();

  const userDoc = await db.collection('users').doc(uid).get();
  const userRole = userDoc.exists ? userDoc.data()?.role : null;
  const isParticipant = match.driverId === uid || match.parentId === uid;
  const isAdminOrOps = ['admin', 'ops'].includes(userRole);

  if (!isParticipant && !isAdminOrOps) {
    throw new HttpsError(
      'permission-denied',
      'Only match participants or admins can share tracking links.'
    );
  }

  const hours = Math.max(1, Math.min(168, Number(expiresInHours) || 24));
  const shareToken = crypto.randomBytes(8).toString('hex');
  const nowMs = Date.now();
  const expiresAtMs = nowMs + hours * 3600 * 1000;
  const expiresAtTimestamp = admin.firestore.Timestamp.fromMillis(expiresAtMs);
  const serverNow = admin.firestore.FieldValue.serverTimestamp();

  const shareData = {
    shareToken,
    matchId,
    ownerUid: uid,
    driverId: match.driverId || null,
    parentId: match.parentId || null,
    label: typeof label === 'string' ? label.trim() : '',
    expiresAt: expiresAtTimestamp,
    revoked: false,
    createdAt: serverNow,
    updatedAt: serverNow,
  };

  await db.collection('trackingShares').doc(shareToken).set(shareData);

  const baseUrl = process.env.PUBLIC_WEB_URL || 'https://furgokid-staging.web.app';
  const shareUrl = `${baseUrl}/tracking.html?token=${shareToken}`;

  return {
    success: true,
    shareToken,
    shareUrl,
    expiresAt: expiresAtMs,
    matchId,
  };
});

exports.revokeTrackingShareLink = onCall(getCallableSecurityOptions(), async (request) => {
  const uid = request?.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }

  const { shareToken } = request?.data || {};
  if (!VALID_DOCUMENT_ID(shareToken)) {
    throw new HttpsError('invalid-argument', 'Valid shareToken is required.');
  }

  const db = admin.firestore();
  const shareRef = db.collection('trackingShares').doc(shareToken);
  const shareSnap = await shareRef.get();

  if (!shareSnap.exists) {
    throw new HttpsError('not-found', 'Share link not found.');
  }
  const shareData = shareSnap.data();

  const userDoc = await db.collection('users').doc(uid).get();
  const userRole = userDoc.exists ? userDoc.data()?.role : null;
  const isOwner = shareData.ownerUid === uid;
  const isAdminOrOps = ['admin', 'ops'].includes(userRole);

  if (!isOwner && !isAdminOrOps) {
    throw new HttpsError(
      'permission-denied',
      'Only the link owner or admin can revoke this share link.'
    );
  }

  const serverNow = admin.firestore.FieldValue.serverTimestamp();
  await shareRef.update({
    revoked: true,
    updatedAt: serverNow,
  });

  return {
    success: true,
    shareToken,
    revoked: true,
  };
});

exports.getSharedTrackingSnapshot = onCall(getCallableSecurityOptions(), async (request) => {
  const { shareToken } = request?.data || {};
  const db = admin.firestore();
  return buildSharedTrackingSnapshot(db, shareToken);
});

exports.buildSharedTrackingSnapshot = buildSharedTrackingSnapshot;
