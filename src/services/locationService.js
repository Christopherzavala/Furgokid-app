// locationService.js - GPS Background Tracking Service with expo-task-manager
import * as Location from 'expo-location';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import analyticsService from './analyticsService';

import {
  LOCATION_TASK_NAME,
  startBackgroundLocation,
  stopBackgroundLocation,
} from './backgroundLocation';

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
export const startBackgroundLocationTracking = async () => {
  const startedAt = Date.now();
  try {
    const permissions = await requestLocationPermissions();

    if (!permissions.background) {
      console.warn('Background permission not granted. Starting foreground tracking only.');
      const ok = await startForegroundLocationTracking();
      analyticsService.trackPerformance('location_start_bg_ms', Date.now() - startedAt, {
        ok: !!ok,
      });
      return ok;
    }
    await startBackgroundLocation();
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
    return false;
  }
};

/**
 * Iniciar tracking de ubicación en foreground (fallback)
 */
let foregroundSubscription = null;

export const startForegroundLocationTracking = async () => {
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

    // ✅ Enhanced: Prevent duplicate subscriptions
    if (foregroundSubscription) {
      console.log('Foreground tracking already active, skipping duplicate');
      analyticsService.trackPerformance('location_start_fg_ms', Date.now() - startedAt, {
        ok: true,
      });
      return true;
    }

    foregroundSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 30000,
        distanceInterval: 50,
      },
      async (location) => {
        const user = auth.currentUser;
        if (user) {
          await saveLocationToFirebase(location.coords, user.uid, false);
          console.log('Foreground location saved:', location.coords);
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
    // ✅ Enhanced: Cleanup on error
    if (foregroundSubscription) {
      foregroundSubscription.remove();
      foregroundSubscription = null;
    }
    return false;
  }
};

/**
 * Detener tracking de ubicación
 */
export const stopLocationTracking = async () => {
  const startedAt = Date.now();
  try {
    await stopBackgroundLocation();

    // Detener foreground tracking
    if (foregroundSubscription) {
      foregroundSubscription.remove();
      foregroundSubscription = null;
      console.log('Foreground tracking stopped');
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
      ok: true,
    });
  }
};

/**
 * Guardar ubicación en Firebase
 */
const saveLocationToFirebase = async (coordinates, userId, isBackground = false) => {
  try {
    await setDoc(
      doc(db, 'tracking', 'current'),
      {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        speed: coordinates.speed ?? 0,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    await addDoc(collection(db, 'locations'), {
      userId,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      accuracy: coordinates.accuracy || null,
      altitude: coordinates.altitude || null,
      speed: coordinates.speed || null,
      heading: coordinates.heading || null,
      timestamp: new Date(),
      isBackground,
      batteryLevel: null, // Se puede agregar con expo-battery
    });
  } catch (error) {
    console.error('Error saving location to Firebase:', error);
    analyticsService.trackAppError('location_save_error', {
      name: error?.name,
      stack: error?.stack,
      tag: 'location_service',
      action: isBackground ? 'save_location_background' : 'save_location_foreground',
      fatal: false,
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
 * Obtener últimas ubicaciones del usuario desde Firebase
 */
export const getLastLocations = async (userId, limitCount = 10) => {
  try {
    const q = query(
      collection(db, 'locations'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    const querySnapshot = await getDocs(q);
    const locations = [];

    querySnapshot.forEach((docSnap) => {
      locations.push({ id: docSnap.id, ...docSnap.data() });
    });

    return locations;
  } catch (error) {
    console.error('Error getting last locations:', error);
    return [];
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

    return {
      background: backgroundActive,
      foreground: foregroundActive,
      any: backgroundActive || foregroundActive,
    };
  } catch (error) {
    console.error('Error checking tracking status:', error);
    return { background: false, foreground: false, any: false };
  }
};
