import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const LOCATION_TASK_NAME = 'furgokid-background-location';

let startStopInFlight = false;

// 1. Definición de la Tarea en Background
if (!TaskManager.isTaskDefined(LOCATION_TASK_NAME)) {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.error('❌ BG Task error:', error);
      return;
    }

    const loc = data?.locations?.[0];
    if (!loc) return;

    const { latitude, longitude, speed } = loc.coords;

    try {
      // Guardado directo en tracking/current para validación MVP
      await setDoc(
        doc(db, 'tracking', 'current'),
        {
          latitude,
          longitude,
          speed: speed ?? 0,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      console.log('📍 GPS Update (BG):', latitude, longitude);
    } catch (err) {
      console.error('❌ Error guardando en Firestore (BG):', err);
    }
  });
}

// 2. Función para Iniciar GPS
export const startBackgroundLocation = async () => {
  if (startStopInFlight) {
    if (__DEV__) console.log('⚠️ startBackgroundLocation: operación en curso');
    return;
  }
  startStopInFlight = true;

  console.log('🚀 Solicitando inicio de GPS...');

  try {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      throw new Error('Permiso foreground denegado');
    }

    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== 'granted') {
      throw new Error('Permiso background denegado (Selecciona "Permitir todo el tiempo")');
    }

    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (hasStarted) {
      console.log('⚠️ El GPS ya estaba activo');
      return;
    }

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

    console.log('✅ GPS Background Iniciado');
  } finally {
    startStopInFlight = false;
  }
};

// 3. Función para Detener GPS
export const stopBackgroundLocation = async () => {
  if (startStopInFlight) {
    if (__DEV__) console.log('⚠️ stopBackgroundLocation: operación en curso');
    return;
  }
  startStopInFlight = true;

  try {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      console.log('🛑 GPS Background Detenido');
    }
  } finally {
    startStopInFlight = false;
  }
};
