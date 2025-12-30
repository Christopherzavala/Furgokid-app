import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { deleteUserAccount, exportUserData, getUserDataSummary } from '../services/gdprService';
import logger from '../utils/logger';

/**
 * GDPRSettingsScreen - Data Privacy Management
 *
 * Provides GDPR-compliant data controls:
 * - Export Data (Right to Data Portability)
 * - Delete Account (Right to Erasure)
 * - View Data Summary (Right of Access)
 *
 * Legal Basis:
 * - GDPR Articles 15, 17, 20
 * - COPPA requirements for children's data
 */

const GDPRSettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dataSummary, setDataSummary] = useState<any>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  /**
   * Load data summary
   */
  const loadDataSummary = async () => {
    if (!user?.uid) return;

    setSummaryLoading(true);
    try {
      const summary = await getUserDataSummary(user.uid);
      setDataSummary(summary);
    } catch (error) {
      Alert.alert('Error', 'No se pudo cargar el resumen de datos');
      logger.error('Failed to load data summary', { error });
    } finally {
      setSummaryLoading(false);
    }
  };

  /**
   * Export user data as JSON file
   */
  const handleExportData = async () => {
    if (!user?.uid) return;

    Alert.alert(
      'Exportar Datos',
      'Exportaremos todos tus datos en formato JSON. Esto puede tomar unos segundos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Exportar',
          onPress: async () => {
            setLoading(true);
            try {
              const userData = await exportUserData(user.uid);
              const jsonData = JSON.stringify(userData, null, 2);

              // Share/Download the data
              if (Platform.OS === 'web') {
                // Web: Download as file
                const blob = new Blob([jsonData], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `furgokid-data-${user.uid}-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
              } else {
                // Mobile: Share
                await Share.share({
                  message: jsonData,
                  title: 'Mis Datos - FurgoKid',
                });
              }

              Alert.alert('Datos Exportados', 'Tus datos han sido exportados exitosamente.');

              logger.info('User data exported', { userId: user.uid });
            } catch (error) {
              Alert.alert('Error', 'No se pudo exportar los datos');
              logger.error('Failed to export user data', { error });
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  /**
   * Delete user account permanently
   */
  const handleDeleteAccount = async () => {
    if (!user?.uid) return;

    Alert.alert(
      '⚠️ Eliminar Cuenta',
      'Esta acción es PERMANENTE e IRREVERSIBLE.\n\n' +
        'Se eliminarán:\n' +
        '• Tu perfil y cuenta\n' +
        '• Todas tus rutas\n' +
        '• Todas tus solicitudes\n' +
        '• Todo tu historial\n' +
        '• Todos tus archivos\n\n' +
        '¿Estás absolutamente seguro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar Mi Cuenta',
          style: 'destructive',
          onPress: () => confirmDeleteAccount(),
        },
      ]
    );
  };

  /**
   * Second confirmation for account deletion
   */
  const confirmDeleteAccount = () => {
    Alert.alert(
      'Última Confirmación',
      'Escribe "ELIMINAR" para confirmar que deseas borrar tu cuenta permanentemente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'ELIMINAR',
          style: 'destructive',
          onPress: async () => {
            if (!user?.uid) return;

            setLoading(true);
            try {
              await deleteUserAccount(user.uid);

              Alert.alert(
                'Cuenta Eliminada',
                'Tu cuenta y todos tus datos han sido eliminados permanentemente.',
                [
                  {
                    text: 'OK',
                    onPress: async () => {
                      await logout();
                      // Navigate to welcome screen
                      navigation.reset({
                        index: 0,
                        routes: [{ name: 'Welcome' }],
                      });
                    },
                  },
                ]
              );

              logger.warn('User account deleted by user request', {
                userId: user.uid,
              });
            } catch (error) {
              Alert.alert(
                'Error',
                'No se pudo eliminar la cuenta completamente. Por favor contacta soporte.'
              );
              logger.error('Failed to delete user account', { error });
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  /**
   * View privacy policy
   */
  const viewPrivacyPolicy = () => {
    navigation.navigate('PrivacyPolicy');
  };

  /**
   * Contact support
   */
  const contactSupport = () => {
    Alert.alert('Contactar Soporte', 'Puedes contactarnos en:\n\nprivacy@furgokid.com', [
      {
        text: 'OK',
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="shield-checkmark" size={48} color="#4A90E2" />
        <Text style={styles.title}>Privacidad y Datos</Text>
        <Text style={styles.subtitle}>Controla tu información personal según GDPR y COPPA</Text>
      </View>

      {/* Data Summary */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Resumen de Datos</Text>
          <TouchableOpacity onPress={loadDataSummary} disabled={summaryLoading}>
            <Ionicons name="refresh" size={24} color={summaryLoading ? '#CCC' : '#4A90E2'} />
          </TouchableOpacity>
        </View>

        {summaryLoading ? (
          <ActivityIndicator size="small" color="#4A90E2" />
        ) : dataSummary ? (
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{dataSummary.routesCount}</Text>
              <Text style={styles.summaryLabel}>Rutas</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{dataSummary.requestsCount}</Text>
              <Text style={styles.summaryLabel}>Solicitudes</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{dataSummary.trackingPointsCount}</Text>
              <Text style={styles.summaryLabel}>Ubicaciones</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{dataSummary.vacanciesCount}</Text>
              <Text style={styles.summaryLabel}>Vacantes</Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.loadButton} onPress={loadDataSummary}>
            <Text style={styles.loadButtonText}>Cargar Resumen</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Your Rights */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tus Derechos (GDPR)</Text>

        {/* Right to Access */}
        <TouchableOpacity style={styles.rightItem} onPress={viewPrivacyPolicy} disabled={loading}>
          <Ionicons name="eye" size={24} color="#4A90E2" />
          <View style={styles.rightContent}>
            <Text style={styles.rightTitle}>Derecho de Acceso</Text>
            <Text style={styles.rightDescription}>Ver qué información tenemos sobre ti</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#CCC" />
        </TouchableOpacity>

        {/* Right to Data Portability */}
        <TouchableOpacity style={styles.rightItem} onPress={handleExportData} disabled={loading}>
          <Ionicons name="download" size={24} color="#4A90E2" />
          <View style={styles.rightContent}>
            <Text style={styles.rightTitle}>Derecho a la Portabilidad</Text>
            <Text style={styles.rightDescription}>Exportar todos tus datos en formato JSON</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#CCC" />
        </TouchableOpacity>

        {/* Right to Erasure */}
        <TouchableOpacity
          style={[styles.rightItem, styles.dangerItem]}
          onPress={handleDeleteAccount}
          disabled={loading}
        >
          <Ionicons name="trash" size={24} color="#E53935" />
          <View style={styles.rightContent}>
            <Text style={[styles.rightTitle, styles.dangerText]}>Derecho al Olvido</Text>
            <Text style={styles.rightDescription}>Eliminar permanentemente tu cuenta y datos</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#CCC" />
        </TouchableOpacity>
      </View>

      {/* Additional Options */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información Adicional</Text>

        <TouchableOpacity style={styles.optionItem} onPress={viewPrivacyPolicy}>
          <Ionicons name="document-text" size={24} color="#666" />
          <Text style={styles.optionText}>Política de Privacidad</Text>
          <Ionicons name="chevron-forward" size={24} color="#CCC" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionItem} onPress={contactSupport}>
          <Ionicons name="mail" size={24} color="#666" />
          <Text style={styles.optionText}>Contactar Soporte de Privacidad</Text>
          <Ionicons name="chevron-forward" size={24} color="#CCC" />
        </TouchableOpacity>
      </View>

      {/* Legal Info */}
      <View style={styles.legalBox}>
        <Ionicons name="information-circle" size={20} color="#666" />
        <Text style={styles.legalText}>
          Cumplimos con GDPR (UE) y COPPA (USA). Tus datos están protegidos con encriptación de
          extremo a extremo. Respondemos a solicitudes de privacidad en 30 días.
        </Text>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={styles.loadingText}>Procesando...</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  section: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  loadButton: {
    backgroundColor: '#4A90E2',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  loadButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  rightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  rightContent: {
    flex: 1,
    marginLeft: 12,
  },
  rightTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  rightDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  dangerItem: {
    borderBottomWidth: 0,
  },
  dangerText: {
    color: '#E53935',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  legalBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  legalText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 12,
    color: '#555',
    lineHeight: 18,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 12,
  },
});

export default GDPRSettingsScreen;
