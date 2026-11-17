import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { auth } from '../config/firebase';
import {
  authorizeTrackingSession,
  cleanupMatchTracking,
  clearTrackingMatchId,
  getTrackingMatchId,
  isAuthorizationError,
  publishCurrentLocation,
  setTrackingMatchId,
  shouldPublishLocation,
} from './matchTrackingService';

export const LOCATION_TASK_NAME = 'furgokid-background-location';

let lastPublishedPoint = null;
let lastPublishedAt = 0;
let operationChain = Promise.resolve();

const runExclusive = (operation) => {
  const result = operationChain.then(operation, operation);
  operationChain = result.catch(() => {});
  return result;
};

// 1. Definición de la Tarea en Background
if (!TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.warn('Background location task reported an error.');
      return;
    }

    const loc = data?.locations?.[0];
    if (!loc) return;

    let matchId = null;
    try {
      matchId = await getTrackingMatchId();
      if (!matchId || !auth.currentUser) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});
        await clearTrackingMatchId();
        return;
      }

      const now = Date.now();
      if (!shouldPublishLocation(lastPublishedPoint, loc.coords, now, lastPublishedAt)) {
        return;
      }

      await publishCurrentLocation(matchId, loc.coords);
      lastPublishedPoint = loc.coords;
      lastPublishedAt = now;
    } catch (error) {
      // A failed publication is not acknowledged as a successful update. The
      // next useful location is allowed to retry transient network failures.
      if (isAuthorizationError(error)) {
        await cleanupMatchTracking(matchId).catch(() => {});
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});
        await clearTrackingMatchId();
      }
      console.warn('Background location update failed.');
    }
  });
}

// 2. Función para Iniciar GPS
export const startBackgroundLocation = (matchId) =>
  runExclusive(async () => {
    try {
      if (!auth.currentUser) {
        throw new Error('Authentication is required to start tracking.');
      }

      await authorizeTrackingSession(matchId);

      const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
      if (hasStarted) {
        const activeMatchId = await getTrackingMatchId();
        if (activeMatchId !== matchId) {
          throw new Error('Another match is already being tracked.');
        }
        return true;
      }
      const initialLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await publishCurrentLocation(matchId, initialLocation.coords);
      await setTrackingMatchId(matchId);
      lastPublishedPoint = initialLocation.coords;
      lastPublishedAt = Date.now();

      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
        distanceInterval: 10,
        foregroundService: {
          notificationTitle: 'FurgoKid rastreando',
          notificationBody: 'Tu ubicación es visible para los padres',
          notificationColor: '#FF6B35',
        },
        pausesUpdatesAutomatically: false,
      });

      return true;
    } catch (error) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});
      await cleanupMatchTracking(matchId).catch(() => {});
      await clearTrackingMatchId();
      throw error;
    }
  });

// 3. Función para Detener GPS
export const stopBackgroundLocation = () =>
  runExclusive(async () => {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
    lastPublishedPoint = null;
    lastPublishedAt = 0;
    return true;
  });
