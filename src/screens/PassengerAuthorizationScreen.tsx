import { Ionicons } from '@expo/vector-icons';
import { getApp } from 'firebase/app';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import passengerAuthorizationService, {
  PassengerAuthorizationError,
  PassengerAuthorizationRecord,
  PassengerPurpose,
} from '../services/passengerAuthorizationService';

type PassengerSummary = {
  passengerId: string;
  passengerAlias: string;
  status: PassengerAuthorizationRecord['status'];
  authorization: PassengerAuthorizationRecord;
};

const PRIVACY_NOTICE_VERSION = 'privacy-v1';
const AUTHORIZATION_TEXT_VERSION = 'authorization-v1';
const STATUS_LABELS: Record<PassengerAuthorizationRecord['status'], string> = {
  pending: 'Pendiente',
  active: 'Activo en el registro técnico',
  revoked: 'Revocado',
  expired: 'Vencido',
  rejected: 'Rechazado',
  unknown: 'No verificable',
};

const newPassengerId = () => {
  const uuid = globalThis.crypto?.randomUUID?.();
  const suffix =
    uuid ||
    `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random()
      .toString(36)
      .slice(2)}`;
  return `passenger_${suffix}`;
};

const isDemoDevelopmentBuild = () => {
  try {
    return (
      typeof __DEV__ !== 'undefined' && __DEV__ && getApp().options.projectId === 'demo-furgokid'
    );
  } catch {
    return false;
  }
};

const PassengerAuthorizationScreen = ({ navigation }: { navigation: any }) => {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [alias, setAlias] = useState('');
  const [purpose, setPurpose] = useState<PassengerPurpose>('school_transport');
  const [responsibilityDeclared, setResponsibilityDeclared] = useState(false);
  const [privacyNoticeAccepted, setPrivacyNoticeAccepted] = useState(false);
  const [passengerId, setPassengerId] = useState('');
  const [passengers, setPassengers] = useState<PassengerSummary[]>([]);
  const [pendingOperations, setPendingOperations] = useState<
    Array<{ requestId: string; passengerId: string }>
  >([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageIsError, setMessageIsError] = useState(false);

  const canSubmitInThisBuild = useMemo(isDemoDevelopmentBuild, []);

  const refreshFromServer = useCallback(async () => {
    if (!user?.uid || userProfile?.role !== 'parent') {
      setPassengers([]);
      setPendingOperations([]);
      setPendingCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [serverPassengers, pending] = await Promise.all([
        passengerAuthorizationService.getPassengers(),
        passengerAuthorizationService.getPendingOperations(),
      ]);
      setPassengers(serverPassengers as PassengerSummary[]);
      setPendingOperations(pending);
      setPendingCount(pending.length);
      if (!selectedRequestId && pending.length > 0) {
        setSelectedRequestId(pending[0].requestId);
        setPassengerId(pending[0].passengerId);
      }
    } catch {
      setPassengers([]);
      setPendingOperations([]);
      setPendingCount(0);
      setMessage(
        'No pudimos verificar la información con el servidor. El estado queda desconocido y no habilita acciones.'
      );
      setMessageIsError(true);
    } finally {
      setLoading(false);
    }
  }, [selectedRequestId, user?.uid, userProfile?.role]);

  useEffect(() => {
    if (authLoading) return undefined;
    void refreshFromServer();
    const unsubscribe = navigation?.addListener?.('focus', refreshFromServer);
    return unsubscribe;
  }, [authLoading, navigation, refreshFromServer]);

  const showMessage = (text: string, isError = false) => {
    setMessage(text);
    setMessageIsError(isError);
  };

  const handleSelectPending = (op: { requestId: string; passengerId: string }) => {
    setSelectedRequestId(op.requestId);
    setPassengerId(op.passengerId);
    showMessage(`Operación pendiente seleccionada (ID: ${op.requestId.slice(0, 10)}...).`);
  };

  const handleClearSelectedPending = () => {
    setSelectedRequestId(null);
    setPassengerId('');
    showMessage('Nueva operación limpia seleccionada.');
  };

  const handleSubmit = async () => {
    if (!user?.uid || userProfile?.role !== 'parent') {
      showMessage(
        'Inicia sesión con una cuenta autenticada con perfil de padre o madre para continuar.',
        true
      );
      return;
    }
    if (!canSubmitInThisBuild) {
      showMessage(
        'El registro solo está habilitado en desarrollo con el proyecto demo y sus emuladores. No se enviaron datos.',
        true
      );
      return;
    }
    const normalizedAlias = alias.trim();
    if (!normalizedAlias || normalizedAlias.length > 60) {
      showMessage('Ingresa un alias de hasta 60 caracteres.', true);
      return;
    }
    if (!responsibilityDeclared || !privacyNoticeAccepted) {
      showMessage('Revisa y confirma ambas declaraciones para continuar.', true);
      return;
    }

    const operationPassengerId = passengerId || newPassengerId();
    setPassengerId(operationPassengerId);
    setSaving(true);
    showMessage('Enviando la solicitud al servidor…');
    try {
      const result = await passengerAuthorizationService.onboardPassenger(
        {
          passengerId: operationPassengerId,
          passengerAlias: normalizedAlias,
          purpose,
          privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
          authorizationTextVersion: AUTHORIZATION_TEXT_VERSION,
          responsibilityDeclared: true,
          privacyNoticeAccepted: true,
        },
        selectedRequestId || undefined
      );
      setSelectedRequestId(null);
      setPassengerId('');
      setAlias('');
      setResponsibilityDeclared(false);
      setPrivacyNoticeAccepted(false);
      const status = result.result.status;
      showMessage(
        `Respuesta verificada desde el servidor: ${STATUS_LABELS[status]}. El estado técnico no verifica identidad ni representación legal.`
      );
      await refreshFromServer();
    } catch (error) {
      if (error instanceof PassengerAuthorizationError && error.kind === 'unknown') {
        showMessage(
          'No conocemos el resultado de esta solicitud. Conservamos la misma operación para verificar o reintentar; no inicies una solicitud nueva.',
          true
        );
      } else if (
        error instanceof PassengerAuthorizationError &&
        error.code === 'functions/failed-precondition'
      ) {
        showMessage(
          'El servidor no pudo confirmar la elegibilidad requerida. No se creó una autorización.',
          true
        );
      } else {
        showMessage(
          'No se pudo completar la solicitud. El estado no se considera autorizado; revisa la conexión e inténtalo nuevamente.',
          true
        );
      }
      await refreshFromServer();
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = (passenger: PassengerSummary) => {
    Alert.alert(
      'Revocar autorización',
      'La solicitud se enviará al servidor y solo se mostrará confirmada después de verificar el estado persistido.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revocar',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            showMessage('Verificando la revocación con el servidor…');
            try {
              await passengerAuthorizationService.revokePassengerAuthorization(
                passenger.passengerId,
                passenger.authorization.authorizationId
              );
              showMessage('Revocación confirmada por el servidor.');
              await refreshFromServer();
            } catch {
              showMessage(
                'No se pudo confirmar la revocación. El estado queda desconocido; vuelve a consultar antes de continuar.',
                true
              );
              await refreshFromServer();
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  if (authLoading || (loading && !user)) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator accessibilityLabel="Cargando sesión" />
      </View>
    );
  }

  if (!user?.uid || userProfile?.role !== 'parent') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Acceso protegido</Text>
        <Text style={styles.body}>
          Esta función requiere una sesión autenticada con perfil de padre o madre.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack?.()}
          accessibilityRole="button"
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity
        onPress={() => navigation.goBack?.()}
        accessibilityRole="button"
        accessibilityLabel="Volver"
        style={styles.backButton}
      >
        <Ionicons name="arrow-back" size={22} color="#17456B" />
        <Text style={styles.backText}>Volver</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Ionicons name="people-circle-outline" size={44} color="#1565C0" />
        <Text style={styles.title}>Pasajeros y autorizaciones</Text>
        <Text style={styles.body}>
          Consulta y administra los registros vinculados a tu cuenta. Solo se muestran estados
          confirmados por el servidor.
        </Text>
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Información importante</Text>
        <Text style={styles.body}>
          Aceptar estas declaraciones no verifica tu identidad ni acredita representación legal. Un
          estado activo es técnico y no constituye una conclusión jurídica.
        </Text>
        {!canSubmitInThisBuild && (
          <Text style={styles.lockedText}>
            Las altas están bloqueadas fuera del proyecto demo de desarrollo.
          </Text>
        )}
      </View>

      {pendingOperations.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Operaciones pendientes ({pendingOperations.length})
          </Text>
          <Text style={styles.body}>
            Selecciona una operación pendiente para reintentarla con su clave de idempotencia
            original:
          </Text>
          {pendingOperations.map((op) => {
            const isSelected = selectedRequestId === op.requestId;
            return (
              <TouchableOpacity
                key={op.requestId}
                accessibilityRole="button"
                onPress={() => handleSelectPending(op)}
                style={[styles.pendingRow, isSelected && styles.pendingRowSelected]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.pendingIdText}>ID: {op.requestId}</Text>
                  <Text style={styles.pendingPassengerText}>Pasajero: {op.passengerId}</Text>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={20} color="#1565C0" />}
              </TouchableOpacity>
            );
          })}
          {selectedRequestId && (
            <TouchableOpacity
              onPress={handleClearSelectedPending}
              accessibilityRole="button"
              style={styles.clearPendingButton}
            >
              <Text style={styles.clearPendingText}>Limpiar selección / Crear nueva operación</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>
          {selectedRequestId ? 'Reintentar operación seleccionada' : 'Registrar pasajero'}
        </Text>
        {pendingCount > 0 && (
          <Text style={styles.pendingText}>
            Hay {pendingCount} operación(es) pendiente(s). Selecciona una arriba o ingresa un nuevo
            registro.
          </Text>
        )}
        <Text style={styles.label}>Alias del pasajero</Text>
        <TextInput
          accessibilityLabel="Alias del pasajero"
          placeholder="Ej.: Pasajero A"
          value={alias}
          onChangeText={setAlias}
          editable={!saving && (!passengerId || !loading)}
          maxLength={60}
          autoCapitalize="words"
          style={styles.input}
        />
        <Text style={styles.label}>Finalidad de transporte</Text>
        <View style={styles.choiceRow}>
          {(
            [
              ['school_transport', 'Escolar'],
              ['extracurricular_transport', 'Actividad extraescolar'],
            ] as const
          ).map(([value, label]) => (
            <TouchableOpacity
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ checked: purpose === value, disabled: saving }}
              onPress={() => setPurpose(value)}
              disabled={saving}
              style={[styles.choice, purpose === value && styles.choiceSelected]}
            >
              <Text style={[styles.choiceText, purpose === value && styles.choiceTextSelected]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.checkRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: responsibilityDeclared, disabled: saving }}
          onPress={() => setResponsibilityDeclared((value) => !value)}
          disabled={saving}
        >
          <Ionicons
            name={responsibilityDeclared ? 'checkbox' : 'square-outline'}
            size={22}
            color="#1565C0"
          />
          <Text style={styles.checkText}>
            Declaro que tengo responsabilidad sobre este pasajero, según el texto de prueba versión{' '}
            {AUTHORIZATION_TEXT_VERSION}.
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.checkRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: privacyNoticeAccepted, disabled: saving }}
          onPress={() => setPrivacyNoticeAccepted((value) => !value)}
          disabled={saving}
        >
          <Ionicons
            name={privacyNoticeAccepted ? 'checkbox' : 'square-outline'}
            size={22}
            color="#1565C0"
          />
          <Text style={styles.checkText}>
            Confirmo que leí el aviso de privacidad de prueba, versión {PRIVACY_NOTICE_VERSION}.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: saving || !canSubmitInThisBuild }}
          style={[styles.primaryButton, (saving || !canSubmitInThisBuild) && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={saving || !canSubmitInThisBuild}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              {selectedRequestId ? 'Reintentar verificación' : 'Enviar solicitud de prueba'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {!!message && (
        <Text
          accessibilityRole={messageIsError ? 'alert' : 'text'}
          style={[styles.message, messageIsError && styles.errorMessage]}
        >
          {message}
        </Text>
      )}

      <View style={styles.card}>
        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Registros confirmados</Text>
          <TouchableOpacity
            onPress={() => void refreshFromServer()}
            disabled={loading || saving}
            accessibilityRole="button"
            accessibilityLabel="Actualizar desde el servidor"
          >
            <Text style={styles.refreshText}>Actualizar</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <ActivityIndicator accessibilityLabel="Consultando servidor" />
        ) : passengers.length === 0 ? (
          <Text style={styles.body}>No hay registros verificables en el servidor.</Text>
        ) : (
          passengers.map((passenger) => (
            <View key={passenger.passengerId} style={styles.passengerRow}>
              <View style={styles.passengerInfo}>
                <Text style={styles.passengerAlias}>{passenger.passengerAlias || 'Pasajero'}</Text>
                <Text style={styles.statusText}>{STATUS_LABELS[passenger.status]}</Text>
                {passenger.status === 'active' && (
                  <Text style={styles.caption}>
                    Estado técnico; no acredita identidad ni representación legal.
                  </Text>
                )}
                {passenger.status === 'revoked' && (
                  <Text
                    style={
                      passenger.authorization?.cleanupStatus === 'completed'
                        ? styles.completedCleanupText
                        : styles.pendingCleanupText
                    }
                  >
                    {passenger.authorization?.cleanupStatus === 'completed'
                      ? 'Purga de ubicación completada con éxito'
                      : 'Purga de ubicación en proceso'}
                  </Text>
                )}
              </View>
              {passenger.status === 'active' && (
                <TouchableOpacity
                  onPress={() => handleRevoke(passenger)}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel="Revocar autorización"
                >
                  <Text style={styles.revokeText}>Revocar</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </View>
      <Text style={styles.footer}>
        El servidor debe confirmar cada operación. Si no puede verificarse el estado, no se concede
        acceso.
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F7FB' },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backText: { color: '#17456B', fontSize: 16, fontWeight: '600', marginLeft: 6 },
  header: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#17456B', marginTop: 8, textAlign: 'center' },
  body: { fontSize: 14, color: '#333', lineHeight: 20, marginTop: 4 },
  notice: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#1565C0',
  },
  noticeTitle: { fontSize: 15, fontWeight: 'bold', color: '#0D47A1', marginBottom: 4 },
  lockedText: { color: '#C62828', fontSize: 13, fontWeight: '600', marginTop: 6 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#17456B', marginBottom: 8 },
  pendingText: { fontSize: 12, color: '#D32F2F', marginBottom: 8, fontWeight: '600' },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#F5F7FA',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 6,
  },
  pendingRowSelected: { backgroundColor: '#E3F2FD', borderColor: '#1565C0' },
  pendingIdText: { fontSize: 11, color: '#64748B', fontFamily: 'monospace' },
  pendingPassengerText: { fontSize: 13, color: '#1E293B', fontWeight: '600', marginTop: 2 },
  clearPendingButton: { padding: 8, alignItems: 'center', marginTop: 4 },
  clearPendingText: { color: '#1565C0', fontSize: 13, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#F8FAFC',
  },
  choiceRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  choice: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  choiceSelected: { backgroundColor: '#1565C0', borderColor: '#1565C0' },
  choiceText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  choiceTextSelected: { color: '#fff' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 12, gap: 10 },
  checkText: { flex: 1, fontSize: 13, color: '#334155', lineHeight: 18 },
  primaryButton: {
    backgroundColor: '#1565C0',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  disabledButton: { backgroundColor: '#94A3B8' },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  secondaryButton: {
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  secondaryButtonText: { color: '#334155', fontSize: 15, fontWeight: '600' },
  message: {
    fontSize: 13,
    color: '#0D9488',
    textAlign: 'center',
    marginVertical: 8,
    fontWeight: '600',
  },
  errorMessage: { color: '#DC2626' },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  refreshText: { color: '#1565C0', fontSize: 13, fontWeight: '600' },
  passengerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  passengerInfo: { flex: 1, marginRight: 8 },
  passengerAlias: { fontSize: 14, fontWeight: 'bold', color: '#1E293B' },
  statusText: { fontSize: 12, color: '#0D9488', fontWeight: '600', marginTop: 2 },
  caption: { fontSize: 11, color: '#64748B', marginTop: 2 },
  pendingCleanupText: { fontSize: 11, color: '#D97706', fontWeight: '600', marginTop: 2 },
  completedCleanupText: { fontSize: 11, color: '#16A34A', fontWeight: '600', marginTop: 2 },
  revokeText: { color: '#DC2626', fontSize: 13, fontWeight: 'bold' },
  footer: { fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 16, marginBottom: 8 },
});

export default PassengerAuthorizationScreen;
