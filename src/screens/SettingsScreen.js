// SettingsScreen.js - Pantalla de Configuración
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '../config/firebase';
import { signOut } from 'firebase/auth';

const SettingsScreen = ({ navigation }) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationTrackingEnabled, setLocationTrackingEnabled] = useState(true);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      Alert.alert('Sesión cerrada', 'Has cerrado sesión correctamente.');
    } catch (error) {
      Alert.alert('Error', 'No se pudo cerrar la sesión.');
    }
  };

  const renderSettingItem = (icon, title, subtitle, onPress, showSwitch = false, switchValue = false, onSwitchChange = null) => (
    <TouchableOpacity 
      style={styles.settingItem} 
      onPress={onPress}
      disabled={showSwitch}
    >
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={24} color="#2196F3" />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {showSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: '#ddd', true: '#90CAF9' }}
          thumbColor={switchValue ? '#2196F3' : '#f4f3f4'}
        />
      ) : (
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      )}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={['#2196F3', '#1976D2']} style={styles.header}>
        <Text style={styles.headerTitle}>Configuración</Text>
        <Text style={styles.headerSubtitle}>Personaliza tu experiencia FurgoKid</Text>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cuenta</Text>
          {renderSettingItem(
            'person-circle',
            'Perfil de Usuario',
            'Editar información personal',
            () => Alert.alert('Función', 'Configuración de perfil próximamente')
          )}
          {renderSettingItem(
            'shield-checkmark',
            'Seguridad',
            'Gestionar seguridad de la cuenta',
            () => Alert.alert('Función', 'Configuración de seguridad próximamente')
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notificaciones</Text>
          {renderSettingItem(
            'notifications',
            'Activar Notificaciones',
            'Recibir alertas en tiempo real',
            null,
            true,
            notificationsEnabled,
            setNotificationsEnabled
          )}
          {renderSettingItem(
            'location',
            'Seguimiento GPS',
            'Permitir acceso a ubicación',
            null,
            true,
            locationTrackingEnabled,
            setLocationTrackingEnabled
          )}
          {renderSettingItem(
            'refresh',
            'Actualización Automática',
            'Actualizar datos automáticamente',
            null,
            true,
            autoRefreshEnabled,
            setAutoRefreshEnabled
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Soporte</Text>
          {renderSettingItem(
            'help-circle',
            'Ayuda y Soporte',
            'Preguntas frecuentes y contacto',
            () => Alert.alert('Función', 'Centro de ayuda próximamente')
          )}
          {renderSettingItem(
            'information-circle',
            'Acerca de FurgoKid',
            'Versión y términos de uso',
            () => Alert.alert('FurgoKid v1.0', 'Sistema de Rastreo Escolar')
          )}
          {renderSettingItem(
            'document-text',
            'Términos y Privacidad',
            'Leer políticas de uso',
            () => Alert.alert('Función', 'Términos de uso próximamente')
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.dangerButton]}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out" size={20} color="#fff" />
            <Text style={styles.actionButtonText}>Cerrar Sesión</Text>
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
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    marginLeft: 5,
  },
  settingItem: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  actions: {
    marginTop: 20,
  },
  actionButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dangerButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#F44336',
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default SettingsScreen;