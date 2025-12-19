// LoginScreen.js - Pantalla de Login Profesional
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import useAuth from '../hooks/useAuth';
import { handleFirebaseError } from '../utils/errorHandler';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('Christopher.zaval4@gmail.com');
  const [password, setPassword] = useState('Chrisdaniel94');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState('parent'); // 'parent' or 'driver'
  const [showPassword, setShowPassword] = useState(false);

  const { login, signup, loading } = useAuth(); // Usando el hook actualizado

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password) => {
    return password.length >= 6;
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor ingresa email y contraseña');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Error', 'Por favor ingresa un email válido');
      return;
    }

    if (!validatePassword(password)) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          Alert.alert('Error', 'Las contraseñas no coinciden');
          return;
        }

        const result = await signup(email, password, role);
        if (result.success) {
          Alert.alert('¡Éxito!', 'Cuenta creada correctamente.');
        } else {
          // El error ya se maneja en el hook pero podemos mostrar alert extra si falla algo muy específico
        }
      } else {
        await login(email, password);
      }
    } catch (error) {
      // Errores no capturados por el hook
      Alert.alert('Error', handleFirebaseError(error));
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setPassword('');
    setConfirmPassword('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={['#2196F3', '#1976D2']}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              onError={() => { }}
            />
            <Text style={styles.title}>FurgoKid</Text>
            <Text style={styles.subtitle}>
              Sistema de Rastreo Escolar
            </Text>
          </View>

          <View style={styles.form}>
            {/* EMAIL INPUT */}
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* PASSWORD INPUT */}
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Contraseña"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? 'eye-off' : 'eye'}
                  size={24}
                  color="#666"
                />
              </TouchableOpacity>
            </View>

            {/* CONFIRM PASSWORD & ROLE (SIGN UP ONLY) */}
            {isSignUp && (
              <>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Confirmar Contraseña"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                </View>

                {/* ROLE SELECTOR */}
                <View style={styles.roleContainer}>
                  <Text style={styles.roleLabel}>Quiero registrarme como:</Text>
                  <View style={styles.roleButtons}>
                    <TouchableOpacity
                      style={[styles.roleButton, role === 'parent' && styles.roleButtonActive]}
                      onPress={() => setRole('parent')}
                    >
                      <Ionicons name="people" size={20} color={role === 'parent' ? '#fff' : '#666'} />
                      <Text style={[styles.roleButtonText, role === 'parent' && styles.roleButtonTextActive]}>Padre/Madre</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.roleButton, role === 'driver' && styles.roleButtonActive]}
                      onPress={() => setRole('driver')}
                    >
                      <Ionicons name="bus" size={20} color={role === 'driver' ? '#fff' : '#666'} />
                      <Text style={[styles.roleButtonText, role === 'driver' && styles.roleButtonTextActive]}>Conductor</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            {/* SUBMIT BUTTON */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
                </Text>
              )}
            </TouchableOpacity>

            {/* TOGGLE MODE */}
            <TouchableOpacity
              style={styles.switchButton}
              onPress={toggleMode}
            >
              <Text style={styles.switchText}>
                {isSignUp
                  ? '¿Ya tienes cuenta? Inicia Sesión'
                  : '¿No tienes cuenta? Regístrate'
                }
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.features}>
            <Text style={styles.featuresTitle}>Características de FurgoKid:</Text>
            <View style={styles.feature}>
              <Ionicons name="location" size={20} color="#fff" />
              <Text style={styles.featureText}>Seguimiento GPS en tiempo real</Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="shield-checkmark" size={20} color="#fff" />
              <Text style={styles.featureText}>Máxima seguridad para niños</Text>
            </View>
            <View style={styles.feature}>
              <Ionicons name="notifications" size={20} color="#fff" />
              <Text style={styles.featureText}>Notificaciones automáticas</Text>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: 15,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#E3F2FD',
    textAlign: 'center',
  },
  form: {
    backgroundColor: '#fff',
    padding: 25,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 15,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonDisabled: {
    backgroundColor: '#90CAF9',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  switchButton: {
    alignItems: 'center',
    padding: 10,
  },
  switchText: {
    color: '#2196F3',
    fontSize: 16,
  },
  features: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    borderRadius: 15,
  },
  featuresTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    color: '#E3F2FD',
    marginLeft: 10,
    fontSize: 14,
  },
  roleContainer: {
    marginBottom: 20,
  },
  roleLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    marginLeft: 5,
  },
  roleButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  roleButton: {
    flex: 0.48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
  },
  roleButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  roleButtonText: {
    marginLeft: 8,
    color: '#666',
    fontWeight: '500',
  },
  roleButtonTextActive: {
    color: '#fff',
  },
});

export default LoginScreen;