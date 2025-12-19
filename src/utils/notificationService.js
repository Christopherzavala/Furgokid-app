/**
 * Notification Service Wrapper
 * 
 * Este wrapper maneja notificaciones de manera condicional:
 * - En Development Build: Usa expo-notifications completo
 * - En Expo Go: Solo notificaciones locales (sin push remoto)
 */

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

// Configurar handler de notificaciones
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

/**
 * Verifica si estamos en un Development Build o Expo Go
 */
export const isDevBuild = () => {
    return Constants.appOwnership === 'expo';
};

/**
 * Registra el dispositivo para notificaciones push
 * Solo funciona en Development Build
 */
export async function registerForPushNotificationsAsync() {
    let token;

    if (!Device.isDevice) {
        console.warn('⚠️  Las notificaciones push solo funcionan en dispositivos físicos');
        return null;
    }

    // Verificar si estamos en Expo Go
    if (Constants.appOwnership === 'expo') {
        console.warn('⚠️  Notificaciones push remotas no disponibles en Expo Go');
        console.warn('ℹ️  Usa un Development Build para habilitar push notifications');
        return null;
    }

    try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.warn('⚠️  No se obtuvieron permisos para notificaciones');
            return null;
        }

        // Obtener token solo si no estamos en Expo Go
        token = await Notifications.getExpoPushTokenAsync({
            projectId: Constants.expoConfig?.extra?.eas?.projectId,
        });

        console.log('✅ Token de notificaciones:', token.data);
        return token.data;
    } catch (error) {
        console.error('❌ Error al registrar notificaciones:', error);
        return null;
    }
}

/**
 * Programa una notificación local
 * Funciona tanto en Expo Go como en Development Build
 */
export async function scheduleLocalNotification(title, body, data = {}, seconds = 1) {
    try {
        const id = await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data,
                sound: true,
            },
            trigger: {
                seconds,
            },
        });

        console.log('✅ Notificación local programada:', id);
        return id;
    } catch (error) {
        console.error('❌ Error al programar notificación local:', error);
        return null;
    }
}

/**
 * Muestra una notificación inmediatamente
 */
export async function showNotification(title, body, data = {}) {
    return scheduleLocalNotification(title, body, data, 1);
}

/**
 * Cancela todas las notificaciones programadas
 */
export async function cancelAllNotifications() {
    try {
        await Notifications.cancelAllScheduledNotificationsAsync();
        console.log('✅ Todas las notificaciones canceladas');
    } catch (error) {
        console.error('❌ Error al cancelar notificaciones:', error);
    }
}

/**
 * Obtiene todas las notificaciones programadas
 */
export async function getScheduledNotifications() {
    try {
        return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
        console.error('❌ Error al obtener notificaciones programadas:', error);
        return [];
    }
}

export default {
    registerForPushNotificationsAsync,
    scheduleLocalNotification,
    showNotification,
    cancelAllNotifications,
    getScheduledNotifications,
    isDevBuild,
};
