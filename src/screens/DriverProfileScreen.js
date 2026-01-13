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

export default function DriverProfileScreen({ navigation }) {
  const { user, updateUserProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Datos del conductor
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [seats, setSeats] = useState('');
  const [zone, setZone] = useState('');

  useEffect(() => {
    loadDriverData();
    // loadDriverData is stable enough for mount-only load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDriverData = async () => {
    try {
      if (user?.uid) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setVehicleModel(data.vehicleModel || '');
          setVehicleYear(data.vehicleYear || '');
          setLicensePlate(data.licensePlate || '');
          setSeats(data.seats || '');
          setZone(data.zone || '');
        }
      }
    } catch (error) {
      console.error('[DriverProfile] Error loading data:', error);
      toastService.error('Error', 'No se pudo cargar los datos del perfil');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    if (!vehicleModel.trim()) {
      toastService.info('Falta información', 'Por favor ingresa el modelo del vehículo');
      return false;
    }
    if (!vehicleYear.trim() || vehicleYear.length !== 4) {
      toastService.error('Dato inválido', 'Por favor ingresa un año válido (4 dígitos)');
      return false;
    }
    if (!licensePlate.trim()) {
      toastService.info('Falta información', 'Por favor ingresa la placa del vehículo');
      return false;
    }
    if (!seats.trim() || isNaN(seats) || parseInt(seats, 10) < 1) {
      toastService.error('Dato inválido', 'Por favor ingresa un número válido de asientos');
      return false;
    }
    if (!zone.trim()) {
      toastService.info('Falta información', 'Por favor ingresa la zona de cobertura');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const result = await updateUserProfile({
        vehicleModel,
        vehicleYear,
        licensePlate,
        zone,
        seats: parseInt(seats, 10),
        profileCompleted: true,
      });

      if (result.success) {
        toastService.success('¡Éxito!', 'Perfil actualizado correctamente');
        navigation.goBack();
      } else {
        toastService.error('Error', 'No se pudo actualizar el perfil: ' + result.error);
      }
    } catch (error) {
      toastService.error('Error', 'Error al guardar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#2196F3" />
        </TouchableOpacity>
        <Text style={styles.title}>Datos del Vehículo</Text>
        <View style={{ width: 28 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.label}>Modelo del Vehículo</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Toyota Hiace"
          value={vehicleModel}
          onChangeText={setVehicleModel}
          editable={!saving}
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Año</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: 2020"
          value={vehicleYear}
          onChangeText={setVehicleYear}
          keyboardType="numeric"
          maxLength={4}
          editable={!saving}
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Placa del Vehículo</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: ABC-1234"
          value={licensePlate}
          onChangeText={setLicensePlate}
          autoCapitalize="characters"
          editable={!saving}
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Cantidad de Asientos</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: 7"
          value={seats}
          onChangeText={setSeats}
          keyboardType="numeric"
          editable={!saving}
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Zona de Cobertura</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Zona Norte, San Isidro"
          value={zone}
          onChangeText={setZone}
          editable={!saving}
          placeholderTextColor="#999"
        />

        <Text style={styles.hint}>
          Estos datos ayudan a los padres a encontrar conductores en su zona.
        </Text>

        {saving ? (
          <ActivityIndicator size="large" color="#2196F3" style={styles.button} />
        ) : (
          <Button title="Guardar Cambios" onPress={handleSave} color="#2196F3" disabled={saving} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 15,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 20,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  button: {
    marginVertical: 20,
  },
});
