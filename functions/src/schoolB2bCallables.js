/**
 * School B2B Portal & Arrival Management Callables (Ola 3 - #1)
 *
 * Allows school administrators to register educational establishments,
 * authorize verified transport drivers, and inspect real-time arrival snapshots.
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

async function assertSchoolAdminOrOps(uid, schoolId, db) {
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }

  const userDoc = await db.collection('users').doc(uid).get();
  const userData = userDoc.exists ? userDoc.data() : {};
  const isGlobalAdminOrOps = ['admin', 'ops'].includes(userData.role);

  if (isGlobalAdminOrOps) return true;

  if (!schoolId) {
    throw new HttpsError('invalid-argument', 'schoolId is required.');
  }

  const schoolDoc = await db.collection('schools').doc(schoolId).get();
  if (!schoolDoc.exists) {
    throw new HttpsError('not-found', 'School record not found.');
  }

  const adminUids = schoolDoc.data()?.adminUids || [];
  const isSchoolAdmin =
    adminUids.includes(uid) ||
    userData.schoolId === schoolId ||
    userData.schoolRole === 'school_admin' ||
    userData.role === 'school_admin';

  if (!isSchoolAdmin) {
    throw new HttpsError(
      'permission-denied',
      'Only authorized school administrators can perform this operation.'
    );
  }

  return true;
}

exports.registerSchoolB2b = onCall(getCallableSecurityOptions(), async (request) => {
  const uid = request?.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }

  const db = admin.firestore();
  await enforceRateLimit(db, {
    uid,
    action: 'registerSchoolB2b',
    maxRequests: 5,
    windowMs: 10 * 60 * 1000,
  });

  const { name, rbd, commune, address, gateLocation, schedules } = request?.data || {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new HttpsError('invalid-argument', 'Valid school name is required.');
  }
  if (!rbd || typeof rbd !== 'string' || !rbd.trim()) {
    throw new HttpsError('invalid-argument', 'Valid RBD identifier is required.');
  }
  if (!commune || typeof commune !== 'string' || !commune.trim()) {
    throw new HttpsError('invalid-argument', 'Valid commune is required.');
  }
  if (!address || typeof address !== 'string' || !address.trim()) {
    throw new HttpsError('invalid-argument', 'Valid address is required.');
  }

  const schoolId = `school_${rbd
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')}`;
  const schoolRef = db.collection('schools').doc(schoolId);
  const serverNow = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (transaction) => {
    const schoolSnap = await transaction.get(schoolRef);
    let adminUids = [uid];
    if (schoolSnap.exists) {
      const existingAdmins = schoolSnap.data()?.adminUids || [];
      if (!existingAdmins.includes(uid)) {
        adminUids = [...existingAdmins, uid];
      } else {
        adminUids = existingAdmins;
      }
    }

    transaction.set(
      schoolRef,
      {
        schoolId,
        name: name.trim(),
        rbd: rbd.trim(),
        commune: commune.trim(),
        address: address.trim(),
        gateLocation: gateLocation || null,
        schedules: schedules || null,
        adminUids,
        authorizedDriverIds: schoolSnap.exists ? schoolSnap.data()?.authorizedDriverIds || [] : [],
        status: 'ACTIVE',
        createdAt: schoolSnap.exists ? schoolSnap.data()?.createdAt : serverNow,
        updatedAt: serverNow,
      },
      { merge: true }
    );

    const userRef = db.collection('users').doc(uid);
    const userSnap = await transaction.get(userRef);
    const userRole = userSnap.exists ? userSnap.data()?.role : null;
    const isGlobalAdminOrOps = ['admin', 'ops'].includes(userRole);

    transaction.set(
      userRef,
      {
        schoolId,
        schoolRole: 'school_admin',
        ...(isGlobalAdminOrOps ? {} : { role: 'school_admin' }),
        updatedAt: serverNow,
      },
      { merge: true }
    );
  });

  return {
    success: true,
    schoolId,
    name: name.trim(),
    role: 'school_admin',
  };
});

exports.authorizeSchoolDriver = onCall(getCallableSecurityOptions(), async (request) => {
  const uid = request?.auth?.uid;
  const { schoolId, driverId, action } = request?.data || {};

  if (!VALID_DOCUMENT_ID(schoolId) || !VALID_DOCUMENT_ID(driverId)) {
    throw new HttpsError('invalid-argument', 'Valid schoolId and driverId are required.');
  }
  if (action !== 'authorize' && action !== 'revoke') {
    throw new HttpsError('invalid-argument', 'Action must be "authorize" or "revoke".');
  }

  const db = admin.firestore();
  await assertSchoolAdminOrOps(uid, schoolId, db);
  await enforceRateLimit(db, {
    uid,
    action: 'authorizeSchoolDriver',
    maxRequests: 10,
    windowMs: 10 * 60 * 1000,
  });

  const schoolRef = db.collection('schools').doc(schoolId);
  const serverNow = admin.firestore.FieldValue.serverTimestamp();

  if (action === 'authorize') {
    const driverDoc = await db.collection('users').doc(driverId).get();
    if (!driverDoc.exists) {
      throw new HttpsError('not-found', 'Driver user record not found.');
    }
    const driverData = driverDoc.data();
    if (driverData.role !== 'driver' || driverData.approved !== true) {
      throw new HttpsError(
        'failed-precondition',
        'Driver must be approved by system administrators before school authorization.'
      );
    }

    await schoolRef.update({
      authorizedDriverIds: admin.firestore.FieldValue.arrayUnion(driverId),
      updatedAt: serverNow,
    });
  } else {
    await schoolRef.update({
      authorizedDriverIds: admin.firestore.FieldValue.arrayRemove(driverId),
      updatedAt: serverNow,
    });
  }

  return {
    success: true,
    schoolId,
    driverId,
    action,
  };
});

exports.getSchoolArrivalsSnapshot = onCall(getCallableSecurityOptions(), async (request) => {
  const uid = request?.auth?.uid;
  const { schoolId } = request?.data || {};

  if (!VALID_DOCUMENT_ID(schoolId)) {
    throw new HttpsError('invalid-argument', 'Valid schoolId is required.');
  }

  const db = admin.firestore();
  await assertSchoolAdminOrOps(uid, schoolId, db);

  const schoolDoc = await db.collection('schools').doc(schoolId).get();
  if (!schoolDoc.exists) {
    throw new HttpsError('not-found', 'School record not found.');
  }
  const schoolData = schoolDoc.data();

  // Query active matches related to this school
  const matchesSnap = await db
    .collection('matches')
    .where('status', '==', 'active')
    .limit(50)
    .get();

  const matchingDocs = matchesSnap.docs.filter((d) => {
    const m = d.data();
    return (
      m.schoolId === schoolId ||
      (typeof m.school === 'string' &&
        m.school.toLowerCase().trim() === schoolData.name.toLowerCase().trim())
    );
  });

  const matchIds = matchingDocs.map((d) => d.id);
  const passengerStateDocs = [];

  for (const mId of matchIds) {
    const statesSnap = await db.collection('passengerStates').where('matchId', '==', mId).get();
    statesSnap.forEach((s) => passengerStateDocs.push({ id: s.id, ...s.data() }));
  }

  const counts = {
    EXPECTED: 0,
    BOARDING_CONFIRMED: 0,
    IN_TRANSIT: 0,
    ARRIVAL_CONFIRMED: 0,
    HANDOVER_CONFIRMED: 0,
    ABSENT: 0,
  };

  passengerStateDocs.forEach((st) => {
    if (counts[st.state] !== undefined) {
      counts[st.state] += 1;
    }
  });

  return {
    schoolId,
    schoolName: schoolData.name,
    authorizedDriverIds: schoolData.authorizedDriverIds || [],
    activeMatchesCount: matchIds.length,
    counts,
    retrievedAt: new Date().toISOString(),
  };
});

exports.assertSchoolAdminOrOps = assertSchoolAdminOrOps;
