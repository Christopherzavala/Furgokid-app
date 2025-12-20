// src/screens/TrackingMap.js
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
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  doc,
  getDoc
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';

const { width, height } = Dimensions.get('window');

const TrackingMap = ({ route, navigation }) => {
  const [region, setRegion] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [trackingPoints, setTrackingPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followMode, setFollowMode] = useState(true);
  const [activeRouteId, setActiveRouteId] = useState(null);
  const [driverName, setDriverName] = useState('Conductor');

  const mapRef = useRef(null);

  useEffect(() => {
    setupInitialMap();
    subscribeToGlobalTracking();
    return () => { };
  }, []);

  const setupInitialMap = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        });
      }
    } catch (e) {
      console.error('Error getting initial location:', e);
    }
  };

  /**
   * Suscripción simplificada al documento global de tracking
   */
  const subscribeToGlobalTracking = () => {
    const docRef = doc(db, 'tracking', 'current');

    return onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const point = {
          latitude: data.latitude,
          longitude: data.longitude,
          speed: data.speed || 0,
          id: 'current'
        };

        setDriverLocation(point);
        setDriverName('Furgo en Ruta');
        setActiveRouteId('test-session');

        // Actualizar histórico para la polilínea
        setTrackingPoints(prev => {
          const newPoints = [...prev, point].slice(-50);
          return newPoints;
        });

        if (followMode && mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: data.latitude,
            longitude: data.longitude,
            latitudeDelta: 0.008,
            longitudeDelta: 0.008,
          }, 1000);
        }
      }
      setLoading(false);
    });
  };

  const centerOnDriver = () => {
    if (driverLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 1000);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Conectando con GPS...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={region}
        provider={PROVIDER_GOOGLE}
      >
        {/* Marcador del Conductor (Furgo) */}
        {driverLocation && (
          <Marker
            coordinate={{
              latitude: driverLocation.latitude,
              longitude: driverLocation.longitude,
            }}
            title={driverName}
            description={`Velocidad: ${Math.round(driverLocation.speed * 3.6)} km/h`}
          >
            <View style={styles.vehicleMarker}>
              <Ionicons name="car" size={24} color="#fff" />
            </View>
          </Marker>
        )}

        {/* Polilínea de la ruta recorrida */}
        {trackingPoints.length > 1 && (
          <Polyline
            coordinates={trackingPoints.map(p => ({
              latitude: p.latitude,
              longitude: p.longitude
            }))}
            strokeColor="#FF6B35"
            strokeWidth={4}
            lineDashPattern={[1]}
          />
        )}
      </MapView>

      {/* CONTROLES FLOTANTES */}
      <View style={styles.topControls}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.statusBadge}>
          <View style={[styles.dot, activeRouteId ? styles.dotActive : styles.dotInactive]} />
          <Text style={styles.statusText}>
            {activeRouteId ? 'EN VIVO' : 'SIN RUTA ACTIVA'}
          </Text>
        </View>
      </View>

      <View style={styles.bottomControls}>
        <TouchableOpacity
          style={[styles.controlButton, followMode && styles.activeButton]}
          onPress={() => setFollowMode(!followMode)}
        >
          <Ionicons name="locate" size={26} color={followMode ? "#fff" : "#FF6B35"} />
        </TouchableOpacity>

        {driverLocation && (
          <TouchableOpacity
            style={styles.controlButton}
            onPress={centerOnDriver}
          >
            <Ionicons name="car" size={26} color="#FF6B35" />
          </TouchableOpacity>
        )}
      </View>

      {/* PANEL DE INFORMACIÓN */}
      <View style={styles.infoPanel}>
        <View style={styles.infoRow}>
          <View style={styles.driverInfo}>
            <Text style={styles.driverLabel}>Conductor Asignado</Text>
            <Text style={styles.driverName}>{driverName}</Text>
          </View>
          {driverLocation && (
            <View style={styles.speedInfo}>
              <Text style={styles.speedValue}>{Math.round(driverLocation.speed * 3.6)}</Text>
              <Text style={styles.speedUnit}>km/h</Text>
            </View>
          )}
        </View>
        {!activeRouteId && (
          <Text style={styles.waitingText}>Esperando a que el conductor inicie el recorrido...</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    width: width,
    height: height,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  vehicleMarker: {
    backgroundColor: '#FF6B35',
    padding: 5,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  topControls: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 30,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  statusBadge: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  dotActive: {
    backgroundColor: '#4CAF50',
  },
  dotInactive: {
    backgroundColor: '#999',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  bottomControls: {
    position: 'absolute',
    right: 20,
    bottom: 140,
    flexDirection: 'column',
  },
  controlButton: {
    backgroundColor: '#fff',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  activeButton: {
    backgroundColor: '#FF6B35',
  },
  infoPanel: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverInfo: {
    flex: 1,
  },
  driverLabel: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  driverName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 2,
  },
  speedInfo: {
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
  },
  speedValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  speedUnit: {
    fontSize: 10,
    color: '#999',
  },
  waitingText: {
    marginTop: 15,
    fontSize: 13,
    color: '#FF6B35',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});

export default TrackingMap;