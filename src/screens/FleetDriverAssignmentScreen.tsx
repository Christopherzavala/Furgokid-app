/**
 * Fleet Driver Assignment Screen
 *
 * Allows fleet owners to select/register rental or substitute drivers,
 * submit their mandatory verification documents, and assign them to a vehicle and match.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  submitDriverVerificationDocs,
  assignVerifiedVehicleDriver,
} from '../services/fleetDriverService';

export const FleetDriverAssignmentScreen: React.FC<{ route?: any; navigation?: any }> = ({
  route,
  navigation,
}) => {
  const [vehicleId, setVehicleId] = useState('');
  const [matchId, setMatchId] = useState('');
  const [driverUid, setDriverUid] = useState('');
  const [assignmentType, setAssignmentType] = useState<'owner' | 'rental' | 'substitute'>('rental');
  const [licensePath, setLicensePath] = useState('');
  const [criminalPath, setCriminalPath] = useState('');
  const [inabilityPath, setInabilityPath] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUploadDocs = async () => {
    if (!driverUid) {
      Alert.alert('Error', 'Ingresa el UID del conductor.');
      return;
    }
    try {
      setLoading(true);
      await submitDriverVerificationDocs({
        targetDriverUid: driverUid,
        documents: {
          professionalLicense: { path: licensePath || 'drivers/license.pdf' },
          criminalRecord: { path: criminalPath || 'drivers/criminal.pdf' },
          childInabilityRegistry: { path: inabilityPath || 'drivers/inability.pdf' },
        },
      });
      Alert.alert('Éxito', 'Documentos de verificación enviados a revisión.');
    } catch (err: any) {
      Alert.alert('Error al enviar documentos', err?.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignDriver = async () => {
    if (!vehicleId || !matchId || !driverUid) {
      Alert.alert('Error', 'Completa vehicleId, matchId y driverUid.');
      return;
    }
    try {
      setLoading(true);
      await assignVerifiedVehicleDriver({
        vehicleId,
        matchId,
        driverUid,
        assignmentType,
      });
      Alert.alert('Éxito', 'Conductor verificado asignado correctamente al turno.');
      if (navigation) navigation.goBack();
    } catch (err: any) {
      Alert.alert(
        'Error de asignación (Zero Unverified Driver)',
        err?.message || 'Error desconocido'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Gestión de Flota y Conductores</Text>
      <Text style={styles.subtitle}>Asignación de Arrendatarios y Reemplazos Verificados</Text>

      <View style={styles.section}>
        <Text style={styles.label}>UID del Conductor</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej. driver_uid_123"
          value={driverUid}
          onChangeText={setDriverUid}
        />

        <Text style={styles.label}>ID del Vehículo (Vehicle ID)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej. veh_AB1234"
          value={vehicleId}
          onChangeText={setVehicleId}
        />

        <Text style={styles.label}>ID del Viaje (Match ID)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej. match_abc123"
          value={matchId}
          onChangeText={setMatchId}
        />

        <Text style={styles.label}>Tipo de Asignación</Text>
        <View style={styles.row}>
          {(['owner', 'rental', 'substitute'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.typeButton, assignmentType === type && styles.typeButtonSelected]}
              onPress={() => setAssignmentType(type)}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  assignmentType === type && styles.typeButtonTextSelected,
                ]}
              >
                {type === 'owner' ? 'Titular' : type === 'rental' ? 'Arrendatario' : 'Reemplazo'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Documentos Obligatorios</Text>
        <TextInput
          style={styles.input}
          placeholder="Ruta Licencia Profesional"
          value={licensePath}
          onChangeText={setLicensePath}
        />
        <TextInput
          style={styles.input}
          placeholder="Ruta Certificado Antecedentes"
          value={criminalPath}
          onChangeText={setCriminalPath}
        />
        <TextInput
          style={styles.input}
          placeholder="Ruta Registro Inhabilidades"
          value={inabilityPath}
          onChangeText={setInabilityPath}
        />

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleUploadDocs}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>Enviar Documentos a Revisión</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleAssignDriver}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>Asignar Conductor Verificado</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    flexGrow: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#444',
    marginBottom: 4,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  typeButtonSelected: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  typeButtonText: {
    fontSize: 13,
    color: '#555',
  },
  typeButtonTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  primaryButton: {
    backgroundColor: '#28A745',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#007BFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default FleetDriverAssignmentScreen;
