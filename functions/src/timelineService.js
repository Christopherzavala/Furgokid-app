/**
 * Trip Timeline Backend Service
 *
 * Automatically records immutable timeline milestones for passenger transport
 * (boarding, arrival at school, return boarding, home drop-off).
 */

const admin = require('firebase-admin');

const VALID_DOCUMENT_ID = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 1500 &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/');

const ALLOWED_ACTIONS = new Set([
  'BOARDED_MORNING',
  'ARRIVED_SCHOOL',
  'BOARDED_AFTERNOON',
  'DELIVERED_HOME',
  'CO_GUARDIAN_VERIFIED',
]);

exports.recordTimelineEvent = async ({ firestore, matchId, passengerId, action, actorUid }) => {
  if (!firestore || typeof firestore.collection !== 'function') {
    throw new TypeError('A valid Firestore instance is required.');
  }
  if (
    !VALID_DOCUMENT_ID(matchId) ||
    !VALID_DOCUMENT_ID(passengerId) ||
    !ALLOWED_ACTIONS.has(action) ||
    !VALID_DOCUMENT_ID(actorUid)
  ) {
    throw new Error('Invalid arguments provided for timeline event recording.');
  }

  const matchRef = firestore.collection('matches').doc(matchId);
  const matchSnap = await matchRef.get();
  if (!matchSnap.exists) {
    throw new Error('Match record not found.');
  }

  const match = matchSnap.data();
  if (match.driverId !== actorUid && match.parentId !== actorUid) {
    throw new Error('Actor lacks permission to record timeline events for this match.');
  }

  const eventId = `evt_tl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const eventRef = matchRef.collection('timelineEvents').doc(eventId);
  const now = admin.firestore.Timestamp.now();

  await eventRef.set({
    eventId,
    matchId,
    passengerId,
    action,
    actorId: actorUid,
    timestamp: now,
  });

  return { eventId, timestamp: now.toDate().toISOString() };
};
