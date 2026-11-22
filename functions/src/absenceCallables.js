/**
 * Smart Absence Callables
 *
 * Allows verified parents to report student absences before morning cutoff time,
 * notifying drivers, updating custody states, and dynamically skipping route stops.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { Timestamp } = require('firebase-admin/firestore');
const { transitionPassengerStateInternal } = require('./custodyChain');
const { computeOrderedStopsAndEta } = require('./multiSchoolRouteCallables');

const VALID_DOCUMENT_ID = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 1500 &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/');

exports.reportAbsenceCallable = onCall(async (request) => {
  const parentUid = request?.auth?.uid;
  if (!parentUid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }

  const { matchId, passengerId, date } = request?.data || {};
  if (
    !VALID_DOCUMENT_ID(matchId) ||
    !VALID_DOCUMENT_ID(passengerId) ||
    typeof date !== 'string' ||
    !date.trim()
  ) {
    throw new HttpsError(
      'invalid-argument',
      'Valid matchId, passengerId, and date (YYYY-MM-DD) are required.'
    );
  }

  const db = admin.firestore();
  const matchRef = db.collection('matches').doc(matchId);
  const matchSnap = await matchRef.get();

  if (!matchSnap.exists) {
    throw new HttpsError('not-found', 'Match record not found.');
  }
  const match = matchSnap.data();

  if (match.parentId !== parentUid) {
    throw new HttpsError(
      'permission-denied',
      'Only the authorized parent can report absences for this match.'
    );
  }

  // Check passenger state machine to prevent reporting absence after boarding (using root collection)
  const stateSnap = await db.collection('passengerStates').doc(`${matchId}_${passengerId}`).get();
  if (stateSnap.exists) {
    const currentState = stateSnap.data().state;
    if (
      ['BOARDING_CONFIRMED', 'IN_TRANSIT', 'ARRIVAL_CONFIRMED', 'HANDOVER_CONFIRMED'].includes(
        currentState
      )
    ) {
      throw new HttpsError(
        'failed-precondition',
        'Cannot register absence because the student has already boarded or started transit.'
      );
    }
  }

  // Synchronize state to ABSENT
  await transitionPassengerStateInternal({
    db,
    matchId,
    passengerId,
    newState: 'ABSENT',
    actorUid: parentUid,
    actorRole: 'parent',
  });

  const absenceId = `abs_${matchId}_${passengerId}_${date.trim()}`;
  const absenceRef = matchRef.collection('absences').doc(absenceId);

  const now = Timestamp.now();
  await absenceRef.set(
    {
      absenceId,
      matchId,
      passengerId,
      parentId: parentUid,
      date: date.trim(),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  // Automatically skip pending route stops for this passenger in active driver routes
  if (match.driverId) {
    try {
      const routesSnap = await db
        .collection('routes')
        .where('driverId', '==', match.driverId)
        .where('status', '==', 'ACTIVE')
        .get();

      for (const routeDoc of routesSnap.docs) {
        const routeData = routeDoc.data();
        let modified = false;
        const updatedStops = (routeData.stops || []).map((stop) => {
          if (
            (stop.passengerId === passengerId || stop.matchId === matchId) &&
            stop.status === 'PENDING'
          ) {
            modified = true;
            return {
              ...stop,
              status: 'SKIPPED',
              skipReason: 'ABSENT',
              updatedAt: new Date().toISOString(),
            };
          }
          return stop;
        });

        if (modified) {
          const recomputedStops = computeOrderedStopsAndEta(updatedStops);
          await routeDoc.ref.update({
            stops: recomputedStops,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
    } catch (routeErr) {
      console.warn('Failed to auto-skip route stop on student absence:', routeErr?.message);
    }
  }

  // Notify driver via FCM if push token exists
  const driverId = match.driverId;
  if (driverId) {
    const driverDoc = await db.collection('users').doc(driverId).get();
    const pushToken = driverDoc.exists ? driverDoc.data()?.fcmToken : null;
    if (pushToken && typeof pushToken === 'string') {
      try {
        await admin.messaging().send({
          token: pushToken,
          notification: {
            title: '⚠️ Aviso de ausencia escolar',
            body: `El pasajero no viajará el día ${date.trim()}. Parada omitida.`,
          },
          data: { matchId, passengerId, type: 'STUDENT_ABSENCE' },
        });
      } catch (error) {
        console.warn('Failed to send absence notification to driver:', error?.message);
      }
    }
  }

  return {
    success: true,
    absenceId,
    date: date.trim(),
  };
});
