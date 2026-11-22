// src/screens/AdminOpsScreen.js
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  fetchOpsDashboardSnapshot,
  resolveEmergencyIncident,
  reviewDriverApplication,
} from '../services/adminOpsService';
import toastService from '../services/toastService';

const AdminOpsScreen = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState('emergencies'); // 'emergencies' | 'drivers' | 'custody'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snapshot, setSnapshot] = useState({
    activeEmergencies: [],
    pendingDrivers: [],
    recentCustodyEvents: [],
  });

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await fetchOpsDashboardSnapshot();
      setSnapshot(data || {});
    } catch (error) {
      toastService.error(
        'Error Ops',
        error.message || 'No se pudo cargar la consola de operaciones.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const handleResolveEmergency = (incidentId) => {
    Alert.alert('Resolver Emergencia', '¿Confirmas resolver y cerrar esta alerta de emergencia?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Resolver',
        onPress: async () => {
          try {
            await resolveEmergencyIncident({
              incidentId,
              resolutionNotes: 'Resuelto desde Consola Ops',
            });
            toastService.success('Emergencia Resuelta', 'Alerta cerrada y notificada.');
            loadDashboard();
          } catch (error) {
            toastService.error('Error', error.message);
          }
        },
      },
    ]);
  };

  const handleReviewDriver = (driverId, decision) => {
    const actionLabel = decision === 'approve' ? 'Aprobar' : 'Rechazar';
    Alert.alert(
      `${actionLabel} Conductor`,
      `¿Confirmas ${actionLabel.toLowerCase()} la solicitud del conductor?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: actionLabel,
          style: decision === 'reject' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await reviewDriverApplication({ driverId, decision });
              toastService.success(
                'Solicitud Procesada',
                `Conductor ${decision === 'approve' ? 'aprobado' : 'rechazado'}.`
              );
              loadDashboard();
            } catch (error) {
              toastService.error('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const openMap = (location) => {
    if (!location?.latitude || !location?.longitude) return;
    const url = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
    Linking.openURL(url);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1A237E" />

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Consola Ops & Admin</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={loadDashboard}>
          <Ionicons name="refresh" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* TABS */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'emergencies' && styles.tabActive]}
          onPress={() => setActiveTab('emergencies')}
        >
          <Ionicons
            name="alert-circle"
            size={18}
            color={activeTab === 'emergencies' ? '#1A237E' : '#666'}
          />
          <Text style={[styles.tabText, activeTab === 'emergencies' && styles.tabTextActive]}>
            Emergencias ({snapshot.activeEmergencies?.length || 0})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'drivers' && styles.tabActive]}
          onPress={() => setActiveTab('drivers')}
        >
          <Ionicons
            name="person-add"
            size={18}
            color={activeTab === 'drivers' ? '#1A237E' : '#666'}
          />
          <Text style={[styles.tabText, activeTab === 'drivers' && styles.tabTextActive]}>
            Conductores ({snapshot.pendingDrivers?.length || 0})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'custody' && styles.tabActive]}
          onPress={() => setActiveTab('custody')}
        >
          <Ionicons
            name="shield-checkmark"
            size={18}
            color={activeTab === 'custody' ? '#1A237E' : '#666'}
          />
          <Text style={[styles.tabText, activeTab === 'custody' && styles.tabTextActive]}>
            Auditoría
          </Text>
        </TouchableOpacity>
      </View>

      {/* CONTENT */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1A237E" />
        </View>
      ) : (
        <View style={styles.content}>
          {activeTab === 'emergencies' && (
            <FlatList
              data={snapshot.activeEmergencies || []}
              keyExtractor={(item) => item.incidentId || item.id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="checkmark-circle-outline" size={48} color="#4CAF50" />
                  <Text style={styles.emptyText}>Sin alertas SOS activas</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="warning" size={24} color="#F44336" />
                    <Text style={styles.cardTitle}>
                      Emergencia SOS #{item.incidentId?.slice(0, 8)}
                    </Text>
                  </View>
                  <Text style={styles.cardText}>Viaje: {item.matchId}</Text>
                  <Text style={styles.cardText}>
                    Reportado por: {item.role === 'driver' ? 'Conductor' : 'Apoderado'} (
                    {item.triggeredBy})
                  </Text>
                  <Text style={styles.cardText}>Motivo: {item.reason || 'Sin especificar'}</Text>
                  {item.location && (
                    <TouchableOpacity style={styles.mapLink} onPress={() => openMap(item.location)}>
                      <Ionicons name="navigate-outline" size={16} color="#1565C0" />
                      <Text style={styles.mapLinkText}>
                        Ver en Google Maps ({item.location.latitude?.toFixed(4)},{' '}
                        {item.location.longitude?.toFixed(4)})
                      </Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.resolveButton}
                    onPress={() => handleResolveEmergency(item.incidentId)}
                  >
                    <Text style={styles.resolveButtonText}>Marcar Resuelto</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
          )}

          {activeTab === 'drivers' && (
            <FlatList
              data={snapshot.pendingDrivers || []}
              keyExtractor={(item) => item.uid}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={48} color="#999" />
                  <Text style={styles.emptyText}>No hay solicitudes de conductor pendientes</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="person" size={22} color="#1976D2" />
                    <Text style={styles.cardTitle}>{item.name || item.email || item.uid}</Text>
                  </View>
                  <Text style={styles.cardText}>Email: {item.email || 'N/A'}</Text>
                  <Text style={styles.cardText}>
                    Teléfono: {item.phone || item.whatsapp || 'N/A'}
                  </Text>
                  <Text style={styles.cardText}>Estado: {item.driverRequestStatus}</Text>

                  <View style={styles.driverActionRow}>
                    <TouchableOpacity
                      style={[styles.driverBtn, styles.approveBtn]}
                      onPress={() => handleReviewDriver(item.uid, 'approve')}
                    >
                      <Text style={styles.approveBtnText}>Aprobar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.driverBtn, styles.rejectBtn]}
                      onPress={() => handleReviewDriver(item.uid, 'reject')}
                    >
                      <Text style={styles.rejectBtnText}>Rechazar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}

          {activeTab === 'custody' && (
            <FlatList
              data={snapshot.recentCustodyEvents || []}
              keyExtractor={(item, index) => item.eventId || String(index)}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="list-outline" size={48} color="#999" />
                  <Text style={styles.emptyText}>Sin eventos de custodia recientes</Text>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Ionicons name="shield" size={20} color="#388E3C" />
                    <Text style={styles.cardTitle}>
                      {item.fromState || 'EXPECTED'} ➔ {item.toState || item.state}
                    </Text>
                  </View>
                  <Text style={styles.cardText}>Viaje: {item.matchId}</Text>
                  <Text style={styles.cardText}>Pasajero: {item.passengerId}</Text>
                  <Text style={styles.cardText}>
                    Actor: {item.actorRole} ({item.actorUid})
                  </Text>
                </View>
              )}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    backgroundColor: '#1A237E',
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
  tabContainer: { flexDirection: 'row', backgroundColor: '#fff', elevation: 2 },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#1A237E' },
  tabText: { fontSize: 12, color: '#666', fontWeight: '600' },
  tabTextActive: { color: '#1A237E', fontWeight: 'bold' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#333' },
  cardText: { fontSize: 13, color: '#555', marginBottom: 4 },
  mapLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginBottom: 10 },
  mapLinkText: { fontSize: 12, color: '#1565C0', textDecorationLine: 'underline' },
  resolveButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  resolveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
  driverActionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  driverBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  approveBtn: { backgroundColor: '#2196F3' },
  approveBtnText: { color: '#fff', fontWeight: 'bold' },
  rejectBtn: { backgroundColor: '#F44336' },
  rejectBtnText: { color: '#fff', fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 50 },
  emptyText: { color: '#888', marginTop: 10, fontSize: 14 },
});

export default AdminOpsScreen;
