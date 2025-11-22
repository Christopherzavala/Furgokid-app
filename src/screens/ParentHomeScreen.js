// ParentHomeScreen.js - Dashboard Principal para Padres
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { auth } from '../config/firebase';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

const { width } = Dimensions.get('window');

const ParentHomeScreen = ({ navigation }) => {
  const [children, setChildren] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);

  useEffect(() => {
    loadUserData();
    requestLocationPermission();
    subscribeToUpdates();
    
    return () => {
      // Cleanup listeners
    };
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setCurrentLocation(location.coords);
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
    }
  };

  const loadUserData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'Usuario no autenticado');
        return;
      }

      // Cargar datos del usuario y sus hijos
      const userRef = doc(db, 'parents', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setChildren(userData.children || []);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading user data:', error);
      Alert.alert('Error', 'No se pudieron cargar los datos');
      setLoading(false);
    }
  };

  const subscribeToUpdates = () => {
    const user = auth.currentUser;
    if (!user) return;

    // Suscribirse a actualizaciones de ubicación en tiempo real
    const vehiclesQuery = query(
      collection(db, 'vehicles'),
      where('parentId', '==', user.uid)
    );

    return onSnapshot(vehiclesQuery, (snapshot) => {
      const vehiclesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setVehicles(vehiclesData);
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserData();
    setRefreshing(false);
  };

  const getChildStatus = (child) => {
    if (!child.vehicleId) return { status: 'En casa', icon: 'home', color: '#4CAF50' };
    
    const vehicle = vehicles.find(v => v.id === child.vehicleId);
    if (!vehicle) return { status: 'Ubicación desconocida', icon: 'help', color: '#FF9800' };

    if (vehicle.status === 'onRoute') {
      return { status: 'En el viaje', icon: 'car', color: '#2196F3' };
    } else if (vehicle.status === 'arrived') {
      return { status: 'Llegó al destino', icon: 'checkmark-circle', color: '#4CAF50' };
    }
    
    return { status: 'Estado desconocido', icon: 'help', color: '#FF9800' };
  };

  const renderChildCard = (child) => {
    const status = getChildStatus(child);
    
    return (
      <TouchableOpacity
        key={child.id}
        style={styles.childCard}
        onPress={() => navigation.navigate('GPS', { childId: child.id })}
      >
        <View style={styles.childHeader}>
          <View style={styles.childAvatar}>
            <Text style={styles.childInitial}>
              {child.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.childInfo}>
            <Text style={styles.childName}>{child.name}</Text>
            <Text style={styles.childSchool}>{child.school}</Text>
          </View>
          <View style={styles.statusContainer}>
            <Ionicons name={status.icon} size={20} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.status}
            </Text>
          </View>
        </View>
        
        {child.lastUpdate && (
          <Text style={styles.lastUpdate}>
            Última actualización: {new Date(child.lastUpdate.seconds * 1000).toLocaleTimeString()}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderVehicleCard = (vehicle) => (
    <TouchableOpacity
      key={vehicle.id}
      style={styles.vehicleCard}
      onPress={() => navigation.navigate('GPS', { vehicleId: vehicle.id })}
    >
      <View style={styles.vehicleHeader}>
        <Ionicons name="car" size={24} color="#2196F3" />
        <Text style={styles.vehicleName}>{vehicle.name}</Text>
        <Text style={styles.vehicleDriver}>Conductor: {vehicle.driverName}</Text>
      </View>
      <View style={styles.vehicleInfo}>
        <Text style={styles.vehiclePlate}>Placa: {vehicle.plate}</Text>
        <Text style={styles.vehicleSpeed}>
          Velocidad: {vehicle.currentSpeed || 0} km/h
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Cargando datos...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <LinearGradient colors={['#2196F3', '#1976D2']} style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.welcomeText}>
            ¡Bienvenido, {auth.currentUser?.displayName || 'Padre'}!
          </Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={onRefresh}
          >
            <Ionicons name="refresh" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {currentLocation && (
          <View style={styles.locationCard}>
            <Ionicons name="location" size={20} color="#2196F3" />
            <Text style={styles.locationText}>
              Tu ubicación: {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="people" size={20} /> Mis Hijos ({children.length})
          </Text>
          
          {children.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>
                No tienes hijos registrados
              </Text>
              <TouchableOpacity style={styles.addButton}>
                <Text style={styles.addButtonText}>Agregar Hijo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            children.map(renderChildCard)
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="car" size={20} /> Vehículos Activos ({vehicles.length})
          </Text>
          
          {vehicles.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>
                No hay vehículos asignados
              </Text>
            </View>
          ) : (
            vehicles.map(renderVehicleCard)
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.primaryButton]}
            onPress={() => navigation.navigate('GPS')}
          >
            <Ionicons name="map" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Ver Mapa GPS</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Configuración')}
          >
            <Ionicons name="settings" size={24} color="#2196F3" />
            <Text style={styles.actionButtonText}>Configuración</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  refreshButton: {
    padding: 10,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  locationText: {
    marginLeft: 10,
    color: '#666',
    fontSize: 14,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  childCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  childHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  childAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  childInitial: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  childSchool: {
    fontSize: 14,
    color: '#666',
  },
  statusContainer: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
  lastUpdate: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  vehicleCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  vehicleHeader: {
    marginBottom: 8,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 5,
  },
  vehicleDriver: {
    fontSize: 14,
    color: '#666',
  },
  vehicleInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  vehiclePlate: {
    fontSize: 14,
    color: '#666',
  },
  vehicleSpeed: {
    fontSize: 14,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 15,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
    marginBottom: 15,
  },
  addButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  actions: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  primaryButton: {
    backgroundColor: '#2196F3',
  },
  actionButtonText: {
    marginLeft: 8,
    color: '#2196F3',
    fontWeight: 'bold',
  },
});

export default ParentHomeScreen;