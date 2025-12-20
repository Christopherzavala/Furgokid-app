// src/services/trackingService.js
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { LOCATION_TASK_NAME } from './backgroundLocation';

/**
 * Inicia el tracking de GPS en background para una ruta
 * @param {string} routeId - ID de la ruta activa
 */
export async function startRouteTracking(routeId) {
    console.log('🚀 Iniciando tracking para ruta:', routeId);

    // Guardar route ID en variable global y persistencia (para reinicios de tarea BG)
    global.currentRouteId = routeId;
    await AsyncStorage.setItem('@active_route_id', routeId);

    // Actualizar activeRouteId en el perfil del conductor para que los padres lo encuentren
    try {
        const user = auth.currentUser;
        if (user) {
            await updateDoc(doc(db, 'users', user.uid), {
                activeRouteId: routeId,
                isTracking: true
            });
        }
    } catch (e) {
        console.error('❌ Error actualizando activeRouteId en perfil:', e);
    }

    // 1. Solicitar permiso foreground
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
        throw new Error('Permiso de ubicación (foreground) denegado');
    }
    console.log('✅ Permiso foreground concedido');

    // 2. Solicitar permiso background
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted') {
        throw new Error('Permiso de ubicación en segundo plano (background) denegado');
    }
    console.log('✅ Permiso background concedido');

    // 3. Verificar si ya está corriendo
    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

    if (started) {
        console.log('⚠️ Tracking ya estaba activo, reiniciando...');
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }

    // 4. Iniciar tracking
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced, // Balance entre precisión y batería
        timeInterval: 8000, // Actualizar cada 8 segundos
        distanceInterval: 15, // O cada 15 metros
        pausesUpdatesAutomatically: false, // No pausar automáticamente
        showsBackgroundLocationIndicator: true, // Mostrar indicador en iOS
        foregroundService: {
            notificationTitle: 'FurgoKid en ruta',
            notificationBody: 'Rastreando ubicación en tiempo real',
            notificationColor: '#FF6B35', // Color naranja de FurgoKid
        },
    });

    console.log('✅ Tracking iniciado correctamente');
}

/**
 * Detiene el tracking de GPS en background
 */
export async function stopRouteTracking() {
    console.log('🛑 Deteniendo tracking...');

    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

    if (started) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        console.log('✅ Tracking detenido');
    } else {
        console.log('⚠️ Tracking no estaba activo');
    }

    // Actualizar perfil para indicar que no hay ruta activa
    try {
        const user = auth.currentUser;
        if (user) {
            await updateDoc(doc(db, 'users', user.uid), {
                activeRouteId: null,
                isTracking: false
            });
        }
    } catch (e) {
        console.error('❌ Error limpiando activeRouteId en perfil:', e);
    }

    // Limpiar route ID global y persistencia
    global.currentRouteId = null;
    await AsyncStorage.removeItem('@active_route_id');
}

/**
 * Verifica si el tracking está activo
 * @returns {Promise<boolean>}
 */
export async function isTrackingActive() {
    return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
}

/**
 * Obtiene la ubicación actual (una sola vez)
 * @returns {Promise<Location.LocationObject>}
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
