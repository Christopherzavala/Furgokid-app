// src/screens/TrackingMap.js
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { auth, db } from '../config/firebase';
import analyticsService from '../services/analyticsService';
import {
  mapCustodyError,
  reportStudentAbsence,
  requestHandoverOtp,
  subscribeToPassengerState,
  transitionPassengerState,
  verifyStudentHandover,
} from '../services/custodyService';
import { triggerSosAlert } from '../services/emergencyService';
import toastService from '../services/toastService';
import notificationService from '../utils/notificationService';

const { width, height } = Dimensions.get('window');

const TrackingMap = ({ route, navigation }) => {
  const [region, setRegion] = useState(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [followMode, setFollowMode] = useState(true);
  const [activeMatchId, setActiveMatchId] = useState(null);
  const [driverName, setDriverName] = useState('Conductor');
  const [matchData, setMatchData] = useState(null);
  const [passengerStates, setPassengerStates] = useState({});
  const [selectedPassengerId, setSelectedPassengerId] = useState(null);

  // OTP Handover State
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [activeOtpInfo, setActiveOtpInfo] = useState(null);
  const [countdown, setCountdown] = useState(null);

  const mapRef = useRef(null);
  const lastAnimateTsRef = useRef(0);
  const lastPointRef = useRef(null);
  const pickupPointRef = useRef(null);
  const arrivalNotifiedRef = useRef(false);

  const MIN_MOVE_METERS = 8;
  const ARRIVAL_THRESHOLD_SECONDS = 5 * 60;
  const DEFAULT_SPEED_MPS = 8.33;

  const approxDistanceMeters = (a, b) => {
    if (!a || !b) return Infinity;
    const toRad = (x) => (x * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLon = Math.sin(dLon / 2);
    const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  };

  useEffect(() => {
    setupInitialMap();
    const matchId = route?.params?.matchId;
    if (matchId) {
      setActiveMatchId(matchId);
      loadMatchDetails(matchId);
    }
    const unsubscribeTracking = subscribeToMatchTracking();
    return () => {
      try {
        if (typeof unsubscribeTracking === 'function') unsubscribeTracking();
      } catch {
        // no-op
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMatchDetails = async (matchId) => {
    try {
      const matchSnap = await getDoc(doc(db, 'matches', matchId));
      if (matchSnap.exists()) {
        const data = matchSnap.data();
        setMatchData(data);
        if (data.passengerIds && data.passengerIds.length > 0) {
          setSelectedPassengerId(data.passengerIds[0]);
        }
      }
    } catch (error) {
      console.error('Error loading match details:', error);
    }
  };

  useEffect(() => {
    if (!activeMatchId || !matchData?.passengerIds) return;
    const unsubscribes = matchData.passengerIds.map((passengerId) =>
      subscribeToPassengerState(
        activeMatchId,
        passengerId,
        (stateObj) => {
          setPassengerStates((prev) => ({
            ...prev,
            [passengerId]: stateObj ? stateObj.state : 'EXPECTED',
          }));
        },
        (err) => console.warn('Passenger state sub error:', err)
      )
    );
    return () => {
      unsubscribes.forEach((unsub) => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, [activeMatchId, matchData]);

  useEffect(() => {
    if (!activeOtpInfo?.expiresAt) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((activeOtpInfo.expiresAt - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeOtpInfo]);

  const setupInitialMap = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        pickupPointRef.current = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        });
      }
    } catch (e) {
      console.error('Error getting initial location:', e);
    }
  };

  const subscribeToMatchTracking = () => {
    const matchId = route?.params?.matchId;
    if (typeof matchId !== 'string' || !matchId) {
      setLoading(false);
      return undefined;
    }
    const docRef = doc(db, 'matches', matchId, 'tracking', 'current');

    return onSnapshot(
      docRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (typeof data.latitude !== 'number' || typeof data.longitude !== 'number') {
            setLoading(false);
            return;
          }

          const point = {
            latitude: data.latitude,
            longitude: data.longitude,
            speed: data.speed || 0,
            id: 'current',
          };

          const last = lastPointRef.current;
          const isSamePoint =
            last && last.latitude === point.latitude && last.longitude === point.longitude;
          const movedMeters = approxDistanceMeters(last, point);
          lastPointRef.current = point;

          if (!isSamePoint && movedMeters >= MIN_MOVE_METERS) {
            setDriverLocation(point);
            setDriverName('Furgo en Ruta');
          }

          try {
            if (!arrivalNotifiedRef.current && pickupPointRef.current) {
              const distanceToPickup = approxDistanceMeters(point, pickupPointRef.current);
              const speedMps =
                typeof point.speed === 'number' && point.speed > 1
                  ? point.speed
                  : DEFAULT_SPEED_MPS;
              const etaSeconds = Math.round(distanceToPickup / speedMps);

              if (etaSeconds > 0 && etaSeconds <= ARRIVAL_THRESHOLD_SECONDS) {
                arrivalNotifiedRef.current = true;
                await notificationService.showNotification(
                  'FurgoKid',
                  'Faltan ~5 minutos para llegar al punto de recogida.',
                  { type: 'arrival_soon', etaSeconds }
                );
              }
            }
          } catch (e) {
            if (__DEV__) console.log('[TrackingMap] Notification error:', e);
          }

          const now = Date.now();
          if (followMode && mapRef.current && now - lastAnimateTsRef.current > 800) {
            lastAnimateTsRef.current = now;
            mapRef.current.animateToRegion(
              {
                latitude: data.latitude,
                longitude: data.longitude,
                latitudeDelta: 0.008,
                longitudeDelta: 0.008,
              },
              1000
            );
          }
        } else {
          lastPointRef.current = null;
          setDriverLocation(null);
        }
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        analyticsService.trackAppError('tracking_snapshot_error', {
          name: error?.name,
          stack: error?.stack,
          tag: 'tracking_map',
          action: 'on_snapshot',
          fatal: false,
        });
      }
    );
  };

  const centerOnDriver = () => {
    if (driverLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        1000
      );
    }
  };

  // SOS Emergency Handler (#12) with Cloud Function trigger, SMS, and Google Maps link
  const handleSosEmergency = () => {
    const lat = driverLocation?.latitude || region?.latitude || 0;
    const lng = driverLocation?.longitude || region?.longitude || 0;
    const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
    const smsBody = `🚨 ¡EMERGENCIA FURGOKID! Necesito ayuda inmediata. Mi ubicación GPS actual es: ${mapsLink}`;

    Alert.alert(
      '🚨 Emergencia SOS',
      'Selecciona una opción de emergencia:',
      [
        {
          text: 'Llamar a Emergencias (133)',
          onPress: () => Linking.openURL('tel:133'),
          style: 'destructive',
        },
        {
          text: 'Enviar Alerta SOS (Registrar y Notificar)',
          onPress: async () => {
            try {
              if (activeMatchId) {
                await triggerSosAlert({
                  matchId: activeMatchId,
                  location: { latitude: lat, longitude: lng },
                  reason: 'Emergencia reportada desde el mapa',
                });
                toastService.success(
                  'Alerta SOS',
                  'Incidente registrado y notificado al equipo de operaciones.'
                );
              }
            } catch (err) {
              toastService.error('Error SOS', err.message || 'No se pudo enviar la alerta SOS.');
            }
          },
        },
        {
          text: 'Enviar SMS con Ubicación GPS',
          onPress: () => Linking.openURL(`sms:?body=${encodeURIComponent(smsBody)}`),
        },
        { text: 'Cancelar', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  // Driver actions
  const handleDriverTransition = async (newState) => {
    if (!activeMatchId || !selectedPassengerId) return;
    try {
      setOtpLoading(true);
      await transitionPassengerState({
        matchId: activeMatchId,
        passengerId: selectedPassengerId,
        newState,
      });
      toastService.success('Estado actualizado', `Pasajero cambiado a ${newState}`);
    } catch (error) {
      toastService.error('Error', mapCustodyError(error));
    } finally {
      setOtpLoading(false);
    }
  };

  // Verify PIN for handover
  const handleVerifyHandover = async () => {
    if (!activeMatchId || !selectedPassengerId || !pinInput) {
      toastService.error('PIN requerido', 'Ingresa el PIN de 4 dígitos.');
      return;
    }
    try {
      setOtpLoading(true);
      await verifyStudentHandover({
        matchId: activeMatchId,
        passengerId: selectedPassengerId,
        pin: pinInput.trim(),
      });
      toastService.success('¡Entrega Exitosa!', 'El estudiante ha sido entregado correctamente.');
      setOtpModalVisible(false);
      setPinInput('');
    } catch (error) {
      toastService.error('Error de Verificación', mapCustodyError(error));
    } finally {
      setOtpLoading(false);
    }
  };

  // Parent action: Report absence
  const handleReportAbsence = async () => {
    if (!activeMatchId || !selectedPassengerId) return;
    const today = new Date().toISOString().split('T')[0];
    Alert.alert(
      'Aviso de Inasistencia',
      '¿Estás seguro de reportar la inasistencia para hoy? El conductor será notificado y la parada omitida.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reportar',
          style: 'destructive',
          onPress: async () => {
            try {
              setOtpLoading(true);
              await reportStudentAbsence({
                matchId: activeMatchId,
                passengerId: selectedPassengerId,
                date: today,
              });
              toastService.success('Inasistencia registrada', 'El viaje ha sido actualizado.');
            } catch (error) {
              toastService.error('Error', mapCustodyError(error));
            } finally {
              setOtpLoading(false);
            }
          },
        },
      ]
    );
  };

  // Parent action: Request OTP with robust expiresAt parsing and immediate countdown calculation
  const handleRequestOtp = async () => {
    if (!activeMatchId || !selectedPassengerId) return;
    try {
      setOtpLoading(true);
      const res = await requestHandoverOtp({
        matchId: activeMatchId,
        passengerId: selectedPassengerId,
      });
      let expiryMs = Date.now() + 600000;
      if (res.expiresAt) {
        if (typeof res.expiresAt.toMillis === 'function') {
          expiryMs = res.expiresAt.toMillis();
        } else if (typeof res.expiresAt === 'string') {
          expiryMs = Date.parse(res.expiresAt);
        } else if (typeof res.expiresAt === 'number') {
          expiryMs = res.expiresAt;
        }
      }
      const initialRemaining = Math.max(0, Math.floor((expiryMs - Date.now()) / 1000));
      setActiveOtpInfo({
        pin: res.pin,
        expiresAt: expiryMs,
      });
      setCountdown(initialRemaining);
      toastService.success('PIN Generado', `Tu PIN temporal es: ${res.pin}`);
    } catch (error) {
      toastService.error('Error', mapCustodyError(error));
    } finally {
      setOtpLoading(false);
    }
  };

  const isDriver = matchData?.driverId === auth.currentUser?.uid;
  const isParent = matchData?.parentId === auth.currentUser?.uid;
  const currentPassengerState = selectedPassengerId
    ? passengerStates[selectedPassengerId] || 'EXPECTED'
    : 'EXPECTED';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B35" />
        <Text style={styles.loadingText}>Conectando con GPS...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView ref={mapRef} style={styles.map} initialRegion={region} provider={PROVIDER_GOOGLE}>
        {driverLocation && (
          <Marker
            coordinate={{
              latitude: driverLocation.latitude,
              longitude: driverLocation.longitude,
            }}
            title={driverName}
            description={`Velocidad: ${Math.round(driverLocation.speed * 3.6)} km/h`}
          >
            <View style={styles.vehicleMarker}>
              <Ionicons name="car" size={24} color="#fff" />
            </View>
          </Marker>
        )}
      </MapView>

      {/* CONTROLES FLOTANTES */}
      <View style={styles.topControls}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.statusBadge}>
          <View style={[styles.dot, driverLocation ? styles.dotActive : styles.dotInactive]} />
          <Text style={styles.statusText}>{driverLocation ? 'EN VIVO' : 'SIN RUTA'}</Text>
        </View>
        <TouchableOpacity style={styles.sosButton} onPress={handleSosEmergency}>
          <Ionicons name="alert-circle" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.bottomControls}>
        <TouchableOpacity
          style={[styles.controlButton, followMode && styles.activeButton]}
          onPress={() => setFollowMode(!followMode)}
        >
          <Ionicons name="locate" size={26} color={followMode ? '#fff' : '#FF6B35'} />
        </TouchableOpacity>
        {driverLocation && (
          <TouchableOpacity style={styles.controlButton} onPress={centerOnDriver}>
            <Ionicons name="car" size={26} color="#FF6B35" />
          </TouchableOpacity>
        )}
      </View>

      {/* PANEL DE CUSTODIA & INFO */}
      <View style={styles.infoPanel}>
        {matchData?.passengerIds && matchData.passengerIds.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.passengerChipRow}
          >
            {matchData.passengerIds.map((pId) => (
              <TouchableOpacity
                key={pId}
                style={[
                  styles.passengerChip,
                  selectedPassengerId === pId && styles.passengerChipSelected,
                ]}
                onPress={() => setSelectedPassengerId(pId)}
              >
                <Text
                  style={[
                    styles.passengerChipText,
                    selectedPassengerId === pId && styles.passengerChipTextSelected,
                  ]}
                >
                  Pasajero {pId.slice(0, 6)} ({passengerStates[pId] || 'EXPECTED'})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.infoRow}>
          <View style={styles.driverInfo}>
            <Text style={styles.driverLabel}>Estado del Pasajero</Text>
            <Text style={styles.driverName}>
              {selectedPassengerId ? `Estado: ${currentPassengerState}` : 'Seleccione pasajero'}
            </Text>
          </View>
          {driverLocation && (
            <View style={styles.speedInfo}>
              <Text style={styles.speedValue}>{Math.round(driverLocation.speed * 3.6)}</Text>
              <Text style={styles.speedUnit}>km/h</Text>
            </View>
          )}
        </View>

        {/* CONTROLES DE CONDUCTOR */}
        {isDriver && (
          <View style={styles.custodyActionRow}>
            {currentPassengerState === 'EXPECTED' && (
              <TouchableOpacity
                style={styles.custodyButton}
                onPress={() => handleDriverTransition('BOARDING_CONFIRMED')}
                disabled={otpLoading}
              >
                <Text style={styles.custodyButtonText}>Confirmar Abordaje</Text>
              </TouchableOpacity>
            )}
            {currentPassengerState === 'BOARDING_CONFIRMED' && (
              <TouchableOpacity
                style={styles.custodyButton}
                onPress={() => handleDriverTransition('IN_TRANSIT')}
                disabled={otpLoading}
              >
                <Text style={styles.custodyButtonText}>Iniciar Tránsito</Text>
              </TouchableOpacity>
            )}
            {currentPassengerState === 'IN_TRANSIT' && (
              <TouchableOpacity
                style={styles.custodyButton}
                onPress={() => handleDriverTransition('ARRIVAL_CONFIRMED')}
                disabled={otpLoading}
              >
                <Text style={styles.custodyButtonText}>Confirmar Llegada</Text>
              </TouchableOpacity>
            )}
            {currentPassengerState === 'ARRIVAL_CONFIRMED' && (
              <TouchableOpacity
                style={[styles.custodyButton, styles.otpBtn]}
                onPress={() => setOtpModalVisible(true)}
                disabled={otpLoading}
              >
                <Text style={styles.custodyButtonText}>Ingresar PIN de Entrega</Text>
              </TouchableOpacity>
            )}
            {['HANDOVER_CONFIRMED', 'ABSENT'].includes(currentPassengerState) && (
              <Text style={styles.terminalStateText}>Estado Terminal: {currentPassengerState}</Text>
            )}
          </View>
        )}

        {/* CONTROLES DE APODERADO */}
        {isParent && (
          <View style={styles.custodyActionRow}>
            {currentPassengerState === 'EXPECTED' && (
              <TouchableOpacity
                style={[styles.custodyButton, styles.absenceBtn]}
                onPress={handleReportAbsence}
                disabled={otpLoading}
              >
                <Text style={styles.custodyButtonText}>No viaja hoy (Ausencia)</Text>
              </TouchableOpacity>
            )}
            {!['HANDOVER_CONFIRMED', 'ABSENT'].includes(currentPassengerState) && (
              <TouchableOpacity
                style={[styles.custodyButton, styles.otpBtn]}
                onPress={handleRequestOtp}
                disabled={otpLoading}
              >
                <Text style={styles.custodyButtonText}>
                  {activeOtpInfo ? 'Regenerar PIN OTP' : 'Generar PIN OTP de Entrega'}
                </Text>
              </TouchableOpacity>
            )}

            {activeOtpInfo && countdown !== null && (
              <View style={styles.otpDisplayBox}>
                <Text style={styles.otpPinText}>PIN: {activeOtpInfo.pin}</Text>
                <Text style={styles.otpExpiryText}>
                  Expira en {Math.floor(countdown / 60)}:{('0' + (countdown % 60)).slice(-2)}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* MODAL DE PIN OTP PARA CONDUCTOR */}
      <Modal visible={otpModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Verificar Entrega Segura</Text>
            <Text style={styles.modalSubtitle}>
              Ingresa el PIN de 4 dígitos proporcionado por el apoderado.
            </Text>
            <TextInput
              style={styles.pinInput}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="----"
              value={pinInput}
              onChangeText={setPinInput}
              secureTextEntry
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setOtpModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.confirmBtn]}
                onPress={handleVerifyHandover}
                disabled={otpLoading}
              >
                {otpLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>Verificar y Entregar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { width, height },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: { marginTop: 15, fontSize: 16, color: '#666', fontWeight: '500' },
  vehicleMarker: {
    backgroundColor: '#FF6B35',
    padding: 5,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
    elevation: 5,
  },
  topControls: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: { backgroundColor: '#fff', padding: 10, borderRadius: 30, elevation: 5 },
  sosButton: { backgroundColor: '#F44336', padding: 10, borderRadius: 30, elevation: 5 },
  statusBadge: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 5,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  dotActive: { backgroundColor: '#4CAF50' },
  dotInactive: { backgroundColor: '#999' },
  statusText: { fontSize: 12, fontWeight: 'bold', color: '#333' },
  bottomControls: { position: 'absolute', right: 20, bottom: 220, flexDirection: 'column' },
  controlButton: {
    backgroundColor: '#fff',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    elevation: 5,
  },
  activeButton: { backgroundColor: '#FF6B35' },
  infoPanel: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    elevation: 10,
  },
  passengerChipRow: { flexDirection: 'row', marginBottom: 12, maxHeight: 40 },
  passengerChip: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  passengerChipSelected: { backgroundColor: '#2196F3' },
  passengerChipText: { fontSize: 12, color: '#333', fontWeight: '500' },
  passengerChipTextSelected: { color: '#fff' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  driverInfo: { flex: 1 },
  driverLabel: { fontSize: 12, color: '#999', textTransform: 'uppercase' },
  driverName: { fontSize: 16, fontWeight: 'bold', color: '#333', marginTop: 2 },
  speedInfo: {
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
  },
  speedValue: { fontSize: 20, fontWeight: 'bold', color: '#FF6B35' },
  speedUnit: { fontSize: 10, color: '#999' },
  custodyActionRow: {
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
    gap: 8,
  },
  custodyButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  custodyButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  otpBtn: { backgroundColor: '#FF6B35' },
  absenceBtn: { backgroundColor: '#78909C' },
  terminalStateText: { textAlign: 'center', color: '#666', fontStyle: 'italic', marginTop: 5 },
  otpDisplayBox: {
    backgroundColor: '#FFF3E0',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 5,
  },
  otpPinText: { fontSize: 18, fontWeight: 'bold', color: '#E65100', letterSpacing: 2 },
  otpExpiryText: { fontSize: 11, color: '#795548', marginTop: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    width: '85%',
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  modalSubtitle: { fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 20 },
  pinInput: {
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 12,
    width: '60%',
    height: 55,
    fontSize: 28,
    textAlign: 'center',
    letterSpacing: 8,
    marginBottom: 25,
    backgroundColor: '#F9F9F9',
  },
  modalButtons: { flexDirection: 'row', gap: 12, width: '100%' },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#f1f1f1' },
  cancelBtnText: { color: '#333', fontWeight: '600' },
  confirmBtn: { backgroundColor: '#4CAF50' },
  confirmBtnText: { color: '#fff', fontWeight: 'bold' },
});

export default TrackingMap;
