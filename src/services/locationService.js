// locationService.js - GPS Background Tracking Service with expo-task-manager
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { collection, addDoc, updateDoc, doc, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, auth } from '../config/firebase';

const LOCATION_TASK_NAME = 'background-location-task';
const LOCATION_TRACKING_ENABLED = 'location_tracking_enabled';

// Definir la tarea de background ANTES de cualquier otra función
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }
  
  if (data) {
    const { locations } = data;
    const location = locations[0];
    
    try {
      const user = auth.currentUser;
      if (user && location) {
        await saveLocationToFirebase(location.coords, user.uid, true);
        console.log('Background location saved:', location.coords);
      }
    } catch (err) {
      console.error('Error saving background location:', err);
    }
  }
});

/**
 * Solicita permisos de ubicación foreground y background
 */
export const requestLocationPermissions = async () => {
  try {
    // Primero permisos de foreground
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    
    if (foregroundStatus !== 'granted') {
      console.log('Foreground permission denied');
      return { foreground: false, background: false };
    }
    
    // Luego permisos de background (solo si foreground fue otorgado)
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    
    return {
      foreground: true,
      background: backgroundStatus === 'granted'
    };
  } catch (error) {
    console.error('Error requesting permissions:', error);
    return { foreground: false, background: false };
  }
};

/**
 * Iniciar tracking de ubicación en background
 */
export const startBackgroundLocationTracking = async () => {
  try {
    const permissions = await requestLocationPermissions();
    
    if (!permissions.background) {
      console.warn('Background permission not granted. Starting foreground tracking only.');
      return await startForegroundLocationTracking();
    }
    
    // Verificar si ya está corriendo
    const isTaskDefined = await TaskManager.isTaskDefined(LOCATION_TASK_NAME);
    if (!isTaskDefined) {
      console.error('Background task not defined');
      return false;
    }
    
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (hasStarted) {
      console.log('Background tracking already running');
      return true;
    }
    
    // Iniciar tracking background
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 30000, // 30 segundos
      distanceInterval: 50, // 50 metros
      foregroundService: {
        notificationTitle: 'FurgoKid GPS Activo',
        notificationBody: 'Rastreando ubicación de forma segura',
        notificationColor: '#4A90E2',
      },
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.AutomotiveNavigation,
      showsBackgroundLocationIndicator: true,
    });
    
    console.log('Background location tracking started');
    return true;
  } catch (error) {
    console.error('Error starting background tracking:', error);
    return false;
  }
};

/**
 * Iniciar tracking de ubicación en foreground (fallback)
 */
let foregroundSubscription = null;

export const startForegroundLocationTracking = async () => {
  try {
    const permissions = await requestLocationPermissions();
    
    if (!permissions.foreground) {
      console.error('Foreground permission denied');
      return false;
    }
    
    if (foregroundSubscription) {
      console.log('Foreground tracking already active');
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
    return true;
  } catch (error) {
    console.error('Error starting foreground tracking:', error);
    return false;
  }
};

/**
 * Detener tracking de ubicación
 */
export const stopLocationTracking = async () => {
  try {
    // Detener background tracking
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      console.log('Background tracking stopped');
    }
    
    // Detener foreground tracking
    if (foregroundSubscription) {
      foregroundSubscription.remove();
      foregroundSubscription = null;
      console.log('Foreground tracking stopped');
    }
    
    return true;
  } catch (error) {
    console.error('Error stopping tracking:', error);
    return false;
  }
};

/**
 * Guardar ubicación en Firebase
 */
const saveLocationToFirebase = async (coordinates, userId, isBackground = false) => {
  try {
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
    
    querySnapshot.forEach((doc) => {
      locations.push({ id: doc.id, ...doc.data() });
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
      any: backgroundActive || foregroundActive
    };
  } catch (error) {
    console.error('Error checking tracking status:', error);
    return { background: false, foreground: false, any: false };
  }
};
