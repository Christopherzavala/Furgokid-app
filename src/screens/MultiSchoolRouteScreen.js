// src/screens/MultiSchoolRouteScreen.js
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
  advanceRouteStop,
  computeOrderedStopsAndEta,
  fetchDriverRoutes,
  saveMultiSchoolRoute,
} from '../services/multiSchoolRouteService';
import toastService from '../services/toastService';

const MultiSchoolRouteScreen = ({ navigation }) => {
  const { user } = useAuth();
  const driverUid = user?.uid;

  const [loading, setLoading] = useState(true);
  const [routes, setRoutes] = useState([]);
  const [activeRoute, setActiveRoute] = useState(null);

  // Form state to create / edit route
  const [routeName, setRouteName] = useState('');
  const [shift, setShift] = useState('morning'); // 'morning' | 'afternoon'
  const [stops, setStops] = useState([]);
  const [saving, setSaving] = useState(false);

  // New Stop Form fields
  const [stopLabel, setStopLabel] = useState('');
  const [stopType, setStopType] = useState('pickup'); // 'pickup' | 'dropoff' | 'school'
  const [stopLat, setStopLat] = useState('');
  const [stopLng, setStopLng] = useState('');

  const loadRoutes = async () => {
    if (!driverUid) return;
    try {
      setLoading(true);
      const data = await fetchDriverRoutes(driverUid);
      setRoutes(data || []);
      if (data && data.length > 0) {
        const active = data.find((r) => r.status === 'ACTIVE') || data[0];
        setActiveRoute(active);
        setRouteName(active.name || '');
        setShift(active.shift || 'morning');
        setStops(active.stops || []);
      }
    } catch (error) {
      toastService.error('Error Rutas', error.message || 'No se pudieron cargar las rutas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoutes();
  }, [driverUid]);

  const handleAddStop = () => {
    if (!stopLabel.trim()) {
      toastService.error('Etiqueta requerida', 'Ingresa una etiqueta o nombre para la parada.');
      return;
    }
    const lat = Number(stopLat);
    const lng = Number(stopLng);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toastService.error(
        'GPS Inválido',
        'Ingresa latitudes entre -90 y 90, y longitudes entre -180 y 180.'
      );
      return;
    }

    const newStop = {
      stopId: `stop_${Date.now()}_${stops.length + 1}`,
      order: stops.length + 1,
      type: stopType,
      label: stopLabel.trim(),
      location: { latitude: lat, longitude: lng },
      status: 'PENDING',
    };

    const updatedStops = computeOrderedStopsAndEta([...stops, newStop]);
    setStops(updatedStops);
    setStopLabel('');
    setStopLat('');
    setStopLng('');
    toastService.success('Parada Añadida', `Agregada parada #${newStop.order} (${newStop.label})`);
  };

  const handleSaveRoute = async () => {
    if (!routeName.trim() || stops.length === 0) {
      toastService.error(
        'Formulario Incompleto',
        'Ingresa un nombre de ruta y al menos una parada.'
      );
      return;
    }
    try {
      setSaving(true);
      const payload = {
        routeId: activeRoute?.routeId,
        name: routeName.trim(),
        shift,
        stops,
      };
      const res = await saveMultiSchoolRoute(payload);
      toastService.success(
        'Ruta Guardada',
        `Ruta multi-colegio guardada con ${res.stopsCount} paradas.`
      );
      loadRoutes();
    } catch (error) {
      toastService.error('Error al Guardar', error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAdvanceStop = async (stopId, targetStatus) => {
    if (!activeRoute?.routeId) return;
    try {
      setSaving(true);
      const res = await advanceRouteStop({
        routeId: activeRoute.routeId,
        stopId,
        status: targetStatus,
      });
      setStops(res.stops || []);
      toastService.success('Parada Actualizada', `Parada marcada como ${targetStatus}`);
    } catch (error) {
      toastService.error('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1976D2" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Motor de Rutas Multi-Colegio</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976D2" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* CONFIGURACION DE RUTA */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Configuración de la Ruta</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre de la Ruta (ej. Ruta Mañana Colegios San Pedro / Maristas)"
              value={routeName}
              onChangeText={setRouteName}
            />

            <View style={styles.shiftRow}>
              <TouchableOpacity
                style={[styles.shiftBtn, shift === 'morning' && styles.shiftBtnActive]}
                onPress={() => setShift('morning')}
              >
                <Text
                  style={[styles.shiftBtnText, shift === 'morning' && styles.shiftBtnTextActive]}
                >
                  Mañana
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.shiftBtn, shift === 'afternoon' && styles.shiftBtnActive]}
                onPress={() => setShift('afternoon')}
              >
                <Text
                  style={[styles.shiftBtnText, shift === 'afternoon' && styles.shiftBtnTextActive]}
                >
                  Tarde
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* AGREGAR PARADA */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Agregar Parada a la Ruta</Text>
            <TextInput
              style={styles.input}
              placeholder="Nombre / Etiqueta de la Parada (ej. Colegio Maristas)"
              value={stopLabel}
              onChangeText={setStopLabel}
            />
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeChip, stopType === 'pickup' && styles.typeChipActive]}
                onPress={() => setStopType('pickup')}
              >
                <Text
                  style={[styles.typeChipText, stopType === 'pickup' && styles.typeChipTextActive]}
                >
                  Pickup (Recogida)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeChip, stopType === 'school' && styles.typeChipActive]}
                onPress={() => setStopType('school')}
              >
                <Text
                  style={[styles.typeChipText, stopType === 'school' && styles.typeChipTextActive]}
                >
                  Colegio
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeChip, stopType === 'dropoff' && styles.typeChipActive]}
                onPress={() => setStopType('dropoff')}
              >
                <Text
                  style={[styles.typeChipText, stopType === 'dropoff' && styles.typeChipTextActive]}
                >
                  Dropoff (Entrega)
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.geoRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Latitud (ej. -33.4489)"
                value={stopLat}
                onChangeText={setStopLat}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Longitud (ej. -70.6693)"
                value={stopLng}
                onChangeText={setStopLng}
                keyboardType="numeric"
              />
            </View>

            <TouchableOpacity style={styles.addStopBtn} onPress={handleAddStop}>
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.addStopBtnText}>Añadir Parada</Text>
            </TouchableOpacity>
          </View>

          {/* LISTA ORDENADA DE PARADAS */}
          <Text style={styles.sectionTitle}>Secuencia de Paradas ({stops.length})</Text>

          {stops.map((item, index) => (
            <View key={item.stopId || index} style={styles.stopCard}>
              <View style={styles.stopHeader}>
                <View style={styles.orderBadge}>
                  <Text style={styles.orderBadgeText}>#{item.order}</Text>
                </View>
                <Text style={styles.stopTitle}>{item.label}</Text>
                <Text style={[styles.statusTag, styles[`tag_${item.status}`]]}>{item.status}</Text>
              </View>

              <Text style={styles.stopDetail}>Tipo: {item.type.toUpperCase()}</Text>
              {item.estimatedArrivalMin !== null && item.estimatedArrivalMin !== undefined ? (
                <Text style={styles.stopEta}>ETA Estimado: +{item.estimatedArrivalMin} min</Text>
              ) : (
                <Text style={styles.stopEtaNull}>ETA: Parada {item.status}</Text>
              )}

              {item.status === 'PENDING' && (
                <View style={styles.stopActionRow}>
                  <TouchableOpacity
                    style={[styles.stopActionBtn, styles.completeBtn]}
                    onPress={() => handleAdvanceStop(item.stopId, 'COMPLETED')}
                    disabled={saving}
                  >
                    <Text style={styles.actionBtnText}>Completar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.stopActionBtn, styles.skipBtn]}
                    onPress={() => handleAdvanceStop(item.stopId, 'SKIPPED')}
                    disabled={saving}
                  >
                    <Text style={styles.actionBtnText}>Saltar</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}

          <TouchableOpacity style={styles.saveRouteBtn} onPress={handleSaveRoute} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveRouteBtnText}>Guardar Ruta Multi-Colegio</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    backgroundColor: '#1976D2',
    paddingTop: 45,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: { padding: 5 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1976D2', marginBottom: 12 },
  input: {
    backgroundColor: '#F9F9F9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 10,
  },
  shiftRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  shiftBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  shiftBtnActive: { backgroundColor: '#1976D2', borderColor: '#1976D2' },
  shiftBtnText: { color: '#666', fontWeight: '600' },
  shiftBtnTextActive: { color: '#fff' },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  typeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  typeChipActive: { backgroundColor: '#E3F2FD', borderColor: '#1976D2' },
  typeChipText: { fontSize: 11, color: '#666', fontWeight: '500' },
  typeChipTextActive: { color: '#1976D2', fontWeight: 'bold' },
  geoRow: { flexDirection: 'row', gap: 8 },
  addStopBtn: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  addStopBtnText: { color: '#fff', fontWeight: 'bold' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  stopCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    elevation: 2,
  },
  stopHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  orderBadge: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  orderBadgeText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  stopTitle: { flex: 1, fontSize: 15, fontWeight: 'bold', color: '#333' },
  statusTag: {
    fontSize: 11,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  tag_PENDING: { backgroundColor: '#FFF3E0', color: '#E65100' },
  tag_COMPLETED: { backgroundColor: '#E8F5E9', color: '#2E7D32' },
  tag_SKIPPED: { backgroundColor: '#FFEBEE', color: '#C62828' },
  stopDetail: { fontSize: 12, color: '#666', marginBottom: 2 },
  stopEta: { fontSize: 13, fontWeight: 'bold', color: '#1976D2', marginTop: 4 },
  stopEtaNull: { fontSize: 12, color: '#999', fontStyle: 'italic', marginTop: 4 },
  stopActionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  stopActionBtn: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  completeBtn: { backgroundColor: '#4CAF50' },
  skipBtn: { backgroundColor: '#FF9800' },
  actionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  saveRouteBtn: {
    backgroundColor: '#1976D2',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 30,
  },
  saveRouteBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});

export default MultiSchoolRouteScreen;
