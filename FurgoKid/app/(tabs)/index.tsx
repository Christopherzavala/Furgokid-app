import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '@/src/config/firebase';
import { signOut } from 'firebase/auth';
import { router } from 'expo-router';
import { SmartBanner } from '@/components/ads/SmartBanner';
import { trackUserAction, loadInterstitialAd, showInterstitialAd } from '@/src/services/adMobService';

export default function HomeScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    // Preload interstitial ad for later use
    loadInterstitialAd();

    return () => clearInterval(timer);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate data refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2196F3']} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>¡Bienvenido!</Text>
          <Text style={styles.userEmail}>{auth.currentUser?.email}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Ionicons name="bus" size={32} color="#2196F3" />
          <Text style={styles.statusTitle}>Estado del Transporte</Text>
        </View>
        <View style={styles.statusInfo}>
          <View style={styles.statusItem}>
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            <Text style={styles.statusText}>Servicio Activo</Text>
          </View>
          <View style={styles.statusItem}>
            <Ionicons name="time" size={24} color="#2196F3" />
            <Text style={styles.statusText}>{currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Acciones Rápidas</Text>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={async () => {
            await trackUserAction();
            router.push('/(tabs)/gps');
          }}
        >
          <View style={styles.actionIcon}>
            <Ionicons name="location" size={28} color="#2196F3" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Ver Ubicación GPS</Text>
            <Text style={styles.actionSubtitle}>Rastrea el transporte en tiempo real</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={async () => {
            await trackUserAction();
            router.push('/(tabs)/driver');
          }}
        >
          <View style={styles.actionIcon}>
            <Ionicons name="person" size={28} color="#4CAF50" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Información del Conductor</Text>
            <Text style={styles.actionSubtitle}>Contacto y detalles del vehículo</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={async () => {
            await trackUserAction();
            router.push('/(tabs)/settings');
          }}
        >
          <View style={styles.actionIcon}>
            <Ionicons name="notifications" size={28} color="#FF9800" />
          </View>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Notificaciones</Text>
            <Text style={styles.actionSubtitle}>Configura alertas y avisos</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#999" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información de Seguridad</Text>
        <View style={styles.infoCard}>
          <Ionicons name="shield-checkmark" size={24} color="#4CAF50" />
          <Text style={styles.infoText}>
            Todos los datos están encriptados y protegidos. Tu información y la de tus hijos está segura.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>FurgoKid © 2025</Text>
        <Text style={styles.footerSubtext}>Sistema de Rastreo Escolar</Text>
        {/* Banner ad fixed at bottom */}
        <SmartBanner position="bottom" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  userEmail: {
    fontSize: 14,
    color: '#E3F2FD',
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
  },
  statusCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  statusInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  actionCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  infoCard: {
    backgroundColor: '#E8F5E9',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#2E7D32',
    marginLeft: 12,
    lineHeight: 20,
  },
  footer: {
    alignItems: 'center',
    padding: 20,
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '600',
  },
  footerSubtext: {
    fontSize: 12,
    color: '#bbb',
    marginTop: 4,
  },
});

