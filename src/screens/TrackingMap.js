// TrackingMap.js - Mapa GPS con Seguimiento en Tiempo Real
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { auth } from '../config/firebase';
import { collection, query, where, onSnapshot, orderBy, limit, doc } from 'firebase/firestore';
import { db } from '../config/firebase';

const { width, height } = Dimensions.get('window');

const TrackingMap = ({ route, navigation }) => {
  const [region, setRegion] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [children, setChildren] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [followMode, setFollowMode] = useState(false);
  const [trackingPoints, setTrackingPoints] = useState([]);

  const mapRef = useRef(null);
  const watchId = useRef(null);

  useEffect(() => {
    requestLocationPermission();
    loadInitialData();
    subscribeToRealTimeUpdates();

    return () => {
      // Cleanup location watcher
      if (watchId.current) {
        Location.stopLocationUpdatesAsync(watchId.current);
      }
    };
  }, []);

  useEffect(() => {
    if (route.params?.childId) {
      setSelectedVehicle(route.params.childId);
    } else if (route.params?.vehicleId) {
      setSelectedVehicle(route.params.vehicleId);
    }
  }, [route.params]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });

        // Iniciar seguimiento continuo
        watchId.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          (location) => {
            if (followMode) {
              setRegion(prevRegion => ({
                ...prevRegion,
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              }));
            }
          }
        );
      } else {
        Alert.alert(
          'Permisos Requeridos',
          'FurgoKid necesita acceso a tu ubicación para funcionar correctamente.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Configurar', onPress: () => Location.openSettingsAsync() }
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      Alert.alert('Error', 'No se pudo acceder a la ubicación');
    }
  };

  const loadInitialData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Cargar vehículos asignados
      const vehiclesQuery = query(
        collection(db, 'vehicles'),
        where('parentId', '==', user.uid)
      );

      // Cargar hijos
      const userRef = doc(db, 'parents', user.uid);

      setLoading(false);
    } catch (error) {
      console.error('Error loading initial data:', error);
      setLoading(false);
    }
  };

  const subscribeToRealTimeUpdates = () => {
    const user = auth.currentUser;
    if (!user) return;

    // Suscribirse a actualizaciones de vehículos en tiempo real
    const vehiclesQuery = query(
      collection(db, 'vehicles'),
      where('parentId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(vehiclesQuery, (snapshot) => {
      const vehiclesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: new Date()
      }));

      setVehicles(vehiclesData);

      // Si hay un vehículo seleccionado, actualizar la vista del mapa
      if (selectedVehicle && vehiclesData.length > 0) {
        const vehicle = vehiclesData.find(v => v.id === selectedVehicle || v.id === selectedVehicle);
        if (vehicle && vehicle.currentLocation) {
          setRegion(prevRegion => ({
            ...prevRegion,
            latitude: vehicle.currentLocation.latitude,
            longitude: vehicle.currentLocation.longitude,
          }));
        }
      }
    });

    // Cargar historial de puntos de rastreo
    loadTrackingHistory();
  };

  const loadTrackingHistory = async () => {
    try {
      if (!selectedVehicle) return;

      const trackingQuery = query(
        collection(db, 'tracking'),
        where('vehicleId', '==', selectedVehicle),
        orderBy('timestamp', 'desc'),
        limit(50)
      );

      onSnapshot(trackingQuery, (snapshot) => {
        const points = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setTrackingPoints(points.reverse());
      });
    } catch (error) {
      console.error('Error loading tracking history:', error);
    }
  };

  const centerOnUser = () => {
    if (region && mapRef.current) {
      mapRef.current.animateToRegion(region, 1000);
    }
  };

  const toggleFollowMode = () => {
    setFollowMode(!followMode);
  };

  const renderVehicleMarkers = () => {
    return vehicles.map((vehicle) => (
      <Marker
        key={vehicle.id}
        coordinate={{
          latitude: vehicle.currentLocation?.latitude || 0,
          longitude: vehicle.currentLocation?.longitude || 0,
        }}
        title={vehicle.name}
        description={`Conductor: ${vehicle.driverName}`}
        onPress={() => setSelectedVehicle(vehicle.id)}
      >
        <View style={[
          styles.vehicleMarker,
          selectedVehicle === vehicle.id && styles.selectedVehicleMarker
        ]}>
          <Ionicons name="car" size={20} color="#fff" />
        </View>
      </Marker>
    ));
  };

  const renderUserLocation = () => {
    if (!region) return null;

    return (
      <Marker
        coordinate={{
          latitude: region.latitude,
          longitude: region.longitude,
        }}
        title="Tu ubicación"
        pinColor="#4CAF50"
      >
        <View style={styles.userMarker}>
          <Ionicons name="person" size={16} color="#fff" />
        </View>
      </Marker>
    );
  };

  const renderTrackingPolyline = () => {
    if (trackingPoints.length < 2) return null;

    const coordinates = trackingPoints.map(point => ({
      latitude: point.location.latitude,
      longitude: point.location.longitude,
    }));

    return (
      <Polyline
        coordinates={coordinates}
        strokeColor="#2196F3"
        strokeWidth={3}
        lineDashPattern={[5, 5]}
      />
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Cargando mapa GPS...</Text>
      </View>
    );
  }

  if (!region) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="location-outline" size={64} color="#ccc" />
        <Text style={styles.errorText}>
          No se pudo acceder a la ubicación
        </Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={requestLocationPermission}
        >
          <Text style={styles.retryButtonText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        provider={PROVIDER_GOOGLE}
        showsUserLocation={false}
        showsMyLocationButton={false}
      >
        {renderUserLocation()}
        {renderVehicleMarkers()}
        {renderTrackingPolyline()}
      </MapView>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, followMode && styles.activeButton]}
          onPress={toggleFollowMode}
        >
          <Ionicons
            name={followMode ? "radio-button-on" : "radio-button-off"}
            size={24}
            color={followMode ? "#fff" : "#2196F3"}
          />
          <Text style={[
            styles.controlButtonText,
            followMode && styles.activeButtonText
          ]}>
            Seguir
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={centerOnUser}
        >
          <Ionicons name="locate" size={24} color="#2196F3" />
          <Text style={styles.controlButtonText}>Centrar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#2196F3" />
          <Text style={styles.controlButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>

      {selectedVehicle && (
        <View style={styles.infoPanel}>
          <Text style={styles.infoTitle}>Vehículo Seleccionado</Text>
          <Text style={styles.infoText}>
            ID: {selectedVehicle}
          </Text>
          <Text style={styles.infoSubtext}>
            Última actualización: {new Date().toLocaleTimeString()}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 15,
    color: '#666',
    textAlign: 'center',
    fontSize: 16,
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  map: {
    flex: 1,
  },
  vehicleMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  selectedVehicleMarker: {
    backgroundColor: '#FF5722',
    transform: [{ scale: 1.1 }],
  },
  userMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  controls: {
    position: 'absolute',
    right: 20,
    top: 50,
    flexDirection: 'column',
    gap: 10,
  },
  controlButton: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
    minWidth: 60,
  },
  activeButton: {
    backgroundColor: '#2196F3',
  },
  controlButtonText: {
    fontSize: 12,
    color: '#2196F3',
    marginTop: 2,
  },
  activeButtonText: {
    color: '#fff',
  },
  infoPanel: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  infoSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
    fontStyle: 'italic',
  },
});

export default TrackingMap;