import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import toastService from '../services/toastService';

export default function ParentProfileScreen({ navigation }) {
  const { user, updateUserProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Parent data
  const [childrenCount, setChildrenCount] = useState('');
  const [childrenNames, setChildrenNames] = useState('');
  const [childrenAges, setChildrenAges] = useState('');
  const [school, setSchool] = useState('');
  const [zone, setZone] = useState('');
  const [address, setAddress] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  useEffect(() => {
    loadParentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadParentData = async () => {
    try {
      if (user?.uid) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setChildrenCount(data.childrenCount?.toString() || '');
          setChildrenNames(data.childrenNames || '');
          setChildrenAges(data.childrenAges || '');
          setSchool(data.school || '');
          setZone(data.zone || '');
          setAddress(data.address || '');
          setEmergencyContact(data.emergencyContact || '');
        }
      }
    } catch (error) {
      console.error('[ParentProfile] Error loading data:', error);
      toastService.error('Error', 'No se pudo cargar los datos del perfil');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    if (!childrenCount.trim() || isNaN(childrenCount) || parseInt(childrenCount, 10) < 1) {
      toastService.error('Dato inválido', 'Por favor ingresa un número válido de hijos');
      return false;
    }
    if (!childrenNames.trim()) {
      toastService.info('Falta información', 'Por favor ingresa los nombres de tus hijos');
      return false;
    }
    if (!childrenAges.trim()) {
      toastService.info('Falta información', 'Por favor ingresa las edades de tus hijos');
      return false;
    }
    if (!school.trim()) {
      toastService.info('Falta información', 'Por favor ingresa el nombre del colegio');
      return false;
    }
    if (!zone.trim()) {
      toastService.info('Falta información', 'Por favor ingresa tu zona');
      return false;
    }
    if (!address.trim()) {
      toastService.info('Falta información', 'Por favor ingresa tu dirección');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const result = await updateUserProfile({
        childrenCount: parseInt(childrenCount, 10),
        childrenNames,
        childrenAges,
        school,
        zone,
        address,
        emergencyContact: emergencyContact || '',
        profileCompleted: true,
      });

      if (result.success) {
        toastService.success('¡Éxito!', 'Perfil actualizado correctamente');
        navigation.goBack();
      } else {
        toastService.error('Error', 'No se pudo actualizar el perfil: ' + result.error);
      }
    } catch (error) {
      console.error('[ParentProfile] Error saving:', error);
      toastService.error('Error', 'Ocurrió un error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4ECDC4" />
        <Text style={styles.loadingText}>Cargando perfil...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessible={true}
          accessibilityLabel="Volver atrás"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={24} color="#2C3E50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mi Perfil de Padre</Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <Text style={styles.sectionTitle}>👨‍👩‍👧‍👦 Información de los Niños</Text>

        <Text style={styles.label}>Número de Hijos *</Text>
        <TextInput
          placeholder="Ej: 2"
          style={styles.input}
          value={childrenCount}
          onChangeText={setChildrenCount}
          keyboardType="number-pad"
          editable={!saving}
          placeholderTextColor="#999"
          accessible={true}
          accessibilityLabel="Número de hijos"
        />

        <Text style={styles.label}>Nombres de los Niños *</Text>
        <TextInput
          placeholder="Ej: Juan, María"
          style={styles.input}
          value={childrenNames}
          onChangeText={setChildrenNames}
          editable={!saving}
          placeholderTextColor="#999"
          accessible={true}
          accessibilityLabel="Nombres de los niños"
          accessibilityHint="Separa los nombres con comas"
        />

        <Text style={styles.label}>Edades *</Text>
        <TextInput
          placeholder="Ej: 7, 9"
          style={styles.input}
          value={childrenAges}
          onChangeText={setChildrenAges}
          editable={!saving}
          placeholderTextColor="#999"
          accessible={true}
          accessibilityLabel="Edades de los niños"
          accessibilityHint="Separa las edades con comas"
        />

        <Text style={styles.sectionTitle}>🏫 Información del Colegio</Text>

        <Text style={styles.label}>Nombre del Colegio *</Text>
        <TextInput
          placeholder="Ej: Colegio San José"
          style={styles.input}
          value={school}
          onChangeText={setSchool}
          editable={!saving}
          placeholderTextColor="#999"
          accessible={true}
          accessibilityLabel="Nombre del colegio"
        />

        <Text style={styles.sectionTitle}>📍 Ubicación</Text>

        <Text style={styles.label}>Zona *</Text>
        <TextInput
          placeholder="Ej: Las Condes, Providencia"
          style={styles.input}
          value={zone}
          onChangeText={setZone}
          editable={!saving}
          placeholderTextColor="#999"
          accessible={true}
          accessibilityLabel="Zona"
        />

        <Text style={styles.label}>Dirección *</Text>
        <TextInput
          placeholder="Ej: Av. Apoquindo 1234"
          style={styles.input}
          value={address}
          onChangeText={setAddress}
          editable={!saving}
          placeholderTextColor="#999"
          multiline
          numberOfLines={2}
          accessible={true}
          accessibilityLabel="Dirección"
        />

        <Text style={styles.sectionTitle}>📞 Contacto de Emergencia</Text>

        <Text style={styles.label}>Teléfono de Emergencia (Opcional)</Text>
        <TextInput
          placeholder="Ej: +56912345678"
          style={styles.input}
          value={emergencyContact}
          onChangeText={setEmergencyContact}
          keyboardType="phone-pad"
          editable={!saving}
          placeholderTextColor="#999"
          accessible={true}
          accessibilityLabel="Teléfono de emergencia"
        />

        <Text style={styles.helpText}>
          * Campos obligatorios{'\n'}
          📌 Tip: Completa tu perfil para que los conductores confíen más en ti
        </Text>

        {/* Save Button */}
        <View style={styles.buttonContainer}>
          {saving ? (
            <ActivityIndicator size="large" color="#4ECDC4" style={{ marginVertical: 20 }} />
          ) : (
            <Button title="💾 Guardar Perfil" onPress={handleSave} color="#4ECDC4" />
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F9FC',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#78909C',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  form: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 20,
    marginBottom: 12,
  },
  label: {
    marginTop: 12,
    marginBottom: 6,
    fontWeight: '600',
    color: '#546E7A',
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CFD8DC',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#2C3E50',
  },
  helpText: {
    fontSize: 13,
    color: '#90A4AE',
    marginTop: 16,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  buttonContainer: {
    marginTop: 24,
    marginBottom: 40,
  },
});
