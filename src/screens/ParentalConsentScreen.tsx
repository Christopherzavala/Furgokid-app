import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import toastService from '../services/toastService';
import logger from '../utils/logger';
import secureStorage from '../utils/secureStorage';

/**
 * ParentalConsentScreen - COPPA Compliance
 *
 * Required by COPPA (Children's Online Privacy Protection Act) for apps
 * that collect personal information from children under 13.
 *
 * Features:
 * - Age verification
 * - Parental consent collection
 * - Clear privacy information
 * - Audit trail (consent timestamp)
 *
 * Legal Requirements:
 * - COPPA (USA): Required for children under 13
 * - GDPR (EU): Required for children under 16
 * - FTC fines: Up to $43,280 per violation
 */

interface ParentalConsentScreenProps {
  navigation: any;
  route: {
    params: {
      userRole: 'parent' | 'driver';
      childAge?: number;
    };
  };
}

const ParentalConsentScreen: React.FC<ParentalConsentScreenProps> = ({ navigation, route }) => {
  const { userRole, childAge } = route.params;

  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [childName, setChildName] = useState('');
  const [childDateOfBirth, setChildDateOfBirth] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);

  /**
   * Validate age to determine if parental consent is required
   * COPPA: Under 13 requires consent
   * GDPR: Under 16 requires consent (we use stricter COPPA rule)
   */
  const calculateAge = (dob: string): number => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  };

  /**
   * Validate email format
   */
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  /**
   * Validate date format (YYYY-MM-DD)
   */
  const isValidDate = (date: string): boolean => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return false;

    const parsed = new Date(date);
    return parsed instanceof Date && !isNaN(parsed.getTime());
  };

  /**
   * Save parental consent to encrypted storage
   * This creates an audit trail for compliance
   */
  const saveParentalConsent = async () => {
    try {
      const consent = {
        parentName,
        parentEmail,
        childName,
        childDateOfBirth,
        childAge: calculateAge(childDateOfBirth),
        consentDate: new Date().toISOString(),
        ipAddress: 'N/A', // TODO: Get IP if needed for audit
        appVersion: '1.0.0',
        consentVersion: '1.0',
        agreedToTerms: true,
        agreedToPrivacy: true,
      };

      await secureStorage.setObject('parental_consent', consent);

      logger.info('Parental consent recorded', {
        parentEmail,
        childAge: consent.childAge,
        consentDate: consent.consentDate,
      });

      return consent;
    } catch (error) {
      logger.error('Failed to save parental consent', { error });
      throw error;
    }
  };

  /**
   * Handle consent submission
   */
  const handleSubmitConsent = async () => {
    // Validation
    if (!parentName.trim()) {
      toastService.info('Falta información', 'Por favor ingresa el nombre del padre/tutor');
      return;
    }

    if (!parentEmail.trim() || !isValidEmail(parentEmail)) {
      toastService.error('Email inválido', 'Por favor ingresa un email válido del padre/tutor');
      return;
    }

    if (!childName.trim()) {
      toastService.info('Falta información', 'Por favor ingresa el nombre del niño/a');
      return;
    }

    if (!childDateOfBirth.trim() || !isValidDate(childDateOfBirth)) {
      toastService.error('Fecha inválida', 'Ingresa la fecha de nacimiento (formato: AAAA-MM-DD)');
      return;
    }

    const age = calculateAge(childDateOfBirth);
    if (age < 0 || age > 18) {
      toastService.error('Edad inválida', 'La edad del niño/a debe estar entre 0 y 18 años');
      return;
    }

    if (!agreedToTerms) {
      toastService.info('Requerido', 'Debes aceptar los Términos de Servicio');
      return;
    }

    if (!agreedToPrivacy) {
      toastService.info('Requerido', 'Debes aceptar la Política de Privacidad');
      return;
    }

    setLoading(true);

    try {
      const consent = await saveParentalConsent();

      Alert.alert(
        'Consentimiento Registrado',
        `Gracias ${parentName}. Hemos registrado tu consentimiento para que ${childName} use FurgoKid.`,
        [
          {
            text: 'Continuar',
            onPress: () => {
              // Navigate to next screen (e.g., complete registration)
              navigation.navigate('CompleteProfile', {
                userRole,
                parentalConsent: consent,
              });
            },
          },
        ]
      );
    } catch (error) {
      toastService.error(
        'Error',
        'No pudimos guardar el consentimiento. Por favor intenta nuevamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle skip (only allowed for users 13+)
   */
  const handleSkip = () => {
    if (childAge && childAge >= 13) {
      navigation.navigate('CompleteProfile', { userRole });
    } else {
      Alert.alert(
        'Consentimiento Requerido',
        'Por ley (COPPA), los menores de 13 años requieren consentimiento parental para usar esta aplicación.'
      );
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="shield-checkmark" size={64} color="#4A90E2" />
        <Text style={styles.title}>Consentimiento Parental</Text>
        <Text style={styles.subtitle}>Requerido por COPPA para proteger a los menores</Text>
      </View>

      {/* Information Box */}
      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={24} color="#4A90E2" />
        <Text style={styles.infoText}>
          FurgoKid transporta niños y recopila información personal. Por ley federal (COPPA),
          necesitamos el consentimiento de un padre o tutor legal para usuarios menores de 13 años.
        </Text>
      </View>

      {/* Parent Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información del Padre/Tutor</Text>

        <Text style={styles.label}>Nombre completo del padre/tutor *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: María García"
          value={parentName}
          onChangeText={setParentName}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Email del padre/tutor *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: maria@example.com"
          value={parentEmail}
          onChangeText={setParentEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      {/* Child Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Información del Niño/a</Text>

        <Text style={styles.label}>Nombre completo del niño/a *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Carlos García"
          value={childName}
          onChangeText={setChildName}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Fecha de nacimiento (AAAA-MM-DD) *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: 2015-03-25"
          value={childDateOfBirth}
          onChangeText={setChildDateOfBirth}
          keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
        />
        <Text style={styles.hint}>
          Formato: Año-Mes-Día (ejemplo: 2015-03-25 para 25 de marzo de 2015)
        </Text>
      </View>

      {/* Privacy Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Qué información recopilamos</Text>
        <View style={styles.bulletList}>
          <Text style={styles.bullet}>• Nombre y edad del niño/a</Text>
          <Text style={styles.bullet}>• Ubicación durante el transporte (GPS)</Text>
          <Text style={styles.bullet}>• Información de contacto del padre/tutor</Text>
          <Text style={styles.bullet}>• Información del conductor asignado</Text>
        </View>

        <Text style={styles.sectionTitle}>Cómo protegemos la información</Text>
        <View style={styles.bulletList}>
          <Text style={styles.bullet}>• Encriptación de extremo a extremo</Text>
          <Text style={styles.bullet}>• Almacenamiento seguro en Firebase</Text>
          <Text style={styles.bullet}>• Acceso limitado solo a padres y conductor asignado</Text>
          <Text style={styles.bullet}>• No compartimos datos con terceros sin consentimiento</Text>
        </View>
      </View>

      {/* Consent Checkboxes */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.checkbox} onPress={() => setAgreedToTerms(!agreedToTerms)}>
          <Ionicons
            name={agreedToTerms ? 'checkbox' : 'square-outline'}
            size={24}
            color="#4A90E2"
          />
          <Text style={styles.checkboxLabel}>
            Acepto los{' '}
            <Text style={styles.link} onPress={() => navigation.navigate('TermsOfService')}>
              Términos de Servicio
            </Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => setAgreedToPrivacy(!agreedToPrivacy)}
        >
          <Ionicons
            name={agreedToPrivacy ? 'checkbox' : 'square-outline'}
            size={24}
            color="#4A90E2"
          />
          <Text style={styles.checkboxLabel}>
            Acepto la{' '}
            <Text style={styles.link} onPress={() => navigation.navigate('PrivacyPolicy')}>
              Política de Privacidad
            </Text>
          </Text>
        </TouchableOpacity>
      </View>

      {/* Consent Statement */}
      <View style={styles.consentStatement}>
        <Text style={styles.consentText}>
          Al enviar este formulario, certifico que soy el padre, madre o tutor legal del niño/a
          mencionado y otorgo mi consentimiento para que FurgoKid recopile, use y almacene la
          información personal del niño/a según se describe en nuestra Política de Privacidad.
        </Text>
      </View>

      {/* Buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleSubmitConsent}
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>
            {loading ? 'Guardando...' : 'Otorgar Consentimiento'}
          </Text>
        </TouchableOpacity>

        {childAge && childAge >= 13 && (
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleSkip}
            disabled={loading}
          >
            <Text style={styles.secondaryButtonText}>Omitir (Mayor de 13 años)</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Legal Note */}
      <View style={styles.legalNote}>
        <Text style={styles.legalText}>
          Esta pantalla es requerida por la Ley de Protección de la Privacidad en Línea de los Niños
          (COPPA) de EE.UU. y el GDPR de la UE para proteger a los menores en línea.
        </Text>
      </View>
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
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
  section: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FAFAFA',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontStyle: 'italic',
  },
  bulletList: {
    marginTop: 8,
    marginBottom: 12,
  },
  bullet: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
    lineHeight: 20,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  link: {
    color: '#4A90E2',
    textDecorationLine: 'underline',
  },
  consentStatement: {
    backgroundColor: '#FFF9C4',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FBC02D',
    marginBottom: 24,
  },
  consentText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  buttons: {
    gap: 12,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#4A90E2',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4A90E2',
  },
  secondaryButtonText: {
    color: '#4A90E2',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  legalNote: {
    marginTop: 24,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  legalText: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default ParentalConsentScreen;
