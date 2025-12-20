import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import useAuth from '../hooks/useAuth';
import EmptyState from '../components/EmptyState';
import { startBackgroundLocation, stopBackgroundLocation } from '../services/backgroundLocation';

const DriverScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [isRouteActive, setIsRouteActive] = useState(false);
  const [students, setStudents] = useState([]); // Empty for now

  const toggleRoute = async () => {
    try {
      if (isRouteActive) {
        Alert.alert(
          'Terminar Ruta',
          '¿Estás seguro de que deseas terminar el recorrido?',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Terminar',
              style: 'destructive',
              onPress: async () => {
                await stopBackgroundLocation();
                setIsRouteActive(false);
              }
            }
          ]
        );
      } else {
        await startBackgroundLocation();
        setIsRouteActive(true);
        Alert.alert('Ruta Iniciada', 'Tu ubicación ahora es visible para los padres en tiempo real.');
      }
    } catch (error) {
      console.error('Error toggling route:', error);
      Alert.alert('Error', 'No se pudo iniciar el GPS: ' + error.message);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2196F3" />

      {/* HEADER */}
      <LinearGradient
        colors={['#2196F3', '#1976D2']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Panel de Conductor</Text>
        <Text style={styles.headerSubtitle}>
          {user?.email?.split('@')[0] || 'Conductor'}
        </Text>
      </LinearGradient>

      {/* MAIN CONTENT */}
      <View style={styles.content}>

        {/* BIG ACTION BUTTON */}
        <TouchableOpacity
          style={[styles.bigButton, isRouteActive ? styles.stopButton : styles.startButton]}
          onPress={toggleRoute}
        >
          <Ionicons
            name={isRouteActive ? "stop-circle-outline" : "play-circle-outline"}
            size={40}
            color="#fff"
          />
          <Text style={styles.bigButtonText}>
            {isRouteActive ? "TERMINAR RUTA" : "INICIAR RUTA"}
          </Text>
        </TouchableOpacity>

        {isRouteActive && (
          <View style={styles.statusIndicator}>
            <View style={styles.pulsingDot} />
            <Text style={styles.statusText}>Transmitiendo ubicación en vivo</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Estudiantes en Ruta</Text>

        {students.length === 0 ? (
          <EmptyState
            icon="school-outline"
            title="Sin estudiantes asignados"
            message="No hay estudiantes en tu lista por el momento."
          />
        ) : (
          <ScrollView>
            {/* Student list will go here */}
            <Text>Lista de estudiantes...</Text>
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#E3F2FD',
    marginTop: 5,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  bigButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  bigButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    backgroundColor: '#E8F5E9',
    padding: 10,
    borderRadius: 20,
  },
  pulsingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
    marginRight: 8,
  },
  statusText: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
});

export default DriverScreen;