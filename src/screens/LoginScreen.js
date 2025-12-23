import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { auth } from '../config/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Campos incompletos', 'Ingresa email y contraseña.');
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      let message = 'Error al iniciar sesión.';
      switch (error?.code) {
        case 'auth/invalid-email': message = 'Email inválido.'; break;
        case 'auth/user-disabled': message = 'Usuario deshabilitado.'; break;
        case 'auth/user-not-found': message = 'Usuario no encontrado.'; break;
        case 'auth/wrong-password': message = 'Contraseña incorrecta.'; break;
        case 'auth/network-request-failed': message = 'Problema de red. Intenta nuevamente.'; break;
        default: message = 'No se pudo iniciar sesión. Revisa tus datos.';
      }
      Alert.alert('Inicio de sesión', message);
      console.log('login error', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>FurgoKid</Text>
        <TextInput
          placeholder="Email"
          placeholderTextColor="#999"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
          selectTextOnFocus
        />
        <TextInput
          placeholder="Contraseña"
          placeholderTextColor="#999"
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
          selectTextOnFocus
        />
        <Button title={loading ? 'Ingresando...' : 'Entrar'} onPress={handleLogin} color="#2c3e50" disabled={loading} />
        <Text style={styles.linkText} onPress={() => !loading && navigation.navigate('Register')}>
          ¿No tienes cuenta? Regístrate aquí
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
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
    borderBottomWidth: 2,
    borderColor: '#ccc',
    marginBottom: 20,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  linkText: {
    marginTop: 20,
    textAlign: 'center',
    color: 'blue',
    fontSize: 14,
  },
});
