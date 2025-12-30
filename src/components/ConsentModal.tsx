/**
 * ConsentModal - Modal para solicitar consentimiento GDPR/COPPA
 */

import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import consentService, { ConsentPreferences } from '../services/consentService';

interface ConsentModalProps {
  visible: boolean;
  onComplete: (preferences: ConsentPreferences) => void;
}

const ConsentModal: React.FC<ConsentModalProps> = ({ visible, onComplete }) => {
  const [showCustomize, setShowCustomize] = useState(false);
  const [preferences, setPreferences] = useState({
    analytics: true,
    personalizedAds: true,
    location: true,
    notifications: true,
  });

  const handleAcceptAll = async () => {
    await consentService.acceptAll();
    onComplete(consentService.getPreferences());
  };

  const handleAcceptRequired = async () => {
    await consentService.acceptRequired();
    onComplete(consentService.getPreferences());
  };

  const handleSaveCustom = async () => {
    // Accept required first
    await consentService.acceptRequired();

    // Then update individual preferences
    await consentService.updatePreference('analyticsEnabled', preferences.analytics);
    await consentService.updatePreference('personalizedAdsEnabled', preferences.personalizedAds);
    await consentService.updatePreference('locationTrackingEnabled', preferences.location);
    await consentService.updatePreference('pushNotificationsEnabled', preferences.notifications);

    onComplete(consentService.getPreferences());
  };

  const openPrivacyPolicy = () => {
    Linking.openURL('https://furgokid.com/privacy');
  };

  const openTerms = () => {
    Linking.openURL('https://furgokid.com/terms');
  };

  if (showCustomize) {
    return (
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setShowCustomize(false)}>
                <Ionicons name="arrow-back" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.title}>Personalizar Preferencias</Text>
              <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content}>
              <View style={styles.optionCard}>
                <View style={styles.optionInfo}>
                  <Ionicons name="analytics" size={24} color="#2196F3" />
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>Análisis de Uso</Text>
                    <Text style={styles.optionDescription}>Nos ayuda a mejorar la aplicación</Text>
                  </View>
                </View>
                <Switch
                  value={preferences.analytics}
                  onValueChange={(value) => setPreferences({ ...preferences, analytics: value })}
                  trackColor={{ false: '#ddd', true: '#90CAF9' }}
                  thumbColor={preferences.analytics ? '#2196F3' : '#f4f3f4'}
                />
              </View>

              <View style={styles.optionCard}>
                <View style={styles.optionInfo}>
                  <Ionicons name="megaphone" size={24} color="#FF9800" />
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>Anuncios Personalizados</Text>
                    <Text style={styles.optionDescription}>
                      Mostrar anuncios relevantes para ti
                    </Text>
                  </View>
                </View>
                <Switch
                  value={preferences.personalizedAds}
                  onValueChange={(value) =>
                    setPreferences({ ...preferences, personalizedAds: value })
                  }
                  trackColor={{ false: '#ddd', true: '#FFCC80' }}
                  thumbColor={preferences.personalizedAds ? '#FF9800' : '#f4f3f4'}
                />
              </View>

              <View style={styles.optionCard}>
                <View style={styles.optionInfo}>
                  <Ionicons name="location" size={24} color="#4CAF50" />
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>Seguimiento de Ubicación</Text>
                    <Text style={styles.optionDescription}>
                      Necesario para el rastreo del transporte
                    </Text>
                  </View>
                </View>
                <Switch
                  value={preferences.location}
                  onValueChange={(value) => setPreferences({ ...preferences, location: value })}
                  trackColor={{ false: '#ddd', true: '#A5D6A7' }}
                  thumbColor={preferences.location ? '#4CAF50' : '#f4f3f4'}
                />
              </View>

              <View style={styles.optionCard}>
                <View style={styles.optionInfo}>
                  <Ionicons name="notifications" size={24} color="#9C27B0" />
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>Notificaciones Push</Text>
                    <Text style={styles.optionDescription}>
                      Alertas de llegada y actualizaciones
                    </Text>
                  </View>
                </View>
                <Switch
                  value={preferences.notifications}
                  onValueChange={(value) =>
                    setPreferences({ ...preferences, notifications: value })
                  }
                  trackColor={{ false: '#ddd', true: '#CE93D8' }}
                  thumbColor={preferences.notifications ? '#9C27B0' : '#f4f3f4'}
                />
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity style={styles.buttonPrimary} onPress={handleSaveCustom}>
                <Text style={styles.buttonPrimaryText}>Guardar Preferencias</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Ionicons name="shield-checkmark" size={48} color="#2196F3" />
            <Text style={styles.title}>Tu Privacidad Importa</Text>
          </View>

          <ScrollView style={styles.content}>
            <Text style={styles.description}>
              FurgoKid utiliza cookies y tecnologías similares para mejorar tu experiencia, mostrar
              anuncios personalizados y analizar el tráfico.
            </Text>

            <Text style={styles.description}>
              Puedes aceptar todas las opciones o personalizar tus preferencias.
            </Text>

            <View style={styles.linksContainer}>
              <TouchableOpacity onPress={openPrivacyPolicy}>
                <Text style={styles.link}>Política de Privacidad</Text>
              </TouchableOpacity>
              <Text style={styles.linkSeparator}>•</Text>
              <TouchableOpacity onPress={openTerms}>
                <Text style={styles.link}>Términos de Servicio</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.buttonPrimary}
              onPress={handleAcceptAll}
              accessible={true}
              accessibilityLabel="Aceptar todas las cookies"
              accessibilityRole="button"
            >
              <Text style={styles.buttonPrimaryText}>Aceptar Todo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.buttonSecondary}
              onPress={handleAcceptRequired}
              accessible={true}
              accessibilityLabel="Aceptar solo cookies necesarias"
              accessibilityRole="button"
            >
              <Text style={styles.buttonSecondaryText}>Solo Necesario</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.buttonText}
              onPress={() => setShowCustomize(true)}
              accessible={true}
              accessibilityLabel="Personalizar opciones de cookies"
              accessibilityRole="button"
            >
              <Text style={styles.buttonTextLabel}>Personalizar Opciones</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 24,
    paddingHorizontal: 20,
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  content: {
    padding: 20,
    maxHeight: 300,
  },
  description: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    marginBottom: 12,
  },
  linksContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  link: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '500',
  },
  linkSeparator: {
    marginHorizontal: 8,
    color: '#ccc',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  optionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionText: {
    marginLeft: 12,
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  optionDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  footer: {
    padding: 20,
    paddingBottom: 34,
    gap: 12,
  },
  buttonPrimary: {
    backgroundColor: '#2196F3',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonSecondaryText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonText: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonTextLabel: {
    color: '#2196F3',
    fontSize: 15,
    fontWeight: '500',
  },
});

export default ConsentModal;
