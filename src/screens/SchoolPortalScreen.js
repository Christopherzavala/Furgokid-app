// src/screens/SchoolPortalScreen.js
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import {
  authorizeSchoolDriver,
  fetchSchoolArrivalsSnapshot,
  registerSchoolB2b,
} from '../services/schoolB2bService';
import toastService from '../services/toastService';

const SchoolPortalScreen = ({ navigation }) => {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snapshot, setSnapshot] = useState(null);

  // Registration Form state (if schoolId is missing)
  const [regName, setRegName] = useState('');
  const [regRbd, setRegRbd] = useState('');
  const [regCommune, setRegCommune] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [submittingReg, setSubmittingReg] = useState(false);

  // Authorize Driver Form state
  const [newDriverId, setNewDriverId] = useState('');
  const [authorizing, setAuthorizing] = useState(false);

  const loadSnapshot = useCallback(async () => {
    if (!schoolId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      setLoading(true);
      const data = await fetchSchoolArrivalsSnapshot({ schoolId });
      setSnapshot(data);
    } catch (error) {
      toastService.error(
        'Error Portal B2B',
        error.message || 'No se pudo cargar la información del colegio.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [schoolId]);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadSnapshot();
  };

  const handleRegisterSchool = async () => {
    if (!regName.trim() || !regRbd.trim() || !regCommune.trim() || !regAddress.trim()) {
      toastService.error('Campos incompletos', 'Completa el nombre, RBD, comuna y dirección.');
      return;
    }
    try {
      setSubmittingReg(true);
      const res = await registerSchoolB2b({
        name: regName.trim(),
        rbd: regRbd.trim(),
        commune: regCommune.trim(),
        address: regAddress.trim(),
      });
      toastService.success('Colegio Registrado', `Bienvenido a FurgoKid B2B: ${res.name}`);
      loadSnapshot();
    } catch (error) {
      toastService.error('Error de Registro', error.message);
    } finally {
      setSubmittingReg(false);
    }
  };

  const handleRevokeDriver = (driverId) => {
    Alert.alert(
      'Revocar Conductor',
      `¿Deseas desvincular la autorización de este conductor para tu colegio?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revocar',
          style: 'destructive',
          onPress: async () => {
            try {
              await authorizeSchoolDriver({
                schoolId,
                driverId,
                action: 'revoke',
              });
              toastService.success(
                'Autorización Revocada',
                'El conductor ya no está autorizado en este colegio.'
              );
              loadSnapshot();
            } catch (error) {
              toastService.error('Error', error.message);
            }
          },
        },
      ]
    );
  };

  if (!schoolId && !snapshot) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0D47A1" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Registro Colegio B2B</Text>
        </View>

        <ScrollView contentContainerStyle={styles.formContent}>
          <Ionicons
            name="business"
            size={48}
            color="#0D47A1"
            style={{ alignSelf: 'center', marginBottom: 16 }}
          />
          <Text style={styles.formTitle}>Registra tu Establecimiento</Text>
          <Text style={styles.formSubtitle}>
            Habilita la portería digital y monitorea los furgones escolares autorizados en tiempo
            real.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Nombre del Colegio"
            value={regName}
            onChangeText={setRegName}
          />
          <TextInput
            style={styles.input}
            placeholder="RBD (Rol Base Docente)"
            value={regRbd}
            onChangeText={setRegRbd}
            keyboardType="number-pad"
          />
          <TextInput
            style={styles.input}
            placeholder="Comuna"
            value={regCommune}
            onChangeText={setRegCommune}
          />
          <TextInput
            style={styles.input}
            placeholder="Dirección del Establecimiento"
            value={regAddress}
            onChangeText={setRegAddress}
          />

          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleRegisterSchool}
            disabled={submittingReg}
          >
            {submittingReg ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>Registrar Establecimiento B2B</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D47A1" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Portal Colegio B2B</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={loadSnapshot}>
          <Ionicons name="refresh" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0D47A1" />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {/* BANNER COLEGIO */}
          <View style={styles.schoolCard}>
            <Ionicons name="school" size={32} color="#0D47A1" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.schoolCardName}>{snapshot?.schoolName || 'Establecimiento'}</Text>
              <Text style={styles.schoolCardSub}>
                Furgones activos: {snapshot?.activeMatchesCount || 0}
              </Text>
            </View>
          </View>

          {/* METRICAS DE PORTERIA */}
          <Text style={styles.sectionTitle}>Resumen de Portería Digital</Text>
          <View style={styles.metricsGrid}>
            <View style={[styles.metricCard, { backgroundColor: '#E3F2FD' }]}>
              <Text style={[styles.metricValue, { color: '#1565C0' }]}>
                {snapshot?.counts?.IN_TRANSIT || 0}
              </Text>
              <Text style={styles.metricLabel}>En Tránsito</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: '#FFF3E0' }]}>
              <Text style={[styles.metricValue, { color: '#EF6C00' }]}>
                {snapshot?.counts?.ARRIVAL_CONFIRMED || 0}
              </Text>
              <Text style={styles.metricLabel}>En Portería</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: '#E8F5E9' }]}>
              <Text style={[styles.metricValue, { color: '#2E7D32' }]}>
                {snapshot?.counts?.HANDOVER_CONFIRMED || 0}
              </Text>
              <Text style={styles.metricLabel}>Entregados</Text>
            </View>
            <View style={[styles.metricCard, { backgroundColor: '#FFEBEE' }]}>
              <Text style={[styles.metricValue, { color: '#C62828' }]}>
                {snapshot?.counts?.ABSENT || 0}
              </Text>
              <Text style={styles.metricLabel}>Ausentes</Text>
            </View>
          </View>

          {/* GESTION DE CONDUCTORES AUTORIZADOS */}
          <Text style={styles.sectionTitle}>Transportistas Autorizados</Text>

          <View style={styles.addDriverRow}>
            <TextInput
              style={styles.addDriverInput}
              placeholder="ID del Conductor (UID)"
              value={newDriverId}
              onChangeText={setNewDriverId}
            />
            <TouchableOpacity
              style={styles.addDriverBtn}
              onPress={handleAuthorizeSchoolDriver}
              disabled={authorizing}
            >
              {authorizing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.addDriverBtnText}>Autorizar</Text>
              )}
            </TouchableOpacity>
          </View>

          {snapshot?.authorizedDriverIds?.length === 0 ? (
            <Text style={styles.emptyText}>Sin conductores autorizados aún.</Text>
          ) : (
            <FlatList
              data={snapshot?.authorizedDriverIds || []}
              keyExtractor={(item) => item}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.driverItem}>
                  <Ionicons name="bus" size={20} color="#1565C0" />
                  <Text style={styles.driverItemText}>Conductor: {item}</Text>
                  <TouchableOpacity onPress={() => handleRevokeDriver(item)}>
                    <Ionicons name="trash-outline" size={20} color="#C62828" />
                  </TouchableOpacity>
                </View>
              )}
            />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    backgroundColor: '#0D47A1',
    paddingTop: 45,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: { padding: 5 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  refreshButton: { padding: 5 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  formContent: { padding: 24 },
  formTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0D47A1',
    textAlign: 'center',
    marginBottom: 6,
  },
  formSubtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    marginBottom: 12,
  },
  submitBtn: {
    backgroundColor: '#0D47A1',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  content: { flex: 1, padding: 16 },
  schoolCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 2,
  },
  schoolCardName: { fontSize: 17, fontWeight: 'bold', color: '#333' },
  schoolCardSub: { fontSize: 13, color: '#666', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  metricCard: {
    width: '48%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 1,
  },
  metricValue: { fontSize: 26, fontWeight: 'bold' },
  metricLabel: { fontSize: 12, color: '#555', marginTop: 4, fontWeight: '600' },
  addDriverRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  addDriverInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  addDriverBtn: {
    backgroundColor: '#0D47A1',
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addDriverBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  emptyText: { color: '#888', fontStyle: 'italic', marginBottom: 20 },
  driverItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  driverItemText: { flex: 1, marginLeft: 10, fontSize: 14, color: '#333' },
});

export default SchoolPortalScreen;
