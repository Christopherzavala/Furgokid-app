/**
 * Admin & Operations Dashboard Callables (Ola 2 - #14)
 *
 * Provides aggregated snapshot data for the operations console:
 * pending driver applications, active SOS emergency incidents, and custody audit events.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { getCallableSecurityOptions } = require('./securityGuard');

async function assertAdminOrOps(request, db) {
  const uid = request?.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }

  const roleClaim = request?.auth?.token?.role;
  if (roleClaim === 'admin' || roleClaim === 'ops') {
    return uid;
  }

  const userDoc = await db.collection('users').doc(uid).get();
  const userRole = userDoc.exists ? userDoc.data()?.role : null;

  if (userRole !== 'admin' && userRole !== 'ops') {
    throw new HttpsError(
      'permission-denied',
      'Only administrators and operations team members can access this console.'
    );
  }

  return uid;
}

exports.getOpsDashboardSnapshot = onCall(getCallableSecurityOptions(), async (request) => {
  const db = admin.firestore();
  await assertAdminOrOps(request, db);

  const [pendingDriversSnap, activeEmergenciesSnap, custodyEventsSnap] = await Promise.all([
    db.collection('users').where('driverRequestStatus', '==', 'pending').limit(25).get(),
    db.collection('emergencyIncidents').where('status', '==', 'ACTIVE').limit(25).get(),
    db.collection('custodyEvents').limit(20).get(),
  ]);

  const pendingDrivers = pendingDriversSnap.docs.map((docSnap) => ({
    uid: docSnap.id,
    ...docSnap.data(),
  }));

  const activeEmergencies = activeEmergenciesSnap.docs.map((docSnap) => ({
    incidentId: docSnap.id,
    ...docSnap.data(),
  }));

  const recentCustodyEvents = custodyEventsSnap.docs.map((docSnap) => ({
    eventId: docSnap.id,
    ...docSnap.data(),
  }));

  return {
    pendingDrivers,
    activeEmergencies,
    recentCustodyEvents,
    retrievedAt: new Date().toISOString(),
  };
});

exports.assertAdminOrOps = assertAdminOrOps;
