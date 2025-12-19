import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import useAuth from '../hooks/useAuth';
import EmptyState from '../components/EmptyState';

const { width } = Dimensions.get('window');

const ParentHomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [children, setChildren] = useState([]); // Empty for now to show EmptyState

  useEffect(() => {
    // In the future, fetch children from Firestore here
  }, []);

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
            <Text style={styles.welcomeText}>
              {user?.isOffline ? 'Modo Offline' : 'Hola,'}
            </Text>
            <Text style={styles.userName}>{user?.email?.split('@')[0] || 'Padre'}</Text>
          </View>
          <TouchableOpacity style={styles.profileButton}>
            <Ionicons name="person-circle" size={40} color="#fff" />
          </TouchableOpacity>
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
          <TouchableOpacity style={styles.actionButton} onPress={() => { }}>
            <View style={[styles.iconContainer, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="add" size={24} color="#2196F3" />
            </View>
            <Text style={styles.actionText}>Agregar Hijo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('GPS')}>
            <View style={[styles.iconContainer, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="map" size={24} color="#4CAF50" />
            </View>
            <Text style={styles.actionText}>Ver Mapa</Text>
          </TouchableOpacity>
        </View>
      </View>
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