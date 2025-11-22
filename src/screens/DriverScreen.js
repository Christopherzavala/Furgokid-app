// DriverScreen.js - Pantalla del Conductor
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '../config/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

const DriverScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [assignedRoute, setAssignedRoute] = useState(null);
  const [studentCount, setStudentCount] = useState(0);
  const [currentStatus, setCurrentStatus] = useState('En espera');

  useEffect(() => {
    loadDriverData();
    return () => {
      // Cleanup listeners
    };
  }, []);

  const loadDriverData = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      // Cargar datos del conductor
      const driverQuery = query(
        collection(db, 'drivers'),
        where('userId', '==', user.uid)
      );

      setLoading(false);
    } catch (error) {
      console.error('Error loading driver data:', error);
      setLoading(false);
    }
  };

  const startRoute = () => {
    setCurrentStatus('En ruta');
    Alert.alert('Ruta iniciada', 'Has comenzado tu ruta. Mantente seguro en el camino.');
  };

  const completeRoute = () => {
    setCurrentStatus('Completada');
    Alert.alert('Ruta completada', 'Has completado tu ruta exitosamente.');
  };

  const callEmergency = () => {
    Alert.alert(
      'Emergencia',
      'Se contactará con emergencias y los padres inmediatamente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Contactar', onPress: () => Alert.alert('Contactando...', 'Emergencias activadas.') }
      ]
    );
  };

  const renderStatusCard = () => (
    <View style={styles.statusCard}>
      <Text style={styles.statusTitle}>Estado Actual</Text>
      <View style={styles.statusIndicator}>
        <View style={[
          styles.statusDot,
          { backgroundColor: getStatusColor(currentStatus) }
        ]} />
        <Text style={styles.statusText}>{currentStatus}</Text>
      </View>
    </View>
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'En espera': return '#FF9800';
      case 'En ruta': return '#2196F3';
      case 'Completada': return '#4CAF50';
      default: return '#999';
    }
  };

  const renderRouteInfo = () => (
    <View style={styles.infoCard}>
      <Text style={styles.infoTitle}>Información de la Ruta</Text>
      <View style={styles.infoRow}>
        <Ionicons name="people" size={20} color="#2196F3" />
        <Text style={styles.infoText}>Estudiantes: {studentCount}</Text>
      </View>
      <View style={styles.infoRow}>
        <Ionicons name="time" size={20} color="#2196F3" />
        <Text style={styles.infoText}>Hora estimada: 08:00 AM</Text>
      </View>
      <View style={styles.infoRow}>
        <Ionicons name="location" size={20} color="#2196F3" />
        <Text style={styles.infoText}>Destino: Escuela Primaria</Text>
      </View>
    </View>
  );

  const renderActionButtons = () => (
    <View style={styles.actionsContainer}>
      {currentStatus === 'En espera' && (
        <TouchableOpacity 
          style={[styles.actionButton, styles.primaryButton]}
          onPress={startRoute}
        >
          <Ionicons name="play" size={24} color="#fff" />
          <Text style={styles.actionButtonText}>Iniciar Ruta</Text>
        </TouchableOpacity>
      )}

      {currentStatus === 'En ruta' && (
        <TouchableOpacity 
          style={[styles.actionButton, styles.successButton]}
          onPress={completeRoute}
        >
          <Ionicons name="checkmark-circle" size={24} color="#fff" />
          <Text style={styles.actionButtonText}>Completar Ruta</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity 
        style={[styles.actionButton, styles.emergencyButton]}
        onPress={callEmergency}
      >
        <Ionicons name="warning" size={24} color="#fff" />
        <Text style={styles.actionButtonText}>Emergencia</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Cargando datos del conductor...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={['#2196F3', '#1976D2']} style={styles.header}>
        <Text style={styles.headerTitle}>Panel del Conductor</Text>
        <Text style={styles.headerSubtitle}>Bienvenido, {auth.currentUser?.displayName || 'Conductor'}</Text>
      </LinearGradient>

      <View style={styles.content}>
        {renderStatusCard()}
        {renderRouteInfo()}
        {renderActionButtons()}

        <View style={styles.quickActions}>
          <Text style={styles.quickActionsTitle}>Acciones Rápidas</Text>
          
          <TouchableOpacity style={styles.quickActionItem}>
            <Ionicons name="map" size={20} color="#2196F3" />
            <Text style={styles.quickActionText}>Ver Mapa GPS</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionItem}>
            <Ionicons name="people-circle" size={20} color="#2196F3" />
            <Text style={styles.quickActionText}>Lista de Estudiantes</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionItem}>
            <Ionicons name="notifications" size={20} color="#2196F3" />
            <Text style={styles.quickActionText}>Notificaciones</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionItem}>
            <Ionicons name="call" size={20} color="#2196F3" />
            <Text style={styles.quickActionText}>Contactar Padres</Text>
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
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#E3F2FD',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statusCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#666',
  },
  actionsContainer: {
    marginBottom: 30,
  },
  actionButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  primaryButton: {
    backgroundColor: '#2196F3',
  },
  successButton: {
    backgroundColor: '#4CAF50',
  },
  emergencyButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
  quickActions: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  quickActionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  quickActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  quickActionText: {
    marginLeft: 15,
    fontSize: 16,
    color: '#333',
  },
});

export default DriverScreen;