import AsyncStorage from '@react-native-async-storage/async-storage';
import { httpsCallable } from 'firebase/functions';
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db, functions } from '../config/firebase';

const ACTIVE_TRACKING_MATCH_KEY = '@furgokid/active_tracking_match_id';
const MIN_PUBLISH_DISTANCE_METERS = 10;
const MAX_PUBLISH_INTERVAL_MS = 30000;
const RECENT_PUBLICATION_WINDOW_MS = 90000;

let lastSuccessfulPublicationAt = 0;

const isValidMatchId = (matchId) =>
  typeof matchId === 'string' &&
  matchId.length > 0 &&
  matchId.length <= 1500 &&
  matchId !== '.' &&
  matchId !== '..' &&
  !matchId.includes('/');

const isValidCoordinate = (value, minimum, maximum) =>
  typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;

const distanceMeters = (left, right) => {
  if (!left || !right) return Infinity;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(right.longitude - left.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(left.latitude)) *
      Math.cos(toRadians(right.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(haversine)));
};

export const shouldPublishLocation = (lastPoint, nextPoint, now, lastPublishedAt) => {
  if (!lastPoint || !lastPublishedAt) return true;
  const movedMeters = distanceMeters(lastPoint, nextPoint);
  return (
    movedMeters >= MIN_PUBLISH_DISTANCE_METERS || now - lastPublishedAt >= MAX_PUBLISH_INTERVAL_MS
  );
};

export const setTrackingMatchId = async (matchId) => {
  if (!isValidMatchId(matchId)) throw new Error('A valid matchId is required.');
  await AsyncStorage.setItem(ACTIVE_TRACKING_MATCH_KEY, matchId);
};

export const getTrackingMatchId = async () => {
  const matchId = await AsyncStorage.getItem(ACTIVE_TRACKING_MATCH_KEY);
  return isValidMatchId(matchId) ? matchId : null;
};

export const clearTrackingMatchId = async () => {
  await AsyncStorage.removeItem(ACTIVE_TRACKING_MATCH_KEY);
};

export const publishCurrentLocation = async (matchId, coordinates) => {
  if (!auth.currentUser) {
    const error = new Error('Authentication is required to publish location.');
    error.code = 'unauthenticated';
    throw error;
  }
  if (!isValidMatchId(matchId)) throw new Error('A valid matchId is required.');
  if (!auth.currentUser.getIdToken) {
    const error = new Error('Authentication is required to publish location.');
    error.code = 'unauthenticated';
    throw error;
  }
  if (
    !coordinates ||
    !isValidCoordinate(coordinates.latitude, -90, 90) ||
    !isValidCoordinate(coordinates.longitude, -180, 180)
  ) {
    throw new Error('Invalid location coordinates.');
  }

  const speed = Number.isFinite(coordinates.speed) ? Math.max(0, coordinates.speed) : 0;
  await auth.currentUser.getIdToken();
  await setDoc(doc(db, 'matches', matchId, 'tracking', 'current'), {
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    speed,
    active: true,
    updatedAt: serverTimestamp(),
  });
  lastSuccessfulPublicationAt = Date.now();
};

export const authorizeTrackingSession = async (matchId) => {
  if (!auth.currentUser) {
    const error = new Error('Authentication is required.');
    error.code = 'unauthenticated';
    throw error;
  }
  if (!isValidMatchId(matchId)) throw new Error('A valid matchId is required.');

  const startTracking = httpsCallable(functions, 'startTracking');
  const result = await startTracking({ matchId });
  return result.data?.matchId;
};

export const cleanupMatchTracking = async (matchId) => {
  if (!auth.currentUser) {
    const error = new Error('Authentication is required.');
    error.code = 'unauthenticated';
    throw error;
  }
  if (!isValidMatchId(matchId)) throw new Error('A valid matchId is required.');

  const stopTracking = httpsCallable(functions, 'stopTracking');
  const result = await stopTracking({ matchId });
  return result.data;
};

export const cleanupDriverTracking = async () => {
  if (!auth.currentUser) {
    const error = new Error('Authentication is required.');
    error.code = 'unauthenticated';
    throw error;
  }

  const cleanup = httpsCallable(functions, 'cleanupDriverTracking');
  const result = await cleanup({});
  await clearTrackingMatchId();
  return result.data;
};

export const getActiveDriverMatches = async () => {
  if (!auth.currentUser) return [];
  const matchesQuery = query(
    collection(db, 'matches'),
    where('driverId', '==', auth.currentUser.uid),
    where('status', '==', 'active')
  );
  const snapshot = await getDocs(matchesQuery);
  return snapshot.docs.map((match) => ({ id: match.id, ...match.data() }));
};

export const getActiveParentMatches = async () => {
  if (!auth.currentUser) return [];
  const matchesQuery = query(
    collection(db, 'matches'),
    where('parentId', '==', auth.currentUser.uid),
    where('status', '==', 'active')
  );
  const snapshot = await getDocs(matchesQuery);
  return snapshot.docs.map((match) => ({ id: match.id, ...match.data() }));
};

export const getTrackingState = async () => {
  const matchId = await getTrackingMatchId();
  return {
    matchId,
    authenticated: Boolean(auth.currentUser),
    lastSuccessfulPublicationAt,
    hasRecentSuccessfulPublication:
      Date.now() - lastSuccessfulPublicationAt <= RECENT_PUBLICATION_WINDOW_MS,
  };
};

export const hasRecentSuccessfulPublication = () =>
  Date.now() - lastSuccessfulPublicationAt <= RECENT_PUBLICATION_WINDOW_MS;

export const isAuthorizationError = (error) => {
  const code = typeof error?.code === 'string' ? error.code.toLowerCase() : '';
  return (
    code === 'permission-denied' ||
    code === 'unauthenticated' ||
    code === 'auth/user-token-expired' ||
    code === 'functions/permission-denied' ||
    code === 'functions/unauthenticated'
  );
};
