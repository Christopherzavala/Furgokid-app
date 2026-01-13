import { reload, sendEmailVerification } from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import analyticsService from '../services/analyticsService';
import toastService from '../services/toastService';

const EmailVerificationScreen = () => {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const checkVerificationStatus = useCallback(async () => {
    try {
      setCheckingVerification(true);
      await reload(user);
      // Navigation will automatically update when emailVerified becomes true
    } catch (error) {
      console.log('Error checking verification:', error);
    } finally {
      setCheckingVerification(false);
    }
  }, [user]);

  useEffect(() => {
    // Auto-check verification status every 5 seconds
    const interval = setInterval(async () => {
      if (user && !checkingVerification) {
        await checkVerificationStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [user, checkingVerification, checkVerificationStatus]);

  useEffect(() => {
    // Cooldown timer for resend button
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleResendEmail = async () => {
    if (cooldown > 0) {
      toastService.info('Espera un momento', `Reintenta en ${cooldown}s.`);
      return;
    }

    try {
      setLoading(true);
      await sendEmailVerification(user);
      setCooldown(60); // 60 seconds cooldown
      toastService.success(
        'Email enviado',
        'Revisa bandeja de entrada y spam. El link vale 1 hora.'
      );
    } catch (error) {
      console.error('Error resending verification email:', error);

      let errorMessage = 'No pudimos enviar el email. Intenta nuevamente.';

      if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Demasiados intentos. Por favor espera unos minutos.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Sin conexión a internet. Verifica tu red.';
      }

      toastService.error('No se pudo enviar', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckNow = async () => {
    setCheckingVerification(true);
    await checkVerificationStatus();

    if (user.emailVerified) {
      try {
        await analyticsService.trackCustomEvent('email_verified', {
          provider: user?.providerData?.[0]?.providerId,
        });
      } catch {
        // no-op
      }
      toastService.success('¡Email verificado!', 'Tu cuenta está activa.');
    } else {
      toastService.info('Aún no verificado', 'Abre el link del email y vuelve a intentar.');
    }
    setCheckingVerification(false);
  };

  const handleLogout = async () => {
    Alert.alert('Cerrar sesión', '¿Quieres cerrar sesión? Deberás verificar tu email más tarde.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: () => signOut(),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.iconText}>📧</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>Verifica tu email</Text>

        {/* Description */}
        <Text style={styles.description}>
          Enviamos un link de verificación a:{'\n'}
          <Text style={styles.email}>{user?.email}</Text>
        </Text>

        <Text style={styles.instructions}>
          1. Revisa tu bandeja de entrada{'\n'}
          2. Busca el email de FurgoKid{'\n'}
          3. Haz clic en el link de verificación{'\n'}
          4. Vuelve aquí y presiona "Ya verifiqué"
        </Text>

        {/* Check Status Button */}
        <TouchableOpacity
          style={[styles.buttonPrimary, checkingVerification && styles.buttonDisabled]}
          onPress={handleCheckNow}
          disabled={checkingVerification}
        >
          {checkingVerification ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonPrimaryText}>✓ Ya verifiqué mi email</Text>
          )}
        </TouchableOpacity>

        {/* Resend Email Button */}
        <TouchableOpacity
          style={[styles.buttonSecondary, (loading || cooldown > 0) && styles.buttonDisabled]}
          onPress={handleResendEmail}
          disabled={loading || cooldown > 0}
        >
          {loading ? (
            <ActivityIndicator color="#FF6B6B" />
          ) : (
            <Text style={styles.buttonSecondaryText}>
              {cooldown > 0 ? `Reenviar email (${cooldown}s)` : '↻ Reenviar email de verificación'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Help Text */}
        <Text style={styles.helpText}>
          ¿No encuentras el email?{'\n'}
          Revisa la carpeta de spam o correo no deseado
        </Text>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>

        {/* Auto-check indicator */}
        {checkingVerification && (
          <View style={styles.autoCheckIndicator}>
            <ActivityIndicator size="small" color="#4ECDC4" />
            <Text style={styles.autoCheckText}>Verificando automáticamente...</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  iconText: {
    fontSize: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#546E7A',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  email: {
    fontWeight: 'bold',
    color: '#4ECDC4',
  },
  instructions: {
    fontSize: 14,
    color: '#78909C',
    textAlign: 'left',
    marginVertical: 24,
    lineHeight: 22,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4ECDC4',
    width: '100%',
  },
  buttonPrimary: {
    backgroundColor: '#4ECDC4',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonSecondary: {
    backgroundColor: '#FFF',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FF6B6B',
    marginBottom: 24,
  },
  buttonSecondaryText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  helpText: {
    fontSize: 13,
    color: '#90A4AE',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  logoutButton: {
    marginTop: 8,
    paddingVertical: 12,
  },
  logoutText: {
    color: '#B0BEC5',
    fontSize: 14,
    textDecoration: 'underline',
  },
  autoCheckIndicator: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F7FA',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  autoCheckText: {
    color: '#00838F',
    fontSize: 12,
    marginLeft: 8,
  },
});

export default EmailVerificationScreen;
