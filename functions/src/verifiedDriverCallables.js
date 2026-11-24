/**
 * Verified Multi-Driver & Rental Fleet Management (Zero Unverified Driver)
 *
 * Allows fleet owners to submit driver verification documents (Professional License,
 * Criminal Record, Child Inability Registry) and assign verified drivers (owner,
 * rental, substitute) to vehicles and active matches with atomic verification gating.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { enforceRateLimit, getCallableSecurityOptions } = require('./securityGuard');
const { sendExpoPush } = require('./externalNotifications');

const VALID_DOCUMENT_ID = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 1500 &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/');

const VALID_ASSIGNMENT_TYPES = new Set(['owner', 'rental', 'substitute']);

exports.submitDriverVerificationDocs = onCall(getCallableSecurityOptions(), async (request) => {
  const uid = request?.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }

  const { targetDriverUid, documents } = request?.data || {};
  const driverUid = VALID_DOCUMENT_ID(targetDriverUid) ? targetDriverUid : uid;

  const db = admin.firestore();
  await enforceRateLimit(db, {
    uid,
    action: 'submitDriverVerificationDocs',
    maxRequests: 10,
    windowMs: 10 * 60 * 1000,
  });

  // If submitting for another driver, caller must be admin, ops, or owner of fleet
  if (driverUid !== uid) {
    const callerDoc = await db.collection('users').doc(uid).get();
    const callerData = callerDoc.exists ? callerDoc.data() : {};
    const isAdminOrOps = ['admin', 'ops'].includes(callerData.role);
    if (!isAdminOrOps) {
      throw new HttpsError(
        'permission-denied',
        'Only administrators or fleet owners can submit verification docs for other drivers.'
      );
    }
  }

  if (!documents || typeof documents !== 'object') {
    throw new HttpsError('invalid-argument', 'Valid documents object is required.');
  }

  const { professionalLicense, criminalRecord, childInabilityRegistry } = documents;
  const serverNow = admin.firestore.FieldValue.serverTimestamp();

  const driverRef = db.collection('users').doc(driverUid);
  const driverSnap = await driverRef.get();
  if (!driverSnap.exists || driverSnap.data()?.role !== 'driver') {
    throw new HttpsError('not-found', 'Driver user record not found.');
  }

  const currentChecks = driverSnap.data()?.verifiedChecks || {};

  const updatedChecks = {
    professionalLicense: professionalLicense
      ? {
          status: 'pending_review',
          path: professionalLicense.path || null,
          submittedAt: serverNow,
        }
      : currentChecks.professionalLicense || null,
    criminalRecord: criminalRecord
      ? {
          status: 'pending_review',
          path: criminalRecord.path || null,
          submittedAt: serverNow,
        }
      : currentChecks.criminalRecord || null,
    childInabilityRegistry: childInabilityRegistry
      ? {
          status: 'pending_review',
          path: childInabilityRegistry.path || null,
          submittedAt: serverNow,
        }
      : currentChecks.childInabilityRegistry || null,
  };

  await driverRef.set(
    {
      verifiedChecks: updatedChecks,
      driverVerificationStatus: 'pending_review',
      updatedAt: serverNow,
    },
    { merge: true }
  );

  return {
    success: true,
    driverUid,
    verifiedChecks: updatedChecks,
    driverVerificationStatus: 'pending_review',
  };
});

exports.assignVerifiedVehicleDriver = onCall(getCallableSecurityOptions(), async (request) => {
  const callerUid = request?.auth?.uid;
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }

  const { vehicleId, matchId, driverUid, assignmentType, validUntil } = request?.data || {};

  if (
    !VALID_DOCUMENT_ID(vehicleId) ||
    !VALID_DOCUMENT_ID(matchId) ||
    !VALID_DOCUMENT_ID(driverUid)
  ) {
    throw new HttpsError(
      'invalid-argument',
      'Valid vehicleId, matchId, and driverUid are required.'
    );
  }
  if (!VALID_ASSIGNMENT_TYPES.has(assignmentType)) {
    throw new HttpsError(
      'invalid-argument',
      'Valid assignmentType (owner, rental, substitute) is required.'
    );
  }

  const db = admin.firestore();
  await enforceRateLimit(db, {
    uid: callerUid,
    action: 'assignVerifiedVehicleDriver',
    maxRequests: 15,
    windowMs: 10 * 60 * 1000,
  });

  // Verify caller is admin/ops or fleet owner of the vehicle
  const callerDoc = await db.collection('users').doc(callerUid).get();
  const callerData = callerDoc.exists ? callerDoc.data() : {};
  const isAdminOrOps = ['admin', 'ops'].includes(callerData.role);

  const vehicleRef = db
    .collection('driverFleets')
    .doc(callerUid)
    .collection('vehicles')
    .doc(vehicleId);
  const vehicleSnap = await vehicleRef.get();

  if (!isAdminOrOps && !vehicleSnap.exists) {
    throw new HttpsError(
      'permission-denied',
      'Only fleet owners or admins can assign vehicle drivers.'
    );
  }

  // Verify target driver existence and compliance
  const targetDriverRef = db.collection('users').doc(driverUid);
  const targetDriverSnap = await targetDriverRef.get();

  if (!targetDriverSnap.exists) {
    throw new HttpsError('not-found', 'Assigned driver user record not found.');
  }

  const driverData = targetDriverSnap.data();
  const isApprovedDriver =
    driverData.role === 'driver' &&
    (driverData.approved === true || driverData.driverApprovalStatus === 'approved');

  if (!isApprovedDriver) {
    throw new HttpsError(
      'failed-precondition',
      'Assigned driver is not approved by system administrators.'
    );
  }

  const checks = driverData.verifiedChecks || {};
  const isLicenseVerified = checks.professionalLicense?.status === 'verified';
  const isCriminalVerified = checks.criminalRecord?.status === 'verified';
  const isInabilityVerified = checks.childInabilityRegistry?.status === 'verified';

  if (!isLicenseVerified || !isCriminalVerified || !isInabilityVerified) {
    throw new HttpsError(
      'failed-precondition',
      'Driver lacks one or more mandatory verified checks (Professional License, Criminal Record, Child Inability Registry).'
    );
  }

  const matchRef = db.collection('matches').doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) {
    throw new HttpsError('not-found', 'Match record not found.');
  }
  const matchData = matchSnap.data();

  const serverNow = admin.firestore.FieldValue.serverTimestamp();
  const verifiedAtIso = new Date().toISOString();

  const activeDriverSnapshot = {
    driverUid,
    displayName: driverData.displayName || driverData.name || 'Conductor Verificado',
    photoURL: driverData.photoURL || driverData.photo || null,
    plate: vehicleSnap.exists ? vehicleSnap.data().plate : '',
    assignmentType,
    verifiedChecks: {
      professionalLicense: true,
      criminalRecord: true,
      childInabilityRegistry: true,
    },
    verifiedAt: verifiedAtIso,
    validUntil: validUntil || null,
  };

  await db.runTransaction(async (transaction) => {
    transaction.set(
      matchRef,
      {
        activeDriverId: driverUid,
        activeDriverSnapshot,
        updatedAt: serverNow,
      },
      { merge: true }
    );

    const logRef = db.collection('driverAssignmentLogs').doc();
    transaction.set(logRef, {
      logId: logRef.id,
      matchId,
      vehicleId,
      assignedBy: callerUid,
      driverUid,
      assignmentType,
      validUntil: validUntil || null,
      createdAt: serverNow,
    });
  });

  // Notify parent(s) if push token exists
  const parentId = matchData.parentId;
  if (parentId) {
    const parentDoc = await db.collection('users').doc(parentId).get();
    const parentPushToken = parentDoc.exists
      ? parentDoc.data()?.fcmToken || parentDoc.data()?.pushToken
      : null;
    if (parentPushToken && typeof parentPushToken === 'string') {
      try {
        await sendExpoPush({
          payload: {
            to: parentPushToken,
            sound: 'default',
            title: '🚗 Conductor Asignado para este Turno',
            body: `Tu furgón será conducido hoy por ${activeDriverSnapshot.displayName} (${
              assignmentType === 'rental'
                ? 'Arrendatario'
                : assignmentType === 'substitute'
                ? 'Reemplazo'
                : 'Titular'
            }). Credencial verificada.`,
            data: { matchId, driverUid, type: 'DRIVER_ASSIGNMENT' },
          },
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (pushErr) {
        console.warn('Failed to send driver assignment notification to parent:', pushErr?.message);
      }
    }
  }

  return {
    success: true,
    matchId,
    driverUid,
    assignmentType,
    activeDriverSnapshot,
  };
});
