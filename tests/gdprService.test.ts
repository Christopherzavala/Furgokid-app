/// <reference types="jest" />
/**
 * Unit tests for src/services/gdprService.ts
 *
 * Regression coverage for GDPR/COPPA compliance functions.
 * All Firebase and storage dependencies are mocked — no emulator required.
 *
 * Key regression: exportUserData and deleteUserAccount must access the user
 * profile via doc(db, 'users', userId) + getDoc(), NOT via a collection query
 * filtered by a 'uid' field.
 */

// ---------------------------------------------------------------------------
// Mock: firebase/firestore
// ---------------------------------------------------------------------------

const mockBatchDelete = jest.fn();
const mockBatchCommit = jest.fn(() => Promise.resolve());
const mockWriteBatch = jest.fn(() => ({
  delete: mockBatchDelete,
  commit: mockBatchCommit,
}));

const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockDoc = jest.fn((_db: unknown, ...pathSegments: string[]) => ({
  __path: pathSegments.join('/'),
}));
const mockCollection = jest.fn((_db: unknown, col: string) => ({ __col: col }));
const mockQuery = jest.fn((...args: unknown[]) => args);
const mockWhere = jest.fn((...args: unknown[]) => args);
const mockGetFirestore = jest.fn(() => ({}));

jest.mock('firebase/firestore', () => ({
  getFirestore: (...args: unknown[]) => mockGetFirestore(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
}));

// ---------------------------------------------------------------------------
// Mock: firebase/functions
// ---------------------------------------------------------------------------

const mockRequestCallable = jest.fn();
const mockStatusCallable = jest.fn();

jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn((_functions: unknown, name: string) => async (...args: unknown[]) => {
    // Delegate at call time. Babel hoists imports above the mock constants,
    // so capturing them while this factory is evaluated yields undefined.
    const callable = name === 'requestAccountDeletion' ? mockRequestCallable : mockStatusCallable;
    return callable(...args);
  }),
}));

jest.mock('../src/config/firebase', () => ({
  functions: {},
}));

// ---------------------------------------------------------------------------
// Mock: logger
// ---------------------------------------------------------------------------

jest.mock('../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock: secureStorage
// ---------------------------------------------------------------------------

jest.mock('../src/utils/secureStorage', () => {
  const mockSecureStorage = {
    getObject: jest.fn(() => Promise.resolve(null)),
    removeItem: jest.fn(() => Promise.resolve()),
  };
  return {
    __esModule: true,
    default: mockSecureStorage,
  };
});

// Get reference to the mock for test manipulation
const mockSecureStorage = jest.requireMock('../src/utils/secureStorage').default;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a Firestore document snapshot stub. */
function makeDocSnap(exists: boolean, data?: Record<string, unknown>) {
  return {
    exists: () => exists,
    data: () => (exists ? data : undefined),
    id: 'stub-id',
  };
}

/** Build a Firestore query snapshot stub. */
function makeQuerySnap(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  const docSnapshots = docs.map((d) => ({ id: d.id, data: () => d.data }));
  return {
    docs: docSnapshots,
    size: docs.length,
    empty: docs.length === 0,
    forEach: (callback: (doc: { id: string; data: () => Record<string, unknown> }) => void) => {
      docSnapshots.forEach(callback);
    },
  };
}

// ---------------------------------------------------------------------------
// Import after all mocks are registered
// ---------------------------------------------------------------------------

import {
  AccountDeletionOperationError,
  deleteUserAccount,
  exportUserData,
  getAccountDeletionStatus,
  getUserDataSummary,
  isAccountDeletionAuthenticationError,
  requestAccountDeletion,
} from '../src/services/gdprService';

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

const USER_ID = 'user-123';

beforeEach(() => {
  jest.clearAllMocks();

  // Reset callable implementations explicitly so each test starts from a
  // deterministic backend response.
  mockRequestCallable.mockReset();
  mockStatusCallable.mockReset();

  // Default: all getDocs return empty snapshots
  mockGetDocs.mockResolvedValue(makeQuerySnap([]));

  // Default: the backend accepts the request and continues asynchronously.
  mockRequestCallable.mockResolvedValue({
    data: {
      status: 'pending',
      phase: 'matches',
      errorCode: null,
      updatedAt: null,
    },
  });
  mockStatusCallable.mockResolvedValue({
    data: {
      status: 'processing',
      phase: 'collections',
      errorCode: null,
      updatedAt: null,
    },
  });

  // Default: secureStorage returns nothing
  mockSecureStorage.getObject.mockResolvedValue(null);
  mockSecureStorage.removeItem.mockResolvedValue(undefined);
});

// ===========================================================================
// exportUserData
// ===========================================================================

describe('exportUserData', () => {
  describe('profile access pattern (regression)', () => {
    it('calls doc(db, "users", userId) to build the profile reference', async () => {
      mockGetDoc.mockResolvedValue(makeDocSnap(false));

      await exportUserData(USER_ID);

      // doc() must have been called with the users collection and the exact userId
      const docCalls = mockDoc.mock.calls;
      const profileCall = docCalls.find((args) => args[1] === 'users' && args[2] === USER_ID);
      expect(profileCall).toBeDefined();
    });

    it('calls getDoc() (not getDocs) to fetch the profile', async () => {
      mockGetDoc.mockResolvedValue(makeDocSnap(false));

      await exportUserData(USER_ID);

      // getDoc must have been called at least once (for the profile)
      expect(mockGetDoc).toHaveBeenCalled();
    });

    it('does NOT use a where("uid", "==", userId) query for the profile', async () => {
      mockGetDoc.mockResolvedValue(makeDocSnap(false));

      await exportUserData(USER_ID);

      // where() calls that filter by 'uid' field must not exist
      const uidFieldQueries = mockWhere.mock.calls.filter(
        (args) => args[0] === 'uid' && args[1] === '==' && args[2] === USER_ID
      );
      expect(uidFieldQueries).toHaveLength(0);
    });
  });

  describe('when profile exists', () => {
    it('returns the profile data', async () => {
      const profileData = { name: 'Alice', role: 'parent' };
      mockGetDoc.mockResolvedValue(makeDocSnap(true, profileData));

      const result = await exportUserData(USER_ID);

      expect(result.profile).toEqual(profileData);
    });

    it('returns routes, requests, trackingHistory and vacancies from getDocs', async () => {
      mockGetDoc.mockResolvedValue(makeDocSnap(true, { name: 'Alice' }));
      mockGetDocs
        .mockResolvedValueOnce(makeQuerySnap([{ id: 'r1', data: { driverId: USER_ID } }])) // routes
        .mockResolvedValueOnce(makeQuerySnap([{ id: 'req1', data: { parentId: USER_ID } }])) // requests
        .mockResolvedValueOnce(makeQuerySnap([])) // trackingPoints
        .mockResolvedValueOnce(makeQuerySnap([])); // vacancies

      const result = await exportUserData(USER_ID);

      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].id).toBe('r1');
      expect(result.requests).toHaveLength(1);
      expect(result.requests[0].id).toBe('req1');
      expect(result.trackingHistory).toHaveLength(0);
      expect(result.vacancies).toHaveLength(0);
    });

    it('includes consent and preferences from secureStorage', async () => {
      mockGetDoc.mockResolvedValue(makeDocSnap(true, { name: 'Alice' }));
      mockSecureStorage.getObject
        .mockResolvedValueOnce({ parentName: 'Bob', agreedToTerms: true }) // parental_consent
        .mockResolvedValueOnce({ theme: 'dark' }); // user_preferences

      const result = await exportUserData(USER_ID);

      expect(result.consent).toEqual({ parentName: 'Bob', agreedToTerms: true });
      expect(result.preferences).toEqual({ theme: 'dark' });
    });
  });

  describe('when profile does NOT exist', () => {
    it('returns null profile without throwing', async () => {
      mockGetDoc.mockResolvedValue(makeDocSnap(false));

      const result = await exportUserData(USER_ID);

      expect(result.profile).toBeNull();
    });

    it('still returns empty arrays for collections', async () => {
      mockGetDoc.mockResolvedValue(makeDocSnap(false));

      const result = await exportUserData(USER_ID);

      expect(result.routes).toEqual([]);
      expect(result.requests).toEqual([]);
      expect(result.trackingHistory).toEqual([]);
      expect(result.vacancies).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('throws a localised error when Firestore fails', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore unavailable'));

      await expect(exportUserData(USER_ID)).rejects.toThrow(
        'No se pudo exportar los datos del usuario'
      );
    });
  });
});

// ===========================================================================
// Account deletion callables
// ===========================================================================

describe('account deletion', () => {
  it('requests deletion without sending a user ID or other payload', async () => {
    const state = await requestAccountDeletion();

    expect(mockRequestCallable).toHaveBeenCalledTimes(1);
    expect(mockRequestCallable).toHaveBeenCalledWith({});
    expect(state.status).toBe('pending');
    expect(state.phase).toBe('matches');
  });

  it('keeps deleteUserAccount as a request-only compatibility alias', async () => {
    const state = await deleteUserAccount();

    expect(mockRequestCallable).toHaveBeenCalledTimes(1);
    expect(mockRequestCallable).toHaveBeenCalledWith({});
    expect(state.status).toBe('pending');
  });

  it('returns the backend deletion status without mutating local data', async () => {
    const state = await getAccountDeletionStatus();

    expect(mockStatusCallable).toHaveBeenCalledTimes(1);
    expect(mockStatusCallable).toHaveBeenCalledWith({});
    expect(state).toEqual({
      status: 'processing',
      phase: 'collections',
      errorCode: null,
      updatedAt: null,
    });
    expect(mockSecureStorage.removeItem).not.toHaveBeenCalled();
  });

  it('removes all expected local preference keys after acceptance', async () => {
    await requestAccountDeletion();

    const removedKeys = mockSecureStorage.removeItem.mock.calls.map((call) => call[0]);
    expect(removedKeys).toEqual(
      expect.arrayContaining([
        'parental_consent',
        'user_preferences',
        'premium_status',
        'consent_data',
        'analytics_user_properties',
      ])
    );
  });

  it('does not delete Firestore, Storage, or Auth directly', async () => {
    await requestAccountDeletion();

    expect(mockBatchDelete).not.toHaveBeenCalled();
    expect(mockBatchCommit).not.toHaveBeenCalled();
    expect(mockGetDoc).not.toHaveBeenCalled();
  });

  it('throws a localised domain error when the request callable fails', async () => {
    mockRequestCallable.mockRejectedValueOnce(new Error('network unavailable'));

    const operation = requestAccountDeletion();

    await expect(operation).rejects.toBeInstanceOf(AccountDeletionOperationError);
    await expect(operation).rejects.toThrow('No se pudo solicitar la eliminación de la cuenta');
  });

  it('throws a localised domain error when the status callable fails', async () => {
    mockStatusCallable.mockRejectedValueOnce(new Error('network unavailable'));

    const operation = getAccountDeletionStatus();

    await expect(operation).rejects.toBeInstanceOf(AccountDeletionOperationError);
    await expect(operation).rejects.toThrow('No se pudo consultar el estado de eliminación');
  });

  it('preserves the callable code and status for authentication failures', async () => {
    mockStatusCallable.mockRejectedValueOnce({
      code: 'functions/unauthenticated',
      status: 401,
    });

    const operation = getAccountDeletionStatus();
    const error = await operation.catch((caughtError) => caughtError);

    expect(error).toBeInstanceOf(AccountDeletionOperationError);
    expect(error).toMatchObject({
      code: 'functions/unauthenticated',
      status: 401,
    });
    expect(isAccountDeletionAuthenticationError(error)).toBe(true);
  });
});

// ===========================================================================
// getUserDataSummary
// ===========================================================================

describe('getUserDataSummary', () => {
  describe('when profile exists', () => {
    it('returns hasProfile: true', async () => {
      mockGetDoc.mockResolvedValue(makeDocSnap(true, { updatedAt: '2024-01-01' }));

      const summary = await getUserDataSummary(USER_ID);

      expect(summary.hasProfile).toBe(true);
    });

    it('returns lastUpdated from updatedAt field', async () => {
      mockGetDoc.mockResolvedValue(makeDocSnap(true, { updatedAt: '2024-06-15' }));

      const summary = await getUserDataSummary(USER_ID);

      expect(summary.lastUpdated).toBe('2024-06-15');
    });

    it('falls back to createdAt when updatedAt is absent', async () => {
      mockGetDoc.mockResolvedValue(makeDocSnap(true, { createdAt: '2024-01-01' }));

      const summary = await getUserDataSummary(USER_ID);

      expect(summary.lastUpdated).toBe('2024-01-01');
    });
  });

  describe('when profile does NOT exist', () => {
    it('returns hasProfile: false', async () => {
      mockGetDoc.mockResolvedValue(makeDocSnap(false));

      const summary = await getUserDataSummary(USER_ID);

      expect(summary.hasProfile).toBe(false);
    });

    it('returns lastUpdated: null', async () => {
      mockGetDoc.mockResolvedValue(makeDocSnap(false));

      const summary = await getUserDataSummary(USER_ID);

      expect(summary.lastUpdated).toBeNull();
    });
  });

  describe('collection counts', () => {
    it('returns correct counts from getDocs', async () => {
      mockGetDoc.mockResolvedValue(makeDocSnap(false));
      mockGetDocs
        .mockResolvedValueOnce({ size: 3, docs: [] }) // routes
        .mockResolvedValueOnce({ size: 2, docs: [] }) // requests
        .mockResolvedValueOnce({ size: 5, docs: [] }) // trackingPoints
        .mockResolvedValueOnce({ size: 1, docs: [] }); // vacancies

      const summary = await getUserDataSummary(USER_ID);

      expect(summary.routesCount).toBe(3);
      expect(summary.requestsCount).toBe(2);
      expect(summary.trackingPointsCount).toBe(5);
      expect(summary.vacanciesCount).toBe(1);
    });

    it('returns zero counts when all collections are empty', async () => {
      mockGetDoc.mockResolvedValue(makeDocSnap(false));

      const summary = await getUserDataSummary(USER_ID);

      expect(summary.routesCount).toBe(0);
      expect(summary.requestsCount).toBe(0);
      expect(summary.trackingPointsCount).toBe(0);
      expect(summary.vacanciesCount).toBe(0);
    });
  });

  describe('consent and preferences flags', () => {
    it('returns hasConsent: true when parental_consent exists in secureStorage', async () => {
      mockGetDoc.mockResolvedValue(makeDocSnap(false));
      mockSecureStorage.getObject
        .mockResolvedValueOnce({ parentName: 'Bob' }) // parental_consent
        .mockResolvedValueOnce(null); // user_preferences

      const summary = await getUserDataSummary(USER_ID);

      expect(summary.hasConsent).toBe(true);
      expect(summary.hasPreferences).toBe(false);
    });

    it('returns hasPreferences: true when user_preferences exists', async () => {
      mockGetDoc.mockResolvedValue(makeDocSnap(false));
      mockSecureStorage.getObject
        .mockResolvedValueOnce(null) // parental_consent
        .mockResolvedValueOnce({ theme: 'dark' }); // user_preferences

      const summary = await getUserDataSummary(USER_ID);

      expect(summary.hasConsent).toBe(false);
      expect(summary.hasPreferences).toBe(true);
    });
  });

  describe('error handling', () => {
    it('re-throws Firestore errors without wrapping', async () => {
      const originalError = new Error('Firestore unavailable');
      mockGetDoc.mockRejectedValue(originalError);

      await expect(getUserDataSummary(USER_ID)).rejects.toThrow('Firestore unavailable');
    });
  });
});
