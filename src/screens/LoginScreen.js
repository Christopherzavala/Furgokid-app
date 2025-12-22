import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text, Alert, ActivityIndicator } from 'react-native';
import { auth } from '../config/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Por favor completa todos los campos");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // La navegación ocurrirá automáticamente al autenticarse
    } catch (error) {
      Alert.alert("Error de acceso", "Credenciales incorrectas o error de conexión");
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FurgoKid</Text>
      <TextInput 
        placeholder="Email" 
        style={styles.input} 
        onChangeText={setEmail}
        editable={!loading}
        value={email}
      />
      <TextInput 
        placeholder="Contraseña" 
        style={styles.input} 
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
        value={password}
      />
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2c3e50" />
          <Text style={styles.loadingText}>Iniciando sesión...</Text>
        </View>
      ) : (
        <Button 
          title="Entrar" 
          onPress={handleLogin} 
          color="#2c3e50" 
          disabled={loading}
        />
      )}
      <Text 
        style={{ marginTop: 20, textAlign: 'center', color: 'blue' }}
        onPress={() => !loading && navigation.navigate('Register')}
      >
        ¿No tienes cuenta? Regístrate aquí
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20, 
    justifyContent: 'center'
  },
  title: { 
    fontSize: 32, 
    fontWeight: 'bold', 
    textAlign: 'center', 
    marginBottom: 40, 
    color: '#f1c40f' 
  },
  input: { 
    borderBottomWidth: 1, 
    marginBottom: 20, 
    padding: 10 
  },
  loadingContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '600'
  }
});
