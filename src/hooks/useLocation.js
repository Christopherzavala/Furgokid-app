// useLocation.js - Hook Reutilizable de Ubicación GPS
import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';

/**
 * Hook personalizado para gestionar ubicación GPS
 * @param {Object} options - Opciones de configuración
 * @param {boolean} options.enableTracking - Activar seguimiento continuo
 * @param {number} options.updateInterval - Intervalo de actualización (ms)
 * @param {number} options.distanceFilter - Distancia mínima para actualizar (metros)
 * @returns {Object} - Estado y funciones de ubicación
 */
export const useLocation = (options = {}) => {
    const {
        enableTracking = false,
        updateInterval = 30000, // 30 segundos
        distanceFilter = 50 // 50 metros
    } = options;

    const [location, setLocation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [permissionStatus, setPermissionStatus] = useState(null);

    const watchSubscription = useRef(null);

    // Solicitar permisos al montar
    useEffect(() => {
        requestPermissions();
        return () => {
            // Cleanup: detener seguimiento al desmontar
            if (watchSubscription.current) {
                watchSubscription.current.remove();
            }
        };
    }, []);

    // Activar seguimiento si está habilitado
    useEffect(() => {
        if (enableTracking && permissionStatus === 'granted') {
            startTracking();
        } else {
            stopTracking();
        }

        return () => stopTracking();
    }, [enableTracking, permissionStatus]);

    /**
     * Solicitar permisos de ubicación
     */
    const requestPermissions = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            setPermissionStatus(status);

            if (status === 'granted') {
                await getCurrentLocation();
            } else {
                setError(new Error('Permisos de ubicación denegados'));
                setLoading(false);
            }
        } catch (err) {
            setError(err);
            setLoading(false);
        }
    };

    /**
     * Obtener ubicación actual (una sola vez)
     */
    const getCurrentLocation = async () => {
        setLoading(true);
        setError(null);
        try {
            const currentLocation = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });
            setLocation(currentLocation.coords);
            setLoading(false);
            return { success: true, location: currentLocation.coords };
        } catch (err) {
            setError(err);
            setLoading(false);
            return { success: false, error: err.message };
        }
    };

    /**
     * Iniciar seguimiento continuo de ubicación
     */
    const startTracking = async () => {
        try {
            setLoading(true);
            watchSubscription.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: updateInterval,
                    distanceInterval: distanceFilter,
                },
                (newLocation) => {
                    setLocation(newLocation.coords);
                    setLoading(false);
                }
            );
        } catch (err) {
            setError(err);
            setLoading(false);
        }
    };

    /**
     * Detener seguimiento continuo
     */
    const stopTracking = () => {
        if (watchSubscription.current) {
            watchSubscription.current.remove();
            watchSubscription.current = null;
        }
    };

    /**
     * Calcular distancia entre dos coordenadas (Haversine)
     * @param {Object} coord1 - {latitude, longitude}
     * @param {Object} coord2 - {latitude, longitude}
     * @returns {number} - Distancia en kilómetros
     */
    const calculateDistance = (coord1, coord2) => {
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

    const toRadians = (degrees) => degrees * (Math.PI / 180);

    return {
        location,
        loading,
        error,
        permissionStatus,
        hasPermission: permissionStatus === 'granted',
        getCurrentLocation,
        startTracking,
        stopTracking,
        calculateDistance
    };
};

export default useLocation;
