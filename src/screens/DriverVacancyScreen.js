import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AdInterstitialManager from '../components/AdInterstitialManager';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import analyticsService from '../services/analyticsService';

const ZONES = ['Zona Norte', 'Zona Sur', 'Zona Oriente', 'Zona Centro', 'Zona Poniente'];
const POPULAR_SCHOOLS = [
  'Colegio San Ignacio',
  'Colegio Verbo Divino',
  'Colegio Lastarria',
  'Colegio Italia',
];
const SCHEDULES = ['Mañana', 'Tarde', 'Ambas'];

export default function DriverVacancyScreen({ navigation }) {
  const { user, userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [schoolModalVisible, setSchoolModalVisible] = useState(false);

  // Formulario
  const [zone, setZone] = useState('Zona Norte');
  const [schedule, setSchedule] = useState('Mañana');
  const [totalSeats, setTotalSeats] = useState('7');
  const [schools, setSchools] = useState([]);
  const [schoolInput, setSchoolInput] = useState('');

  const validateForm = () => {
    if (!zone) {
      Alert.alert('Error', 'Por favor selecciona una zona');
      return false;
    }
    if (!totalSeats || parseInt(totalSeats, 10) < 1) {
      Alert.alert('Error', 'Por favor ingresa un número válido de asientos');
      return false;
    }
    if (schools.length === 0) {
      Alert.alert('Error', 'Por favor selecciona al menos un colegio');
      return false;
    }
    return true;
  };

  const addSchool = (schoolName) => {
    if (schoolName.trim() && !schools.includes(schoolName.trim())) {
      setSchools([...schools, schoolName.trim()]);
      setSchoolInput('');
      setSchoolModalVisible(false);
    }
  };

  const removeSchool = (schoolName) => {
    setSchools(schools.filter((s) => s !== schoolName));
  };

  const handlePublish = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Validar que existe el perfil del conductor (vehículo, etc)
      if (!userProfile?.vehicleModel) {
        Alert.alert(
          'Perfil Incompleto',
          'Por favor completa tus datos de vehículo antes de publicar cupos.'
        );
        setLoading(false);
        navigation.navigate('DriverProfile');
        return;
      }

      // Agregar cupo a Firestore
      const vacancyRef = collection(db, 'vacancies');
      await addDoc(vacancyRef, {
        driverId: user.uid,
        driverName: userProfile?.displayName || user.email.split('@')[0],
        driverPhone: userProfile?.whatsapp || '',
        vehicleModel: userProfile?.vehicleModel,
        licensePlate: userProfile?.licensePlate,
        totalSeats: parseInt(totalSeats, 10),
        availableSeats: parseInt(totalSeats, 10),
        zone,
        schedule,
        schools,
        createdAt: serverTimestamp(),
        status: 'active',
      });

      // Track evento
      await analyticsService.trackDriverVacancy(zone, schools.join(', '), parseInt(totalSeats, 10));

      Alert.alert('¡Éxito!', 'Tu cupo ha sido publicado. Los padres en tu zona lo verán.');

      // 💰 MONETIZACIÓN: Mostrar interstitial después de publicar
      try {
        const loaded = await AdInterstitialManager.loadInterstitial(
          'INTERSTITIAL_NAV',
          userProfile?.role,
          Boolean(userProfile?.isPremium || userProfile?.subscriptionActive || userProfile?.noAds)
        );
        if (loaded && AdInterstitialManager.isReady()) {
          await AdInterstitialManager.show();
        }
      } catch (error) {
        console.warn('[DriverVacancy] Ad error:', error);
        // No bloquear el flujo si hay error con ads
      }

      // Limpiar
      setZone('Zona Norte');
      setSchedule('Mañana');
      setTotalSeats('7');
      setSchools([]);

      // Volver
      navigation.goBack();
    } catch (error) {
      console.error('[DriverVacancy] Error:', error);
      Alert.alert('Error', 'No se pudo publicar el cupo: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color="#2196F3" />
        </TouchableOpacity>
        <Text style={styles.title}>Publicar Cupo</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* CONTENT */}
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Datos de la Ruta</Text>

        {/* Zona */}
        <Text style={styles.label}>Zona de Cobertura</Text>
        <View style={styles.pickerContainer}>
          <Picker selectedValue={zone} onValueChange={setZone} enabled={!loading}>
            {ZONES.map((z) => (
              <Picker.Item key={z} label={z} value={z} />
            ))}
          </Picker>
        </View>

        {/* Horario */}
        <Text style={styles.label}>Horario</Text>
        <View style={styles.pickerContainer}>
          <Picker selectedValue={schedule} onValueChange={setSchedule} enabled={!loading}>
            {SCHEDULES.map((s) => (
              <Picker.Item key={s} label={s} value={s} />
            ))}
          </Picker>
        </View>

        {/* Asientos */}
        <Text style={styles.label}>Total de Asientos</Text>
        <View style={styles.numberInput}>
          <TouchableOpacity
            onPress={() => {
              const num = Math.max(1, parseInt(totalSeats, 10) - 1);
              setTotalSeats(num.toString());
            }}
            disabled={loading}
          >
            <Ionicons name="remove-circle" size={28} color="#2196F3" />
          </TouchableOpacity>
          <Text style={styles.numberValue}>{totalSeats}</Text>
          <TouchableOpacity
            onPress={() => {
              const num = parseInt(totalSeats, 10) + 1;
              setTotalSeats(num.toString());
            }}
            disabled={loading}
          >
            <Ionicons name="add-circle" size={28} color="#2196F3" />
          </TouchableOpacity>
        </View>

        {/* Colegios */}
        <Text style={styles.label}>Colegios que Cubre</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setSchoolModalVisible(true)}
          disabled={loading}
        >
          <Ionicons name="add" size={24} color="#2196F3" />
          <Text style={styles.addButtonText}>Agregar Colegio</Text>
        </TouchableOpacity>

        {/* Lista de colegios */}
        {schools.length > 0 && (
          <View style={styles.schoolsList}>
            {schools.map((school) => (
              <View key={school} style={styles.schoolTag}>
                <Text style={styles.schoolTagText}>{school}</Text>
                <TouchableOpacity onPress={() => removeSchool(school)}>
                  <Ionicons name="close-circle" size={20} color="#f44336" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Hint */}
        <Text style={styles.hint}>
          💡 Asegúrate de que tu perfil de vehículo esté completo para que los padres confíen en ti.
        </Text>

        {/* Button */}
        {loading ? (
          <ActivityIndicator size="large" color="#2196F3" style={styles.button} />
        ) : (
          <Button
            title="Publicar Cupo"
            onPress={handlePublish}
            color="#2196F3"
            disabled={loading}
          />
        )}
      </View>

      {/* MODAL: Seleccionar Colegio */}
      <Modal
        visible={schoolModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSchoolModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Agregar Colegio</Text>
              <TouchableOpacity onPress={() => setSchoolModalVisible(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              placeholder="Busca o escribe el colegio"
              value={schoolInput}
              onChangeText={setSchoolInput}
              placeholderTextColor="#999"
            />

            {/* Lista de colegios sugeridos */}
            <FlatList
              data={POPULAR_SCHOOLS.filter((s) =>
                s.toLowerCase().includes(schoolInput.toLowerCase())
              )}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.schoolOption} onPress={() => addSchool(item)}>
                  <Text style={styles.schoolOptionText}>{item}</Text>
                </TouchableOpacity>
              )}
            />

            {schoolInput.trim() && !POPULAR_SCHOOLS.includes(schoolInput.trim()) && (
              <TouchableOpacity
                style={[styles.schoolOption, styles.customSchool]}
                onPress={() => addSchool(schoolInput)}
              >
                <Text style={styles.schoolOptionText}>Agregar "{schoolInput}"</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 15,
  },
  numberInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginBottom: 15,
  },
  numberValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 12,
    marginBottom: 15,
  },
  addButtonText: {
    color: '#2196F3',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 8,
  },
  schoolsList: {
    marginBottom: 15,
    gap: 8,
  },
  schoolTag: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  schoolTagText: {
    color: '#333',
    fontWeight: '500',
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
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  modalInput: {
    marginHorizontal: 20,
    marginVertical: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  schoolOption: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  schoolOptionText: {
    fontSize: 14,
    color: '#333',
  },
  customSchool: {
    backgroundColor: '#E3F2FD',
  },
});
