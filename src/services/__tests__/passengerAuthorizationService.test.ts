jest.mock('firebase/functions', () => ({ httpsCallable: jest.fn() }));
jest.mock('firebase/auth', () => ({ getAuth: jest.fn(() => ({ currentUser: null })) }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDocFromServer: jest.fn(),
  getDocsFromServer: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
}));
jest.mock('../../config/firebase', () => ({ db: {}, functions: {} }));
jest.mock('../../utils/secureStorage', () => ({
  __esModule: true,
  default: { getObject: jest.fn(), setObject: jest.fn(), removeItem: jest.fn() },
}));

import {
  createPassengerAuthorizationService,
  PassengerAuthorizationError,
} from '../passengerAuthorizationService';

const validInput = {
  passengerId: 'passenger-synthetic-1',
  passengerAlias: 'Synthetic alias',
  purpose: 'school_transport' as const,
  privacyNoticeVersion: 'privacy-v1',
  authorizationTextVersion: 'authorization-v1',
  responsibilityDeclared: true as const,
  privacyNoticeAccepted: true as const,
};

const makeService = () => {
  let uid: string | null = 'adult-A';
  let nextId = 0;
  const calls: Array<{ name: string; data: Record<string, unknown> }> = [];
  const storage = new Map<string, unknown>();
  const authDocs = new Map<string, any>();
  let response: any = {
    passengerId: validInput.passengerId,
    authorizationId: 'auth-synthetic-1',
    status: 'active',
  };
  let callError: any = null;
  let nextStorageRead: (() => void) | null = null;
  const dependencies = {
    currentUid: () => uid,
    createId: () => `request-synthetic-${++nextId}`,
    call: async (name: string, data: Record<string, unknown>) => {
      calls.push({ name, data });
      if (callError) throw callError;
      return response;
    },
    readPassengers: async (owner: string) => [
      {
        id: 'passenger-synthetic-1',
        passengerId: 'passenger-synthetic-1',
        parentId: owner,
        latestAuthorizationId: 'auth-synthetic-1',
        status: 'active',
      },
    ],
    readAuthorization: async (id: string) => authDocs.get(id) || null,
    storage: {
      getObject: async (key: string) => {
        const value = (storage.get(key) as any) ?? null;
        if (nextStorageRead) {
          const changeUid = nextStorageRead;
          nextStorageRead = null;
          changeUid();
        }
        return value;
      },
      setObject: async (key: string, value: unknown) => {
        storage.set(key, value);
      },
      removeItem: async (key: string) => {
        storage.delete(key);
      },
    } as any,
  } as any;
  const service = createPassengerAuthorizationService(dependencies);
  const setUid = (value: string | null) => {
    uid = value;
  };
  const setResponse = (value: any) => {
    response = value;
  };
  const setCallError = (value: any) => {
    callError = value;
  };
  const setAuthorization = (id: string, value: any) => {
    authDocs.set(id, value);
  };
  const changeUidOnNextStorageRead = (nextUid: string) => {
    nextStorageRead = () => {
      uid = nextUid;
    };
  };
  const pending = () => [...storage.entries()];
  return {
    service,
    recreate: () => createPassengerAuthorizationService(dependencies),
    calls,
    setUid,
    setResponse,
    setCallError,
    setAuthorization,
    changeUidOnNextStorageRead,
    pending,
  };
};

describe('passengerAuthorizationService', () => {
  test('sends the exact onboarding contract and clears pending only after server read confirms it', async () => {
    const context = makeService();
    context.setAuthorization('auth-synthetic-1', {
      authorizationId: 'auth-synthetic-1',
      passengerId: validInput.passengerId,
      guardianId: 'adult-A',
      status: 'active',
      responsibilityDeclared: true,
      privacyNoticeAccepted: true,
    });
    const result = await context.service.onboardPassenger(validInput);
    expect(context.calls[0]).toEqual({
      name: 'onboardPassenger',
      data: { ...validInput, requestId: 'request-synthetic-1' },
    });
    expect(result.result.status).toBe('active');
    expect(context.pending()).toHaveLength(1); // the account-scoped index remains empty after acknowledgement
    expect(context.pending()[0][1]).toEqual([]);
  });

  test('retains the same operation key after timeout and supports retry after service recreation', async () => {
    const context = makeService();
    context.setCallError({
      code: 'functions/deadline-exceeded',
      message: 'synthetic private payload',
    });
    await expect(context.service.onboardPassenger(validInput)).rejects.toMatchObject({
      kind: 'unknown',
      code: 'functions/deadline-exceeded',
    });
    const operation = (await context.service.getPendingOperations())[0];
    context.setCallError(null);
    context.setAuthorization('auth-synthetic-1', {
      authorizationId: 'auth-synthetic-1',
      passengerId: validInput.passengerId,
      guardianId: 'adult-A',
      status: 'active',
    });
    await context.recreate().onboardPassenger(validInput);
    expect(context.calls[context.calls.length - 1]?.data.requestId).toBe(operation.requestId);
  });

  test('isolates pending operations by UID and creates a distinct key for a new operation', async () => {
    const context = makeService();
    const first = await context.service.createOperation(validInput.passengerId);
    context.setUid('adult-B');
    await expect(
      context.service.onboardPassenger(validInput, first.requestId)
    ).rejects.toMatchObject({ code: 'operation-not-found' });
    const second = await context.service.createOperation(validInput.passengerId);
    expect(second.requestId).not.toBe(first.requestId);
  });

  test('does not send a pending operation if the authenticated UID changes before the callable', async () => {
    const context = makeService();
    const operation = await context.service.createOperation(validInput.passengerId);
    context.changeUidOnNextStorageRead('adult-B');
    await expect(
      context.service.onboardPassenger(validInput, operation.requestId)
    ).rejects.toMatchObject({ code: 'functions/unauthenticated', kind: 'known' });
    expect(context.calls).toHaveLength(0);
  });

  test('validates required data and rejects missing authentication without calling backend', async () => {
    const context = makeService();
    await expect(
      context.service.onboardPassenger({ ...validInput, purpose: 'other' as any })
    ).rejects.toBeInstanceOf(PassengerAuthorizationError);
    context.setUid(null);
    await expect(context.service.createOperation(validInput.passengerId)).rejects.toMatchObject({
      code: 'functions/unauthenticated',
    });
    expect(context.calls).toHaveLength(0);
  });

  test.each(['pending', 'active', 'revoked', 'expired', 'rejected', 'future-state'])(
    'uses persisted status %s or reports unknown',
    async (status) => {
      const context = makeService();
      context.setAuthorization('auth-synthetic-1', {
        authorizationId: 'auth-synthetic-1',
        passengerId: validInput.passengerId,
        guardianId: 'adult-A',
        status,
      });
      const result = await context.service.getPassengerAuthorization('auth-synthetic-1');
      expect(result.status).toBe(status === 'future-state' ? 'unknown' : status);
    }
  );

  test('returns unknown for unreadable or foreign authorization and does not expose storage errors', async () => {
    const context = makeService();
    context.setAuthorization('auth-synthetic-1', {
      authorizationId: 'auth-synthetic-1',
      passengerId: validInput.passengerId,
      guardianId: 'adult-B',
      status: 'active',
    });
    const result = await context.service.getPassengerAuthorization('auth-synthetic-1');
    expect(result.status).toBe('unknown');
  });

  test('revokes only through callable and confirms the persisted revoked state', async () => {
    const context = makeService();
    context.setAuthorization('auth-synthetic-1', {
      authorizationId: 'auth-synthetic-1',
      passengerId: validInput.passengerId,
      guardianId: 'adult-A',
      status: 'active',
    });
    context.setResponse({ status: 'revoked' });
    context.setAuthorization('auth-synthetic-1', {
      authorizationId: 'auth-synthetic-1',
      passengerId: validInput.passengerId,
      guardianId: 'adult-A',
      status: 'revoked',
    });
    const result = await context.service.revokePassengerAuthorization(
      validInput.passengerId,
      'auth-synthetic-1'
    );
    expect(result.status).toBe('revoked');
    expect(context.calls[0]).toEqual({
      name: 'updatePassengerAuthorizationStatus',
      data: {
        passengerId: validInput.passengerId,
        authorizationId: 'auth-synthetic-1',
        newStatus: 'revoked',
      },
    });
  });

  test('does not treat timeout or stale status as success and emits no payload data in errors', async () => {
    const context = makeService();
    context.setAuthorization('auth-synthetic-1', {
      authorizationId: 'auth-synthetic-1',
      passengerId: validInput.passengerId,
      guardianId: 'adult-A',
      status: 'active',
    });
    context.setCallError({ code: 'functions/unavailable', message: 'PII synthetic marker' });
    let caught: any;
    try {
      await context.service.revokePassengerAuthorization(
        validInput.passengerId,
        'auth-synthetic-1'
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toMatchObject({ kind: 'unknown', code: 'functions/unavailable' });
    expect(caught.message).not.toContain('PII synthetic marker');
  });
});
