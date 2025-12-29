import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AdBannerComponent from '../components/AdBannerComponent';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import { startBackgroundLocation, stopBackgroundLocation } from '../services/backgroundLocation';

const DriverScreen = ({ navigation }) => {
  const { user, userProfile, signOut } = useAuth();
  const [isRouteActive, setIsRouteActive] = useState(false);
  const [students] = useState([]); // Empty for now

  const toggleRoute = async () => {
    try {
      if (isRouteActive) {
        Alert.alert('Terminar Ruta', '¿Estás seguro de que deseas terminar el recorrido?', [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Terminar',
            style: 'destructive',
            onPress: async () => {
              await stopBackgroundLocation();
              setIsRouteActive(false);
            },
          },
        ]);
      } else {
        await startBackgroundLocation();
        setIsRouteActive(true);
        Alert.alert(
          'Ruta Iniciada',
          'Tu ubicación ahora es visible para los padres en tiempo real.'
        );
      }
    } catch (error) {
      console.error('Error toggling route:', error);
      Alert.alert('Error', 'No se pudo iniciar el GPS: ' + error.message);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Cerrar Sesión', '¿Estás seguro de que deseas cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar Sesión',
        style: 'destructive',
        onPress: async () => {
          const result = await signOut();
          if (result.success) {
            Alert.alert('Sesión cerrada', 'Has cerrado sesión correctamente.');
          } else {
            Alert.alert('Error', 'No se pudo cerrar sesión: ' + result.error);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2196F3" />

      {/* HEADER */}
      <LinearGradient colors={['#2196F3', '#1976D2']} style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Panel de Conductor</Text>
            <Text style={styles.headerSubtitle}>{user?.email?.split('@')[0] || 'Conductor'}</Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => navigation.navigate('DriverProfile')}
            >
              <Ionicons name="document-text" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* MAIN CONTENT */}
      <View style={styles.content}>
        <TouchableOpacity
          style={[styles.bigButton, isRouteActive ? styles.stopButton : styles.startButton]}
          onPress={toggleRoute}
        >
          <Ionicons
            name={isRouteActive ? 'stop-circle-outline' : 'play-circle-outline'}
            size={40}
            color="#fff"
          />
          <Text style={styles.bigButtonText}>
            {isRouteActive ? 'TERMINAR RUTA' : 'INICIAR RUTA'}
          </Text>
        </TouchableOpacity>

        {isRouteActive && (
          <View style={styles.statusIndicator}>
            <View style={styles.pulsingDot} />
            <Text style={styles.statusText}>Transmitiendo ubicación en vivo</Text>
          </View>
        )}

        {/* ACTION BUTTONS */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('DriverVacancy')}
          >
            <Ionicons name="add-circle" size={32} color="#2196F3" />
            <Text style={styles.actionCardText}>Publicar Cupo</Text>
            <Text style={styles.actionCardSubtext}>Abre espacios disponibles</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Search')}>
            <Ionicons name="search" size={32} color="#4CAF50" />
            <Text style={styles.actionCardText}>Ver Solicitudes</Text>
            <Text style={styles.actionCardSubtext}>Padres buscando transporte</Text>
          </TouchableOpacity>
        </View>

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

        {/* BANNER AD - MONETIZACIÓN */}
        <AdBannerComponent
          placement="BANNER_HOME"
          userRole="driver"
          adsDisabled={Boolean(
            userProfile?.isPremium || userProfile?.subscriptionActive || userProfile?.noAds
          )}
        />
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
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  profileButton: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  logoutButton: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
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
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 25,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  actionCardText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
    textAlign: 'center',
  },
  actionCardSubtext: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
});

export default DriverScreen;
