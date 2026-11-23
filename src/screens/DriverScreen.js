import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Alert, FlatList, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AdBannerComponent from '../components/AdBannerComponent';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import { startBackgroundLocationTracking, stopLocationTracking } from '../services/locationService';
import { getActiveDriverMatches } from '../services/matchTrackingService';
import toastService from '../services/toastService';

const DriverScreen = ({ navigation }) => {
  const { user, userProfile, signOut } = useAuth();
  const [isRouteActive, setIsRouteActive] = useState(false);
  const [activeMatches, setActiveMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [activeTrackingMatchId, setActiveTrackingMatchId] = useState(null);
  const [students] = useState([]); // Empty for now

  useEffect(() => {
    let active = true;
    getActiveDriverMatches()
      .then((matches) => {
        if (!active) return;
        setActiveMatches(matches);
        setSelectedMatchId((current) => current || (matches.length === 1 ? matches[0].id : null));
      })
      .catch(() => {
        if (active) setActiveMatches([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const toggleRoute = async () => {
    try {
      if (isRouteActive) {
        Alert.alert('Terminar Ruta', '¿Estás seguro de que deseas terminar el recorrido?', [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Terminar',
            style: 'destructive',
            onPress: async () => {
              try {
                const stopped = await stopLocationTracking(activeTrackingMatchId);
                if (!stopped) throw new Error('No se pudo limpiar la ubicación.');
                setIsRouteActive(false);
                setActiveTrackingMatchId(null);
              } catch (error) {
                toastService.error(
                  'Error GPS',
                  'No se pudo limpiar la ubicación: ' + error.message
                );
              }
            },
          },
        ]);
      } else {
        if (!selectedMatchId) {
          throw new Error('Selecciona un emparejamiento activo antes de iniciar el GPS.');
        }
        const started = await startBackgroundLocationTracking(selectedMatchId);
        if (!started) throw new Error('No se pudo iniciar el seguimiento GPS.');
        setActiveTrackingMatchId(selectedMatchId);
        setIsRouteActive(true);
        toastService.success(
          'Ruta iniciada',
          'Tu ubicación ahora es visible para el padre asignado.'
        );
      }
    } catch (error) {
      console.error('Error toggling route:', error);
      toastService.error('Error GPS', 'No se pudo iniciar el GPS: ' + error.message);
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
            toastService.success('Sesión cerrada', 'Has cerrado sesión correctamente.');
          } else {
            toastService.error('Error', 'No se pudo cerrar sesión: ' + result.error);
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
              style={styles.settingsButton}
              onPress={() => navigation.navigate('Settings')}
              accessible={true}
              accessibilityLabel="Abrir configuración"
              accessibilityRole="button"
            >
              <Ionicons name="settings-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => navigation.navigate('DriverProfile')}
              accessible={true}
              accessibilityLabel="Ver perfil de conductor"
              accessibilityRole="button"
            >
              <Ionicons name="document-text" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              accessible={true}
              accessibilityLabel="Cerrar sesión"
              accessibilityRole="button"
            >
              <Ionicons name="log-out" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* MAIN CONTENT */}
      <View style={styles.content}>
        {(userProfile?.role === 'admin' || userProfile?.role === 'ops') && (
          <TouchableOpacity
            style={styles.opsButton}
            onPress={() => navigation.navigate('AdminOps')}
          >
            <Ionicons name="shield-checkmark" size={20} color="#fff" />
            <Text style={styles.opsButtonText}>Consola Ops / Admin</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.bigButton, isRouteActive ? styles.stopButton : styles.startButton]}
          onPress={toggleRoute}
          accessible={true}
          accessibilityLabel={isRouteActive ? 'Detener ruta activa' : 'Iniciar ruta'}
          accessibilityRole="button"
          accessibilityHint={
            isRouteActive
              ? 'Terminar el recorrido y dejar de compartir ubicación'
              : 'Comenzar el recorrido y compartir ubicación en tiempo real'
          }
          accessibilityState={{ selected: isRouteActive }}
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

        {(isRouteActive || selectedMatchId) && (
          <TouchableOpacity
            style={styles.mapNavButton}
            onPress={() =>
              navigation.navigate('TrackingMap', {
                matchId: activeTrackingMatchId || selectedMatchId,
              })
            }
          >
            <Ionicons name="map" size={20} color="#fff" />
            <Text style={styles.mapNavButtonText}>Gestionar Pasajeros y Entrega (Mapa)</Text>
          </TouchableOpacity>
        )}

        {activeMatches.length > 1 && (
          <View style={styles.matchSelector}>
            <Text style={styles.sectionTitle}>Emparejamiento activo</Text>
            {activeMatches.map((match) => (
              <TouchableOpacity
                key={match.id}
                style={[
                  styles.matchOption,
                  selectedMatchId === match.id && styles.matchOptionSelected,
                ]}
                onPress={() => {
                  if (!isRouteActive) setSelectedMatchId(match.id);
                }}
                disabled={isRouteActive}
                accessibilityRole="radio"
                accessibilityState={{ selected: selectedMatchId === match.id }}
              >
                <Text style={styles.matchOptionText}>{match.school || match.zone || match.id}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

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
            <Ionicons name="add-circle" size={28} color="#2196F3" />
            <Text style={styles.actionCardText}>Publicar Cupo</Text>
            <Text style={styles.actionCardSubtext}>Abre espacios</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('MultiSchoolRoute')}
          >
            <Ionicons name="git-network-outline" size={28} color="#FF9800" />
            <Text style={styles.actionCardText}>Rutas Multi-Colegio</Text>
            <Text style={styles.actionCardSubtext}>Paradas y ETA</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Search')}>
            <Ionicons name="search" size={28} color="#4CAF50" />
            <Text style={styles.actionCardText}>Ver Solicitudes</Text>
            <Text style={styles.actionCardSubtext}>Búsquedas padres</Text>
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
          <FlatList
            data={students}
            keyExtractor={(item, index) => String(item?.id ?? index)}
            style={styles.list}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item }) => <Text>{item?.name ?? 'Estudiante'}</Text>}
            showsVerticalScrollIndicator={false}
          />
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
  settingsButton: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
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
  opsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A237E',
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
    gap: 8,
    elevation: 3,
  },
  opsButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  list: {
    flex: 1,
  },
  listContainer: {
    paddingBottom: 20,
  },
  bigButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
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
  mapNavButton: {
    flexDirection: 'row',
    backgroundColor: '#FF6B35',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    elevation: 4,
  },
  mapNavButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
    marginLeft: 8,
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
    gap: 8,
    marginBottom: 25,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  actionCardText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
    marginTop: 6,
    textAlign: 'center',
  },
  actionCardSubtext: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
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
