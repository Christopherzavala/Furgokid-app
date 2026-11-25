// locationService.js - GPS Background Tracking Service with expo-task-manager
import * as Location from 'expo-location';
import analyticsService from './analyticsService';
import toastService from './toastService';

import {
  LOCATION_TASK_NAME,
  startBackgroundLocation,
  stopBackgroundLocation,
} from './backgroundLocation';
import {
  authorizeTrackingSession,
  cleanupMatchTracking,
  clearTrackingMatchId,
  getTrackingMatchId,
  hasRecentSuccessfulPublication,
  isAuthorizationError,
  publishCurrentLocation,
  setTrackingMatchId,
} from './matchTrackingService';

/**
 * Solicita permisos de ubicación foreground y background
 */
export const requestLocationPermissions = async () => {
  const startedAt = Date.now();
  try {
    // Primero permisos de foreground
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

    if (foregroundStatus !== 'granted') {
      console.log('Foreground permission denied');
      analyticsService.trackPerformance('location_permissions_ms', Date.now() - startedAt, {
        ok: false,
      });
      analyticsService.trackAppError('location_permission_denied', {
        tag: 'location_service',
        action: 'foreground_permission_denied',
        fatal: false,
      });
      return { foreground: false, background: false };
    }

    // Luego permisos de background (solo si foreground fue otorgado)
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();

    analyticsService.trackPerformance('location_permissions_ms', Date.now() - startedAt, {
      ok: true,
    });

    return {
      foreground: true,
      background: backgroundStatus === 'granted',
    };
  } catch (error) {
    console.error('Error requesting permissions:', error);
    analyticsService.trackPerformance('location_permissions_ms', Date.now() - startedAt, {
      ok: false,
    });
    analyticsService.trackAppError('location_permissions_error', {
      name: error?.name,
      stack: error?.stack,
      tag: 'location_service',
      action: 'request_permissions',
      fatal: false,
    });
    return { foreground: false, background: false };
  }
};

/**
 * Iniciar tracking de ubicación en background
 */
export const startBackgroundLocationTracking = async (matchId) => {
  const startedAt = Date.now();
  try {
    const permissions = await requestLocationPermissions();
    if (!permissions.foreground) {
      throw new Error('Location permission is required.');
    }

    if (!permissions.background) {
      console.warn('Background permission not granted. Starting foreground tracking only.');
      toastService.warning(
        'Permiso en segundo plano limitado',
        'El rastreo puede pausarse con la pantalla apagada. Se recomienda activar ubicación "Permitir todo el tiempo".'
      );
      const ok = await startForegroundLocationTracking(matchId);
      analyticsService.trackPerformance('location_start_bg_ms', Date.now() - startedAt, {
        ok: !!ok,
      });
      return ok;
    }
    const started = await startBackgroundLocation(matchId);
    if (!started) throw new Error('Background tracking could not be started.');
    console.log('Background location tracking started');
    analyticsService.trackPerformance('location_start_bg_ms', Date.now() - startedAt, {
      ok: true,
    });
    return true;
  } catch (error) {
    console.error('Error starting background tracking:', error);
    analyticsService.trackPerformance('location_start_bg_ms', Date.now() - startedAt, {
      ok: false,
    });
    analyticsService.trackAppError('location_start_bg_error', {
      name: error?.name,
      stack: error?.stack,
      tag: 'location_service',
      action: 'start_background',
      fatal: false,
    });
    throw error;
  }
};

/**
 * Iniciar tracking de ubicación en foreground (fallback)
 */
let foregroundSubscription = null;
let foregroundMatchId = null;

export const startForegroundLocationTracking = async (matchId) => {
  const startedAt = Date.now();
  try {
    const permissions = await requestLocationPermissions();

    if (!permissions.foreground) {
      console.error('Foreground permission denied');
      analyticsService.trackPerformance('location_start_fg_ms', Date.now() - startedAt, {
        ok: false,
      });
      return false;
    }

    if (foregroundSubscription) {
      if (foregroundMatchId !== matchId) {
        throw new Error('Another match is already being tracked.');
      }
      await authorizeTrackingSession(matchId);
      console.log('Foreground tracking already active, skipping duplicate');
      analyticsService.trackPerformance('location_start_fg_ms', Date.now() - startedAt, {
        ok: true,
      });
      return true;
    }

    await authorizeTrackingSession(matchId);
    const initialLocation = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    await publishCurrentLocation(matchId, initialLocation.coords);
    await setTrackingMatchId(matchId);
    foregroundMatchId = matchId;

    foregroundSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 30000,
        distanceInterval: 50,
      },
      async (location) => {
        try {
          // Ignore late callbacks from a subscription that failed to stop.
          if (foregroundMatchId !== matchId) return;
          await publishCurrentLocation(matchId, location.coords);
        } catch (error) {
          if (isAuthorizationError(error)) {
            if (foregroundSubscription) foregroundSubscription.remove();
            foregroundSubscription = null;
            foregroundMatchId = null;
            await cleanupMatchTracking(matchId).catch(() => {});
            await clearTrackingMatchId();
          }
          console.warn('Foreground location update failed.');
        }
      }
    );

    console.log('Foreground location tracking started');
    analyticsService.trackPerformance('location_start_fg_ms', Date.now() - startedAt, {
      ok: true,
    });
    return true;
  } catch (error) {
    console.error('Error starting foreground tracking:', error);
    analyticsService.trackPerformance('location_start_fg_ms', Date.now() - startedAt, {
      ok: false,
    });
    analyticsService.trackAppError('location_start_fg_error', {
      name: error?.name,
      stack: error?.stack,
      tag: 'location_service',
      action: 'start_foreground',
      fatal: false,
    });
    if (foregroundSubscription) {
      foregroundSubscription.remove();
      foregroundSubscription = null;
    }
    foregroundMatchId = null;
    await cleanupMatchTracking(matchId).catch(() => {});
    await clearTrackingMatchId();
    throw error;
  }
};

/**
 * Detener tracking de ubicación
 */
export const stopLocationTracking = async (matchId) => {
  const startedAt = Date.now();
  let sensorStopFailed = false;

  try {
    // The match id may be omitted by context cleanup, so fall back to the
    // locally persisted active scope before asking the backend to clean it.
    const effectiveMatchId = matchId || (await getTrackingMatchId());

    try {
      await stopBackgroundLocation();
    } catch (error) {
      sensorStopFailed = true;
      console.error('Error stopping background sensor:', error);
    }

    if (foregroundSubscription) {
      try {
        foregroundSubscription.remove();
        console.log('Foreground tracking stopped');
      } catch (error) {
        sensorStopFailed = true;
        console.error('Error stopping foreground sensor:', error);
      } finally {
        // Clear the active scope first so a late callback cannot republish.
        foregroundMatchId = null;
        foregroundSubscription = null;
      }
    }

    // Backend cleanup is attempted even when a local sensor fails to stop.
    // The operation is successful only when the trusted backend confirms it.
    if (effectiveMatchId) {
      await cleanupMatchTracking(effectiveMatchId);
      await clearTrackingMatchId();
    }

    if (sensorStopFailed) {
      throw new Error('The location sensor could not be stopped cleanly.');
    }
    return true;
  } catch (error) {
    console.error('Error stopping tracking:', error);
    analyticsService.trackAppError('location_stop_error', {
      name: error?.name,
      stack: error?.stack,
      tag: 'location_service',
      action: 'stop_tracking',
      fatal: false,
    });
    return false;
  } finally {
    analyticsService.trackPerformance('location_stop_ms', Date.now() - startedAt, {
      ok: false,
    });
  }
};

/**
 * Obtener ubicación actual
 */
export const getCurrentLocation = async () => {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return location.coords;
  } catch (error) {
    console.error('Error getting current location:', error);
    return null;
  }
};

/**
 * Calcular distancia entre dos coordenadas (Haversine)
 */
export const calculateDistance = (coord1, coord2) => {
  const R = 6371; // Radio de la Tierra en km
  const dLat = toRadians(coord2.latitude - coord1.latitude);
  const dLon = toRadians(coord2.longitude - coord1.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1.latitude)) *
      Math.cos(toRadians(coord2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distancia en km
};

const toRadians = (degrees) => {
  return degrees * (Math.PI / 180);
};

/**
 * Verificar si el tracking está activo
 */
export const isTrackingActive = async () => {
  try {
    const backgroundActive = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    const foregroundActive = foregroundSubscription !== null;
    const trackingMatchId = await getTrackingMatchId();

    return {
      background: backgroundActive,
      foreground: foregroundActive,
      any:
        (backgroundActive || foregroundActive) &&
        Boolean(trackingMatchId) &&
        hasRecentSuccessfulPublication(),
      matchId: trackingMatchId,
    };
  } catch (error) {
    console.error('Error checking tracking status:', error);
    return { background: false, foreground: false, any: false, matchId: null };
  }
};

export const stopForegroundLocationTracking = async () => {
  const subscription = foregroundSubscription;
  foregroundMatchId = null;
  foregroundSubscription = null;
  if (subscription) subscription.remove();
};
