/**
 * Geofencing ETA Push Notification Trigger
 *
 * Automatically calculates distance using Haversine formula when driver location updates,
 * triggering a Firebase Cloud Messaging (FCM) push notification if the vehicle
 * enters the proximity threshold (<= 500 meters) of the parent's home address.
 */

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

exports.onTrackingUpdate = onDocumentWritten(
  'matches/{matchId}/tracking/current',
  async (event) => {
    const snapshot = event.data?.after;
    if (!snapshot || !snapshot.exists) return;

    const tracking = snapshot.data();
    const matchId = event.params.matchId;
    const db = admin.firestore();

    const matchRef = db.collection('matches').doc(matchId);
    const matchSnap = await matchRef.get();
    if (!matchSnap.exists) return;
    const match = matchSnap.data();

    if (match.etaNotified === true) return;

    const destLat = match.destinationLat;
    const destLon = match.destinationLon;
    if (typeof destLat !== 'number' || typeof destLon !== 'number') return;

    const distance = calculateDistanceMeters(
      tracking.latitude,
      tracking.longitude,
      destLat,
      destLon
    );

    if (distance <= 500) {
      const parentId = match.parentId;
      if (!parentId) return;

      const userDoc = await db.collection('users').doc(parentId).get();
      const pushToken = userDoc.exists ? userDoc.data()?.fcmToken : null;

      if (pushToken && typeof pushToken === 'string') {
        try {
          await admin.messaging().send({
            token: pushToken,
            notification: {
              title: '🚐 ¡FurgoKid se acerca!',
              body: 'El transporte escolar está a menos de 500 metros de tu domicilio.',
            },
            data: { matchId, type: 'ETA_PROXIMITY' },
          });
          await matchRef.update({ etaNotified: true });
        } catch (error) {
          console.warn('Failed to send ETA proximity notification:', error?.message);
        }
      }
    }
  }
);
