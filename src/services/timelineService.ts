/**
 * Trip Timeline Client Service
 *
 * Fetches immutable daily trip timeline events for parents to review milestones.
 */

import { collection, getDocsFromServer, query, orderBy } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface TimelineEvent {
  eventId: string;
  matchId: string;
  passengerId: string;
  action:
    | 'BOARDED_MORNING'
    | 'ARRIVED_SCHOOL'
    | 'BOARDED_AFTERNOON'
    | 'DELIVERED_HOME'
    | 'CO_GUARDIAN_VERIFIED';
  actorId: string;
  timestamp: string;
}

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const getTripTimeline = async (matchId: string): Promise<TimelineEvent[]> => {
  if (!matchId?.trim()) return [];

  try {
    const eventsRef = collection(db, 'matches', matchId, 'timelineEvents');
    const q = query(eventsRef, orderBy('timestamp', 'asc'));
    const snapshot = await getDocsFromServer(q);

    return snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        eventId: docSnap.id,
        matchId: typeof data.matchId === 'string' ? data.matchId : matchId,
        passengerId: typeof data.passengerId === 'string' ? data.passengerId : '',
        action: (typeof data.action === 'string' &&
        [
          'BOARDED_MORNING',
          'ARRIVED_SCHOOL',
          'BOARDED_AFTERNOON',
          'DELIVERED_HOME',
          'CO_GUARDIAN_VERIFIED',
        ].includes(data.action)
          ? data.action
          : 'BOARDED_MORNING') as TimelineEvent['action'],
        actorId: typeof data.actorId === 'string' ? data.actorId : '',
        timestamp:
          typeof data.timestamp?.toDate === 'function'
            ? data.timestamp.toDate().toISOString()
            : new Date().toISOString(),
      };
    });
  } catch (error) {
    console.warn(
      'Failed to fetch trip timeline events:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    return [];
  }
};
