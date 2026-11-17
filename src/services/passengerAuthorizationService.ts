import { httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';
import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  query,
  where,
} from 'firebase/firestore';
import { db, functions } from '../config/firebase';
import secureStorage from '../utils/secureStorage';

export type PassengerPurpose = 'school_transport' | 'extracurricular_transport';
export type PassengerAuthorizationStatus =
  | 'pending'
  | 'active'
  | 'revoked'
  | 'expired'
  | 'rejected'
  | 'unknown';

export interface PassengerOnboardingInput {
  passengerId: string;
  passengerAlias: string;
  purpose: PassengerPurpose;
  privacyNoticeVersion: string;
  authorizationTextVersion: string;
  responsibilityDeclared: true;
  privacyNoticeAccepted: true;
}

export interface PassengerAuthorizationRecord {
  passengerId: string;
  authorizationId: string;
  status: PassengerAuthorizationStatus;
  responsibilityDeclared: boolean;
  privacyNoticeAccepted: boolean;
  acceptedAt?: string;
}

export type PassengerOperationErrorKind = 'known' | 'unknown';
export class PassengerAuthorizationError extends Error {
  code: string;
  kind: PassengerOperationErrorKind;
  constructor(code: string, kind: PassengerOperationErrorKind) {
    super('Passenger authorization operation could not be completed.');
    this.name = 'PassengerAuthorizationError';
    this.code = code;
    this.kind = kind;
  }
}

interface PendingOperation {
  requestId: string;
  passengerId: string;
}
interface ServiceDependencies {
  currentUid: () => string | null;
  call: (name: string, data: Record<string, unknown>) => Promise<unknown>;
  readPassengers: (uid: string) => Promise<any[]>;
  readAuthorization: (authorizationId: string) => Promise<any | null>;
  storage: Pick<typeof secureStorage, 'getObject' | 'setObject' | 'removeItem'>;
  createId: () => string;
}

const PENDING_PREFIX = 'passenger_authorization_pending_v1';
const VALID_STATUSES = new Set(['pending', 'active', 'revoked', 'expired', 'rejected']);
const PURPOSES = new Set<PassengerPurpose>(['school_transport', 'extracurricular_transport']);
const KNOWN_ERROR_CODES = new Set([
  'functions/invalid-argument',
  'functions/failed-precondition',
  'functions/permission-denied',
  'functions/not-found',
  'functions/already-exists',
  'functions/unauthenticated',
]);

const normalizeError = (error: unknown): PassengerAuthorizationError => {
  const rawCode =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: unknown }).code || 'unknown')
      : 'unknown';
  const code = rawCode.startsWith('functions/') ? rawCode : `functions/${rawCode}`;
  return new PassengerAuthorizationError(code, KNOWN_ERROR_CODES.has(code) ? 'known' : 'unknown');
};

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const getCurrentUid = (): string | null => {
  return getAuth().currentUser?.uid || null;
};

const defaultDependencies: ServiceDependencies = {
  currentUid: getCurrentUid,
  call: async (name, data) => {
    const callable = httpsCallable(functions, name);
    const result = await callable(data);
    return result.data;
  },
  readPassengers: async (uid) => {
    const snapshot = await getDocsFromServer(
      query(collection(db, 'passengers'), where('parentId', '==', uid))
    );
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  },
  readAuthorization: async (authorizationId) => {
    const snapshot = await getDocFromServer(doc(db, 'passengerAuthorizations', authorizationId));
    return snapshot.exists() ? snapshot.data() : null;
  },
  storage: secureStorage,
  createId: () => {
    const randomUUID = globalThis.crypto?.randomUUID;
    if (randomUUID) return randomUUID.call(globalThis.crypto);
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random()
      .toString(36)
      .slice(2)}`;
  },
};

export const createPassengerAuthorizationService = (
  dependencies: ServiceDependencies = defaultDependencies
) => {
  const requireUid = () => {
    const uid = dependencies.currentUid();
    if (!uid) throw new PassengerAuthorizationError('functions/unauthenticated', 'known');
    return uid;
  };
  const ensureUidUnchanged = (expectedUid: string) => {
    if (dependencies.currentUid() !== expectedUid) {
      throw new PassengerAuthorizationError('functions/unauthenticated', 'known');
    }
  };
  const pendingKey = (uid: string, requestId: string) => `${PENDING_PREFIX}.${uid}.${requestId}`;
  const pendingIndexKey = (uid: string) => `${PENDING_PREFIX}.${uid}.index`;
  const readPending = async (uid: string, requestId: string): Promise<PendingOperation | null> => {
    const value = await dependencies.storage.getObject(pendingKey(uid, requestId));
    return isRecord(value) && value.requestId === requestId && typeof value.passengerId === 'string'
      ? { requestId, passengerId: value.passengerId }
      : null;
  };

  const createOperation = async (passengerId: string) => {
    const uid = requireUid();
    if (!passengerId?.trim())
      throw new PassengerAuthorizationError('functions/invalid-argument', 'known');
    const requestId = dependencies.createId();
    await dependencies.storage.setObject(pendingKey(uid, requestId), { requestId, passengerId });
    const index = await dependencies.storage.getObject(pendingIndexKey(uid));
    const operations = Array.isArray(index)
      ? index.filter((item) => isRecord(item) && typeof item.requestId === 'string')
      : [];
    await dependencies.storage.setObject(pendingIndexKey(uid), [
      ...operations,
      { requestId, passengerId },
    ]);
    return { requestId };
  };

  const onboardPassenger = async (input: PassengerOnboardingInput, requestId?: string) => {
    const uid = requireUid();
    if (
      !input?.passengerId?.trim() ||
      !input.passengerAlias?.trim() ||
      !PURPOSES.has(input.purpose) ||
      !input.privacyNoticeVersion?.trim() ||
      !input.authorizationTextVersion?.trim() ||
      input.responsibilityDeclared !== true ||
      input.privacyNoticeAccepted !== true
    ) {
      throw new PassengerAuthorizationError('functions/invalid-argument', 'known');
    }
    let operationId = requestId;
    if (operationId) {
      const pending = await readPending(uid, operationId);
      if (!pending || pending.passengerId !== input.passengerId) {
        throw new PassengerAuthorizationError('operation-not-found', 'known');
      }
    } else {
      const recoverable = await getPendingOperations();
      const existing = recoverable.find((operation) => operation.passengerId === input.passengerId);
      if (existing) operationId = existing.requestId;
      else {
        const operation = await createOperation(input.passengerId);
        operationId = operation.requestId;
      }
    }
    const stableOperationId = operationId;
    if (!stableOperationId)
      throw new PassengerAuthorizationError('request-id-unavailable', 'known');
    let response: any;
    try {
      ensureUidUnchanged(uid);
      response = await dependencies.call('onboardPassenger', {
        ...input,
        requestId: stableOperationId,
      });
      ensureUidUnchanged(uid);
    } catch (error) {
      throw normalizeError(error);
    }
    if (
      !isRecord(response) ||
      response.passengerId !== input.passengerId ||
      typeof response.authorizationId !== 'string' ||
      !response.authorizationId
    ) {
      throw new PassengerAuthorizationError('response-unverified', 'unknown');
    }
    const persisted = await getPassengerAuthorization(response.authorizationId);
    ensureUidUnchanged(uid);
    if (persisted.status === 'unknown' || persisted.passengerId !== input.passengerId) {
      throw new PassengerAuthorizationError('response-unverified', 'unknown');
    }
    await dependencies.storage.removeItem(pendingKey(uid, stableOperationId));
    const index = await dependencies.storage.getObject(pendingIndexKey(uid));
    if (Array.isArray(index)) {
      const remaining = index.filter(
        (item) => isRecord(item) && item.requestId !== stableOperationId
      );
      await dependencies.storage.setObject(pendingIndexKey(uid), remaining);
    }
    return { operationId, result: persisted };
  };

  const getPassengers = async () => {
    const uid = requireUid();
    let documents: any[];
    try {
      documents = await dependencies.readPassengers(uid);
    } catch (error) {
      throw normalizeError(error);
    }
    return Promise.all(
      documents.map(async (passenger) => {
        if (
          !isRecord(passenger) ||
          passenger.parentId !== uid ||
          passenger.id !== passenger.passengerId
        )
          return null;
        const authorization = await getPassengerAuthorization(passenger.latestAuthorizationId);
        return {
          passengerId: passenger.passengerId,
          passengerAlias:
            typeof passenger.passengerAlias === 'string' ? passenger.passengerAlias : '',
          status: authorization.status,
          authorization,
        };
      })
    ).then((items) => items.filter(Boolean));
  };

  const getPassengerAuthorization = async (
    authorizationId: string
  ): Promise<PassengerAuthorizationRecord> => {
    const uid = requireUid();
    if (!authorizationId?.trim())
      return {
        passengerId: '',
        authorizationId: '',
        status: 'unknown',
        responsibilityDeclared: false,
        privacyNoticeAccepted: false,
      };
    let record: any;
    try {
      record = await dependencies.readAuthorization(authorizationId);
    } catch {
      return {
        passengerId: '',
        authorizationId,
        status: 'unknown',
        responsibilityDeclared: false,
        privacyNoticeAccepted: false,
      };
    }
    if (
      !isRecord(record) ||
      record.guardianId !== uid ||
      record.authorizationId !== authorizationId
    ) {
      return {
        passengerId: '',
        authorizationId,
        status: 'unknown',
        responsibilityDeclared: false,
        privacyNoticeAccepted: false,
      };
    }
    return {
      passengerId: typeof record.passengerId === 'string' ? record.passengerId : '',
      authorizationId,
      status: VALID_STATUSES.has(record.status) ? record.status : 'unknown',
      responsibilityDeclared: record.responsibilityDeclared === true,
      privacyNoticeAccepted: record.privacyNoticeAccepted === true,
      acceptedAt:
        typeof record.acceptedAt?.toDate === 'function'
          ? record.acceptedAt.toDate().toISOString()
          : undefined,
    };
  };

  const revokePassengerAuthorization = async (passengerId: string, authorizationId: string) => {
    const uid = requireUid();
    const current = await getPassengerAuthorization(authorizationId);
    if (current.status === 'unknown' || current.passengerId !== passengerId) {
      throw new PassengerAuthorizationError('functions/permission-denied', 'known');
    }
    try {
      ensureUidUnchanged(uid);
      await dependencies.call('updatePassengerAuthorizationStatus', {
        passengerId,
        authorizationId,
        newStatus: 'revoked',
      });
      ensureUidUnchanged(uid);
    } catch (error) {
      throw normalizeError(error);
    }
    const updated = await getPassengerAuthorization(authorizationId);
    ensureUidUnchanged(uid);
    if (updated.status !== 'revoked' || updated.passengerId !== passengerId) {
      throw new PassengerAuthorizationError('revocation-unverified', 'unknown');
    }
    return updated;
  };

  const getPendingOperations = async () => {
    const uid = requireUid();
    const values = await dependencies.storage.getObject(pendingIndexKey(uid));
    return Array.isArray(values)
      ? values.filter(
          (item) =>
            isRecord(item) &&
            typeof item.requestId === 'string' &&
            typeof item.passengerId === 'string'
        )
      : [];
  };

  return {
    createOperation,
    onboardPassenger,
    getPassengers,
    getPassengerAuthorization,
    revokePassengerAuthorization,
    getPendingOperations,
  };
};

const passengerAuthorizationService = createPassengerAuthorizationService();
export default passengerAuthorizationService;
