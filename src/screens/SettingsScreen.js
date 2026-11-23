// SettingsScreen.js - Pantalla de Configuración y Preferencias de Alertas
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import {
  DEFAULT_ALERT_PREFERENCES,
  fetchAlertPreferences,
  saveAlertPreferences,
} from '../services/alertPreferencesService';
import toastService from '../services/toastService';

const SettingsScreen = ({ navigation }) => {
  const { user, userProfile, signOut } = useAuth();
  const [alertPrefs, setAlertPrefs] = useState(DEFAULT_ALERT_PREFERENCES);
  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    let active = true;
    if (user?.uid) {
      fetchAlertPreferences(user.uid)
        .then((prefs) => {
          if (active) setAlertPrefs(prefs);
        })
        .finally(() => {
          if (active) setLoadingPrefs(false);
        });
    } else {
      setLoadingPrefs(false);
    }
    return () => {
      active = false;
    };
  }, [user?.uid]);

  const handleTogglePref = async (key) => {
    const updated = { ...alertPrefs, [key]: !alertPrefs[key] };
    setAlertPrefs(updated);
    try {
      setSavingPrefs(true);
      await saveAlertPreferences(updated);
      toastService.success('Preferencias actualizadas', 'Tus alertas de viaje han sido guardadas.');
    } catch (error) {
      toastService.error('Error', error.message || 'No se pudieron guardar las preferencias.');
      // Revert on error
      setAlertPrefs(alertPrefs);
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que deseas cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          try {
            const result = await signOut();
            if (!result?.success) {
              throw new Error(result?.error || 'unknown');
            }
            toastService.success('Sesión cerrada', 'Has cerrado sesión correctamente.');
          } catch {
            toastService.error('Error', 'No se pudo cerrar la sesión.');
          }
        },
      },
    ]);
  };

  const urls = {
    privacyPolicy:
      Constants.expoConfig?.extra?.privacyPolicyUrl ||
      'https://christopherzavala.github.io/Furgokid-app/docs/privacy-policy.html',
    termsOfService:
      Constants.expoConfig?.extra?.termsOfServiceUrl ||
      'https://christopherzavala.github.io/Furgokid-app/docs/terms-of-service.html',
  };

  const openUrl = async (url) => {
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) {
        toastService.error('No se pudo abrir', 'Verifica tu conexión e intenta nuevamente.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      toastService.error('No se pudo abrir', 'Intenta nuevamente en unos segundos.');
    }
  };

  const renderSettingItem = (icon, title, subtitle, onPress) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={24} color="#2196F3" />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <LinearGradient colors={['#2196F3', '#1976D2']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Volver"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTextBlock}>
            <Text style={styles.headerTitle}>Configuración</Text>
            <Text style={styles.headerSubtitle}>Privacidad, alertas y cuenta</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cuenta</Text>
          {renderSettingItem(
            'person-circle',
            'Perfil de Usuario',
            'Editar información personal',
            () =>
              navigation.navigate(
                userProfile?.role === 'driver' ? 'DriverProfile' : 'ParentProfile'
              )
          )}
          {renderSettingItem(
            'settings-outline',
            'Preferencias de Consentimiento',
            'Gestiona analítica y anuncios',
            () => navigation.navigate('ConsentPreferences')
          )}
        </View>

        {/* NOTIFICATION PREFERENCES SECTION (#8) */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Preferencias de Alertas (Push)</Text>
            {savingPrefs && <ActivityIndicator size="small" color="#2196F3" />}
          </View>

          {loadingPrefs ? (
            <ActivityIndicator style={{ marginVertical: 10 }} color="#2196F3" />
          ) : (
            <View style={styles.card}>
              <View style={styles.switchRow}>
                <View style={styles.switchTextContainer}>
                  <Text style={styles.switchTitle}>Abordaje y Tránsito</Text>
                  <Text style={styles.switchSub}>
                    Avisos cuando el estudiante aborda o inicia viaje
                  </Text>
                </View>
                <Switch
                  value={alertPrefs.boardingAlert}
                  onValueChange={() => handleTogglePref('boardingAlert')}
                  trackColor={{ false: '#ddd', true: '#90CAF9' }}
                  thumbColor={alertPrefs.boardingAlert ? '#2196F3' : '#f4f3f4'}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchTextContainer}>
                  <Text style={styles.switchTitle}>Cercanía y ETA</Text>
                  <Text style={styles.switchSub}>
                    Alertas cuando el furgón se aproxima (~5 min)
                  </Text>
                </View>
                <Switch
                  value={alertPrefs.etaProximityAlert}
                  onValueChange={() => handleTogglePref('etaProximityAlert')}
                  trackColor={{ false: '#ddd', true: '#90CAF9' }}
                  thumbColor={alertPrefs.etaProximityAlert ? '#2196F3' : '#f4f3f4'}
                />
              </View>

              <View style={styles.switchRow}>
                <View style={styles.switchTextContainer}>
                  <Text style={styles.switchTitle}>Llegada y Entrega (OTP)</Text>
                  <Text style={styles.switchSub}>Avisos al confirmar llegada y entrega segura</Text>
                </View>
                <Switch
                  value={alertPrefs.handoverAlert}
                  onValueChange={() => handleTogglePref('handoverAlert')}
                  trackColor={{ false: '#ddd', true: '#90CAF9' }}
                  thumbColor={alertPrefs.handoverAlert ? '#2196F3' : '#f4f3f4'}
                />
              </View>

              <View style={[styles.switchRow, { borderBottomWidth: 0 }]}>
                <View style={styles.switchTextContainer}>
                  <Text style={styles.switchTitle}>Avisos de Ausencia</Text>
                  <Text style={styles.switchSub}>
                    Confirmación y omisión de paradas por inasistencia
                  </Text>
                </View>
                <Switch
                  value={alertPrefs.absenceAlert}
                  onValueChange={() => handleTogglePref('absenceAlert')}
                  trackColor={{ false: '#ddd', true: '#90CAF9' }}
                  thumbColor={alertPrefs.absenceAlert ? '#2196F3' : '#f4f3f4'}
                />
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacidad y Datos</Text>
          {renderSettingItem(
            'shield-checkmark',
            'Centro de Privacidad (GDPR)',
            'Exportar datos o eliminar cuenta',
            () => navigation.navigate('GDPRSettings')
          )}
          {renderSettingItem(
            'document-text',
            'Política de Privacidad',
            'Leer la política vigente',
            () => openUrl(urls.privacyPolicy)
          )}
          {renderSettingItem(
            'reader',
            'Términos de Servicio',
            'Condiciones de uso de FurgoKid',
            () => openUrl(urls.termsOfService)
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Soporte</Text>
          {renderSettingItem(
            'help-circle',
            'Ayuda y Soporte',
            'Preguntas frecuentes y contacto',
            async () => {
              const url = 'mailto:privacy@furgokid.com';
              const can = await Linking.canOpenURL(url);
              if (!can) {
                toastService.info('Contacto', 'Escríbenos a privacy@furgokid.com');
                return;
              }
              await Linking.openURL(url);
            }
          )}
          {renderSettingItem(
            'information-circle',
            'Acerca de FurgoKid',
            'Versión y términos de uso',
            () => toastService.info('FurgoKid v1.0.0', 'Transporte escolar seguro.')
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTextBlock: {
    flex: 1,
    paddingHorizontal: 12,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginLeft: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  switchTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  switchTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  switchSub: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default SettingsScreen;
