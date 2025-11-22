// locationService.js - Servicio de Ubicación Optimizado
import * as Location from 'expo-location';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { auth } from '../config/firebase';

export const initializeLocationService = async () => {
  try {
    // Solicitar permisos de ubicación
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('Permission to access location was denied');
      return false;
    }

    // Configurar opciones de seguimiento
    await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 30000, // 30 segundos
        distanceInterval: 50, // 50 metros
      },
      async (location) => {
        // Guardar ubicación en Firebase si hay usuario autenticado
        const user = auth.currentUser;
        if (user) {
          await saveLocationToFirebase(location.coords, user.uid);
        }
      }
    );

    console.log('Location service initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing location service:', error);
    return false;
  }
};

const saveLocationToFirebase = async (coordinates, userId) => {
  try {
    await addDoc(collection(db, 'locations'), {
      userId,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      timestamp: new Date(),
      accuracy: coordinates.accuracy || null,
      speed: coordinates.speed || null,
      heading: coordinates.heading || null,
    });
  } catch (error) {
    console.error('Error saving location to Firebase:', error);
  }
};

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

export const calculateDistance = (coord1, coord2) => {
  const R = 6371; // Radio de la Tierra en km
  const dLat = toRadians(coord2.latitude - coord1.latitude);
  const dLon = toRadians(coord2.longitude - coord1.longitude);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRadians(coord1.latitude)) * Math.cos(toRadians(coord2.latitude)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distancia en km
};

const toRadians = (degrees) => {
  return degrees * (Math.PI/180);
};