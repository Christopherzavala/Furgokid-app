import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text, Alert, TouchableOpacity } from 'react-native';
import { auth, db } from '../config/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [role, setRole] = useState('parent');

  const handleRegister = async () => {
    if (!email || !password || !name || !whatsapp) {
      Alert.alert("Error", "Por favor completa todos los campos");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "La contraseña debe tener al menos 6 caracteres");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name,
        email: email.trim(),
        whatsapp,
        role,
        createdAt: serverTimestamp(),
      });

      Alert.alert("¡Éxito!", "Cuenta creada correctamente");
      navigation.navigate("Login");
    } catch (error) {
      let message = "Error de registro.";
      switch (error.code) {
        case 'auth/email-already-in-use': message = 'El email ya está registrado.'; break;
        case 'auth/invalid-email': message = 'Email inválido.'; break;
        case 'auth/weak-password': message = 'La contraseña es demasiado débil.'; break;
        default: message = error.message;
      }
      Alert.alert("Error de registro", message);
      console.log("register error", error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Únete a FurgoKid</Text>
      <TextInput placeholder="Nombre Completo" style={styles.input} onChangeText={setName} />
      <TextInput placeholder="Email" style={styles.input} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextInput placeholder="WhatsApp (+569...)" style={styles.input} onChangeText={setWhatsapp} keyboardType="phone-pad" />
      <TextInput placeholder="Contraseña" style={styles.input} onChangeText={setPassword} secureTextEntry />

      <Text style={styles.label}>Soy un:</Text>
      <View style={styles.roleContainer}>
        <TouchableOpacity style={[styles.roleButton, role === 'parent' && styles.activeRole]} onPress={() => setRole('parent')}>
          <Text>Padre</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.roleButton, role === 'driver' && styles.activeRole]} onPress={() => setRole('driver')}>
          <Text>Conductor</Text>
        </TouchableOpacity>
      </View>

      <Button title="Registrarme" onPress={handleRegister} color="#f1c40f" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, padding:20, justifyContent:'center', backgroundColor:'#fff' },
  title: { fontSize:24, fontWeight:'bold', marginBottom:20, textAlign:'center' },
  input: { borderBottomWidth:1, marginBottom:15, padding:10, borderColor:'#ccc' },
  label: { marginTop:10, fontWeight:'bold' },
  roleContainer: { flexDirection:'row', justifyContent:'space-around', marginVertical:15 },
  roleButton: { padding:10, borderWidth:1, borderRadius:5, borderColor:'#ccc', width:'40%', alignItems:'center' },
  activeRole: { backgroundColor:'#f1c40f', borderColor:'#f1c40f' }
});
