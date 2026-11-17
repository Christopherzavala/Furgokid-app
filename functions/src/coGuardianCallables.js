/**
 * Co-Guardian Trust Circle & QR Verification Callables
 *
 * Allows verified parents to register ephemeral co-guardians and allows
 * approved drivers to securely verify co-guardian pickup via QR code hash.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const crypto = require('crypto');

const VALID_DOCUMENT_ID = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 1500 &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/');

exports.verifyCoGuardianQrCallable = onCall(async (request) => {
  const driverUid = request?.auth?.uid;
  if (!driverUid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }

  const { matchId, qrToken } = request?.data || {};
  if (!VALID_DOCUMENT_ID(matchId) || typeof qrToken !== 'string' || !qrToken.trim()) {
    throw new HttpsError('invalid-argument', 'Valid matchId and qrToken are required.');
  }

  const db = admin.firestore();
  const matchRef = db.collection('matches').doc(matchId);
  const matchSnap = await matchRef.get();

  if (!matchSnap.exists) {
    throw new HttpsError('not-found', 'Match record not found.');
  }
  const match = matchSnap.data();

  if (match.driverId !== driverUid) {
    throw new HttpsError(
      'permission-denied',
      'Authenticated driver is not assigned to this match.'
    );
  }

  const qrTokenHash = crypto.createHash('sha256').update(qrToken.trim()).digest('hex');
  const now = admin.firestore.Timestamp.now();

  const coGuardiansQuery = await matchRef
    .collection('coGuardians')
    .where('qrTokenHash', '==', qrTokenHash)
    .where('expiresAt', '>', now)
    .limit(1)
    .get();

  if (coGuardiansQuery.empty) {
    throw new HttpsError('not-found', 'Invalid or expired pickup QR code.');
  }

  const coGuardianDoc = coGuardiansQuery.docs[0];
  const coGuardianData = coGuardianDoc.data();

  // Register immutable audit event
  await db.collection('authorizationEvents').add({
    matchId,
    actorId: driverUid,
    action: 'CO_GUARDIAN_PICKUP_VERIFIED',
    coGuardianId: coGuardianDoc.id,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    verified: true,
    coGuardianName: typeof coGuardianData.name === 'string' ? coGuardianData.name : 'Co-Guardián',
  };
});
