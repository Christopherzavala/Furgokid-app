/**
 * Custody & OTP Handover Service
 *
 * Connects frontend screens to Cloud Functions for passenger state transitions,
 * secure OTP handover generation/verification, Smart Absence reporting, and real-time state subscription.
 */

import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../config/firebase';

const assertAuthenticated = () => {
  if (!auth.currentUser) {
    const error = new Error('Authentication is required.');
    error.code = 'unauthenticated';
    throw error;
  }
};

/**
 * Maps HttpsError and Firestore errors to clear Spanish messages for UI alerts.
 */
export const mapCustodyError = (error) => {
  const code = typeof error?.code === 'string' ? error.code.toLowerCase() : '';
  const message = error?.message || '';

  if (code.includes('unauthenticated') || message.includes('unauthenticated')) {
    return 'Sesión expirada o no autenticada. Inicia sesión nuevamente.';
  }
  if (code.includes('permission-denied') || message.includes('permission-denied')) {
    if (message.includes('locked')) {
      return 'El PIN ha sido bloqueado temporalmente por demasiados intentos fallidos.';
    }
    return 'No tienes permisos para realizar esta operación de custodia.';
  }
  if (code.includes('failed-precondition') || message.includes('failed-precondition')) {
    return message || 'No se cumplen las condiciones para realizar esta transición de estado.';
  }
  if (code.includes('deadline-exceeded') || message.includes('deadline-exceeded')) {
    return 'El código OTP ha expirado. Por favor, solicita uno nuevo.';
  }
  if (code.includes('not-found') || message.includes('not-found')) {
    return 'El registro solicitado no fue encontrado.';
  }
  if (code.includes('unavailable') || code.includes('network-request-failed')) {
    return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
  }
  return message || 'Ha ocurrido un error inesperado en el servicio de custodia.';
};

const buildIdempotencyKey = (matchId, passengerId, action, customKey) => {
  if (typeof customKey === 'string' && customKey.trim()) {
    return customKey.trim();
  }
  const dateStr = new Date().toISOString().split('T')[0];
  return `${matchId}_${passengerId}_${dateStr}_${action}`;
};

/**
 * Transiciona el estado del pasajero (Conductor: BOARDING_CONFIRMED, IN_TRANSIT, ARRIVAL_CONFIRMED)
 */
export const transitionPassengerState = async ({
  matchId,
  passengerId,
  newState,
  idempotencyKey = undefined,
}) => {
  assertAuthenticated();
  if (!matchId || !passengerId || !newState) {
    throw new Error('matchId, passengerId, and newState are required.');
  }
  const key = buildIdempotencyKey(matchId, passengerId, newState, idempotencyKey);
  const updatePassengerStateFn = httpsCallable(functions, 'updatePassengerState');
  const result = await updatePassengerStateFn({
    matchId,
    passengerId,
    newState,
    idempotencyKey: key,
  });
  return result.data;
};

/**
 * Solicita o regenera un PIN OTP de entrega (Apoderado / Delegado autorizado)
 */
export const requestHandoverOtp = async ({ matchId, passengerId, idempotencyKey = undefined }) => {
  assertAuthenticated();
  if (!matchId || !passengerId) {
    throw new Error('matchId and passengerId are required.');
  }
  const key = buildIdempotencyKey(matchId, passengerId, 'REQUEST_OTP', idempotencyKey);
  const generateOtpFn = httpsCallable(functions, 'generateHandoverOtp');
  const result = await generateOtpFn({ matchId, passengerId, idempotencyKey: key });
  return result.data; // { otpId, expiresAt }
};

/**
 * Verifica el PIN OTP y confirma la entrega segura del estudiante (Conductor)
 */
export const verifyStudentHandover = async ({
  matchId,
  passengerId,
  pin,
  idempotencyKey = undefined,
}) => {
  assertAuthenticated();
  if (!matchId || !passengerId || !pin) {
    throw new Error('matchId, passengerId, and pin are required.');
  }
  const key = buildIdempotencyKey(matchId, passengerId, 'VERIFY_HANDOVER', idempotencyKey);
  const confirmHandoverFn = httpsCallable(functions, 'confirmStudentHandover');
  const result = await confirmHandoverFn({ matchId, passengerId, pin, idempotencyKey: key });
  return result.data;
};

/**
 * Reporta la inasistencia de un estudiante antes del abordaje (Apoderado)
 */
export const reportStudentAbsence = async ({
  matchId,
  passengerId,
  date,
  idempotencyKey = undefined,
}) => {
  assertAuthenticated();
  if (!matchId || !passengerId || !date) {
    throw new Error('matchId, passengerId, and date are required.');
  }
  const key = buildIdempotencyKey(matchId, passengerId, `ABSENCE_${date}`, idempotencyKey);
  const reportAbsenceFn = httpsCallable(functions, 'reportAbsenceCallable');
  const result = await reportAbsenceFn({ matchId, passengerId, date, idempotencyKey: key });
  return result.data;
};

/**
 * Suscripción en tiempo real al documento de estado del pasajero en la colección raíz passengerStates
 */
export const subscribeToPassengerState = (matchId, passengerId, onUpdate, onError) => {
  if (!matchId || !passengerId) {
    if (typeof onError === 'function') onError(new Error('matchId and passengerId are required.'));
    return () => {};
  }
  const docRef = doc(db, 'passengerStates', `${matchId}_${passengerId}`);
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate({ id: snapshot.id, ...snapshot.data() });
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      if (typeof onError === 'function') onError(error);
    }
  );
};
