import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [role, setRole] = useState('parent');
  const [localLoading, setLocalLoading] = useState(false);
  const { signUp, loading: authLoading } = useAuth();

  // Email validation
  const validateEmail = (candidateEmail) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(candidateEmail);
  };

  // WhatsApp validation (basic: numbers and + symbol)
  const validateWhatsApp = (candidateWhatsapp) => {
    const re = /^\+?[0-9]{7,15}$/;
    return re.test(candidateWhatsapp.replace(/\s/g, ''));
  };

  const handleRegister = async () => {
    if (!email || !password || !name || !whatsapp) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert('Error', 'Por favor ingresa un email válido');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (!validateWhatsApp(whatsapp)) {
      Alert.alert('Error', 'Por favor ingresa un WhatsApp válido (7-15 dígitos)');
      return;
    }

    setLocalLoading(true);
    const result = await signUp(email.trim(), password, name, role);
    if (result.success) {
      Alert.alert('¡Éxito!', 'Cuenta creada correctamente. Inicia sesión ahora.');
      navigation.navigate('Login');
    } else {
      let message = result.error || 'Error de registro.';
      if (result.error?.includes('email-already-in-use')) {
        message = 'El email ya está registrado.';
      } else if (result.error?.includes('invalid-email')) {
        message = 'Email inválido.';
      } else if (result.error?.includes('weak-password')) {
        message = 'La contraseña es demasiado débil.';
      }
      Alert.alert('Error de registro', message);
    }
    setLocalLoading(false);
  };

  const isLoading = localLoading || authLoading;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Únete a FurgoKid</Text>
      <TextInput
        placeholder="Nombre Completo"
        style={styles.input}
        onChangeText={setName}
        value={name}
        editable={!isLoading}
        placeholderTextColor="#999"
      />
      <TextInput
        placeholder="Email"
        style={styles.input}
        onChangeText={setEmail}
        value={email}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!isLoading}
        placeholderTextColor="#999"
      />
      <TextInput
        placeholder="WhatsApp (+569...)"
        style={styles.input}
        onChangeText={setWhatsapp}
        value={whatsapp}
        keyboardType="phone-pad"
        editable={!isLoading}
        placeholderTextColor="#999"
      />
      <TextInput
        placeholder="Contraseña"
        style={styles.input}
        onChangeText={setPassword}
        value={password}
        secureTextEntry
        editable={!isLoading}
        placeholderTextColor="#999"
      />

      <Text style={styles.label}>Soy un:</Text>
      <View style={styles.roleContainer}>
        <TouchableOpacity
          style={[styles.roleButton, role === 'parent' && styles.activeRole]}
          onPress={() => !isLoading && setRole('parent')}
          disabled={isLoading}
        >
          <Text>Padre</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.roleButton, role === 'driver' && styles.activeRole]}
          onPress={() => !isLoading && setRole('driver')}
          disabled={isLoading}
        >
          <Text>Conductor</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#f1c40f" style={{ marginVertical: 20 }} />
      ) : (
        <Button title="Registrarme" onPress={handleRegister} color="#f1c40f" />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { borderBottomWidth: 1, marginBottom: 15, padding: 10, borderColor: '#ccc' },
  label: { marginTop: 10, fontWeight: 'bold' },
  roleContainer: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 15 },
  roleButton: {
    padding: 10,
    borderWidth: 1,
    borderRadius: 5,
    borderColor: '#ccc',
    width: '40%',
    alignItems: 'center',
  },
  activeRole: { backgroundColor: '#f1c40f', borderColor: '#f1c40f' },
});
