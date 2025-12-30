import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AdBannerComponent from '../components/AdBannerComponent';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';

const ParentHomeScreen = ({ navigation }) => {
  const { user, userProfile, signOut } = useAuth();
  const [children] = useState([]); // Empty for now to show EmptyState

  useEffect(() => {
    // In the future, fetch children from Firestore here
  }, []);

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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#2196F3" />

      {/* HEADER */}
      <LinearGradient
        colors={user?.isOffline ? ['#607D8B', '#455A64'] : ['#2196F3', '#1976D2']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.welcomeText}>{user?.isOffline ? 'Modo Offline' : 'Hola,'}</Text>
            <Text style={styles.userName}>{user?.email?.split('@')[0] || 'Padre'}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.profileButton}
              accessible={true}
              accessibilityLabel="Ver perfil"
              accessibilityRole="button"
            >
              <Ionicons name="person-circle" size={40} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              accessible={true}
              accessibilityLabel="Cerrar sesión"
              accessibilityRole="button"
            >
              <Ionicons name="log-out" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* CONTENT */}
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Mis Hijos</Text>

        {children.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No tienes hijos registrados"
            message="Agrega a tus hijos para comenzar a realizar el seguimiento de su transporte escolar."
          />
        ) : (
          <ScrollView contentContainerStyle={styles.listContainer}>
            {/* List implementation pending */}
            <Text>Lista de hijos...</Text>
          </ScrollView>
        )}

        {/* QUICK ACTIONS */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('ParentRequest')}
            accessible={true}
            accessibilityLabel="Publicar necesidad de transporte"
            accessibilityRole="button"
            accessibilityHint="Abrir pantalla para crear nueva solicitud de transporte"
          >
            <View style={[styles.iconContainer, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="add" size={24} color="#2196F3" />
            </View>
            <Text style={styles.actionText}>Publicar Necesidad</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Search')}
            accessible={true}
            accessibilityLabel="Buscar conductores disponibles"
            accessibilityRole="button"
            accessibilityHint="Abrir pantalla de búsqueda de conductores"
          >
            <View style={[styles.iconContainer, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="search" size={24} color="#4CAF50" />
            </View>
            <Text style={styles.actionText}>Buscar Conductores</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* BANNER AD - MONETIZACIÓN */}
      <AdBannerComponent
        placement="BANNER_HOME"
        userRole="parent"
        adsDisabled={Boolean(
          userProfile?.isPremium || userProfile?.subscriptionActive || userProfile?.noAds
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  welcomeText: {
    color: '#E3F2FD',
    fontSize: 14,
  },
  userName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  profileButton: {
    padding: 5,
  },
  logoutButton: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  listContainer: {
    paddingBottom: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 20,
  },
  actionButton: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    color: '#555',
    fontSize: 12,
  },
});

export default ParentHomeScreen;
