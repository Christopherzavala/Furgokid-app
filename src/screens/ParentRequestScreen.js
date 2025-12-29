import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Button,
  Platform,
  ScrollView,
  SegmentedControlIOS,
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

// Constantes de datos
const ZONES = ['Zona Norte', 'Zona Sur', 'Zona Oriente', 'Zona Centro', 'Zona Poniente'];
const SCHEDULES = ['Mañana', 'Tarde', 'Ambas'];

export default function ParentRequestScreen({ navigation }) {
  const { user, userProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  // Formulario
  const [school, setSchool] = useState('');
  const [zone, setZone] = useState('Zona Norte');
  const [schedule, setSchedule] = useState('Mañana');
  const [childrenCount, setChildrenCount] = useState('1');
  const [ages, setAges] = useState('');
  const [specialNeeds, setSpecialNeeds] = useState('');

  const validateForm = () => {
    if (!school.trim()) {
      Alert.alert('Error', 'Por favor ingresa el colegio');
      return false;
    }
    if (!zone) {
      Alert.alert('Error', 'Por favor selecciona una zona');
      return false;
    }
    if (!childrenCount || parseInt(childrenCount, 10) < 1) {
      Alert.alert('Error', 'Por favor ingresa un número válido de hijos');
      return false;
    }
    return true;
  };

  const handlePublish = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Agregar solicitud a Firestore
      const requestRef = collection(db, 'requests');
      await addDoc(requestRef, {
        parentId: user.uid,
        parentName: userProfile?.displayName || user.email.split('@')[0],
        parentPhone: userProfile?.whatsapp || '',
        school: school.trim(),
        zone,
        schedule,
        childrenCount: parseInt(childrenCount, 10),
        ages: ages.trim(),
        specialNeeds: specialNeeds.trim(),
        createdAt: serverTimestamp(),
        status: 'active',
      });

      // Track evento de negocio
      await analyticsService.trackParentRequest(school, zone, schedule);

      Alert.alert(
        '¡Éxito!',
        'Tu solicitud ha sido publicada. Los conductores en tu zona la verán.'
      );

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
        console.warn('[ParentRequest] Ad error:', error);
        // No bloquear el flujo si hay error con ads
      }

      // Limpiar formulario
      setSchool('');
      setZone('Zona Norte');
      setSchedule('Mañana');
      setChildrenCount('1');
      setAges('');
      setSpecialNeeds('');

      // Volver a home
      navigation.goBack();
    } catch (error) {
      console.error('[ParentRequest] Error:', error);
      Alert.alert('Error', 'No se pudo publicar la solicitud: ' + error.message);
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
        <Text style={styles.title}>Publicar Necesidad</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* CONTENT */}
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Datos Básicos</Text>

        {/* Colegio */}
        <Text style={styles.label}>Colegio</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Colegio San Ignacio"
          value={school}
          onChangeText={setSchool}
          editable={!loading}
          placeholderTextColor="#999"
        />

        {/* Zona */}
        <Text style={styles.label}>Zona</Text>
        <View style={styles.pickerContainer}>
          <Picker selectedValue={zone} onValueChange={setZone} enabled={!loading}>
            {ZONES.map((z) => (
              <Picker.Item key={z} label={z} value={z} />
            ))}
          </Picker>
        </View>

        {/* Horario */}
        <Text style={styles.label}>Horario</Text>
        {Platform.OS === 'ios' ? (
          <SegmentedControlIOS
            values={SCHEDULES}
            selectedIndex={SCHEDULES.indexOf(schedule)}
            onChange={(event) => setSchedule(SCHEDULES[event.nativeEvent.selectedSegmentIndex])}
            style={styles.segmentControl}
          />
        ) : (
          <View style={styles.pickerContainer}>
            <Picker selectedValue={schedule} onValueChange={setSchedule} enabled={!loading}>
              {SCHEDULES.map((s) => (
                <Picker.Item key={s} label={s} value={s} />
              ))}
            </Picker>
          </View>
        )}

        {/* Cantidad de hijos */}
        <Text style={styles.label}>¿Cuántos hijos viajarán?</Text>
        <View style={styles.numberInput}>
          <TouchableOpacity
            onPress={() => {
              const num = Math.max(1, parseInt(childrenCount, 10) - 1);
              setChildrenCount(num.toString());
            }}
            disabled={loading}
          >
            <Ionicons name="remove-circle" size={28} color="#2196F3" />
          </TouchableOpacity>
          <Text style={styles.numberValue}>{childrenCount}</Text>
          <TouchableOpacity
            onPress={() => {
              const num = parseInt(childrenCount, 10) + 1;
              setChildrenCount(num.toString());
            }}
            disabled={loading}
          >
            <Ionicons name="add-circle" size={28} color="#2196F3" />
          </TouchableOpacity>
        </View>

        {/* Edades (opcional) */}
        <Text style={styles.label}>Edades de los hijos (opcional)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: 8, 12, 15"
          value={ages}
          onChangeText={setAges}
          editable={!loading}
          placeholderTextColor="#999"
        />

        {/* Necesidades especiales (opcional) */}
        <Text style={styles.label}>Necesidades especiales (opcional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Ej: Alergia a cacahuetes, silla de ruedas..."
          value={specialNeeds}
          onChangeText={setSpecialNeeds}
          multiline
          numberOfLines={3}
          editable={!loading}
          placeholderTextColor="#999"
        />

        {/* Hint */}
        <Text style={styles.hint}>
          💡 Tu número de WhatsApp será compartido solo con conductores interesados.
        </Text>

        {/* Button */}
        {loading ? (
          <ActivityIndicator size="large" color="#2196F3" style={styles.button} />
        ) : (
          <Button
            title="Publicar Solicitud"
            onPress={handlePublish}
            color="#2196F3"
            disabled={loading}
          />
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  segmentControl: {
    marginVertical: 10,
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
  },
  numberValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
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
