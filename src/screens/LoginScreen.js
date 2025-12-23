import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text, Alert } from 'react-native';
import { auth } from '../config/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Campos incompletos", "Ingresa email y contraseña.");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      let message = "Error al iniciar sesión.";
      switch (error?.code) {
        case 'auth/invalid-email': message = 'Email inválido.'; break;
        case 'auth/user-disabled': message = 'Usuario deshabilitado.'; break;
        case 'auth/user-not-found': message = 'Usuario no encontrado.'; break;
        case 'auth/wrong-password': message = 'Contraseña incorrecta.'; break;
        case 'auth/network-request-failed': message = 'Problema de red. Intenta nuevamente.'; break;
        default: message = 'No se pudo iniciar sesión. Revisa tus datos.';
      }
      Alert.alert("Inicio de sesión", message);
      console.log('login error', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>FurgoKid</Text>
      <TextInput placeholder="Email" style={styles.input} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput placeholder="Contraseña" style={styles.input} onChangeText={setPassword} secureTextEntry />
      <Button title={loading ? "Ingresando..." : "Entrar"} onPress={handleLogin} color="#2c3e50" disabled={loading} />
      <Text style={{ marginTop:20, textAlign:'center', color:'blue' }} onPress={() => navigation.navigate('Register')}>
        ¿No tienes cuenta? Regístrate aquí
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, padding:20, justifyContent:'center' },
  title: { fontSize:32, fontWeight:'bold', textAlign:'center', marginBottom:40, color:'#f1c40f' },
  input: { borderBottomWidth:1, marginBottom:20, padding:10 }
});
