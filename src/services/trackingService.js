// src/services/trackingService.js
import * as Location from 'expo-location';
import analyticsService from './analyticsService';
import {
  isTrackingActive as getLocationTrackingStatus,
  startBackgroundLocationTracking,
  stopLocationTracking,
} from './locationService';

/**
 * Starts GPS for an explicit active match. The legacy routeId concept is not
 * used as an authorization boundary.
 */
export async function startRouteTracking(matchId) {
  const startedAt = Date.now();
  try {
    const started = await startBackgroundLocationTracking(matchId);
    if (!started) throw new Error('Tracking could not be started.');
    analyticsService.trackPerformance('tracking_start_route_ms', Date.now() - startedAt, {
      ok: true,
    });
  } catch (error) {
    analyticsService.trackPerformance('tracking_start_route_ms', Date.now() - startedAt, {
      ok: false,
    });
    analyticsService.trackAppError('tracking_start_error', {
      name: error?.name,
      stack: error?.stack,
      tag: 'tracking_service',
      action: 'start_match_tracking',
      fatal: false,
    });
    throw error;
  }
}

/**
 * Stops GPS and asks the trusted backend to remove the current point.
 */
export async function stopRouteTracking(matchId) {
  const startedAt = Date.now();
  try {
    const stopped = await stopLocationTracking(matchId);
    if (!stopped) throw new Error('Tracking cleanup could not be confirmed.');
    analyticsService.trackPerformance('tracking_stop_route_ms', Date.now() - startedAt, {
      ok: true,
    });
  } catch (error) {
    analyticsService.trackPerformance('tracking_stop_route_ms', Date.now() - startedAt, {
      ok: false,
    });
    analyticsService.trackAppError('tracking_stop_error', {
      name: error?.name,
      stack: error?.stack,
      tag: 'tracking_service',
      action: 'stop_match_tracking',
      fatal: false,
    });
    throw error;
  }
}

export async function isTrackingActive() {
  const status = await getLocationTrackingStatus();
  return status.any;
}

/**
 * Gets a one-shot device location. It is never persisted by this service.
 */
export async function getCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Permiso de ubicación denegado');
  }

  return await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
}
