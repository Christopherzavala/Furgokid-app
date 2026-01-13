import { useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import toastService from '../services/toastService';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localLoading, setLocalLoading] = useState(false);
  const { signIn, loading: authLoading } = useAuth();

  // Email validation
  const validateEmail = (candidate) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(candidate);
  };

  const handleLogin = async () => {
    if (!email || !password) {
      toastService.info('Campos incompletos', 'Ingresa email y contraseña.');
      return;
    }
    if (!validateEmail(email)) {
      toastService.error('Email inválido', 'Por favor ingresa un email válido.');
      return;
    }
    setLocalLoading(true);
    const result = await signIn(email.trim(), password);
    if (result.success) {
      // Navigate is handled by auth state listener
    } else {
      let message = result.error || 'Error al iniciar sesión.';
      if (result.error?.includes('auth/invalid-email')) {
        message = 'Email inválido.';
      } else if (result.error?.includes('auth/user-not-found')) {
        message = 'Usuario no encontrado.';
      } else if (result.error?.includes('auth/wrong-password')) {
        message = 'Contraseña incorrecta.';
      } else if (result.error?.includes('network')) {
        message = 'Problema de red. Intenta nuevamente.';
      }
      toastService.error('Error de inicio de sesión', message);
    }
    setLocalLoading(false);
  };

  const isLoading = localLoading || authLoading;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FurgoKid</Text>
      <TextInput
        placeholder="Email"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!isLoading}
        placeholderTextColor="#999"
        accessible={true}
        accessibilityLabel="Campo de email"
        accessibilityHint="Ingresa tu dirección de correo electrónico"
      />
      <TextInput
        placeholder="Contraseña"
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!isLoading}
        placeholderTextColor="#999"
        accessible={true}
        accessibilityLabel="Campo de contraseña"
        accessibilityHint="Ingresa tu contraseña"
      />
      {isLoading ? (
        <ActivityIndicator size="large" color="#2c3e50" style={{ marginVertical: 20 }} />
      ) : (
        <Button title="Entrar" onPress={handleLogin} color="#2c3e50" disabled={isLoading} />
      )}
      <Text style={styles.linkText} onPress={() => !isLoading && navigation.navigate('Register')}>
        ¿No tienes cuenta? Regístrate aquí
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
    color: '#f1c40f',
  },
  input: {
    borderBottomWidth: 1,
    borderColor: '#ccc',
    marginBottom: 20,
    padding: 10,
    fontSize: 16,
  },
  linkText: {
    marginTop: 20,
    textAlign: 'center',
    color: 'blue',
    fontSize: 14,
  },
});
