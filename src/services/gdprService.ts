/**
 * GDPR Compliance Service
 *
 * Implements GDPR and COPPA requirements:
 * - Right to Erasure (Delete Account)
 * - Right to Data Portability (Export Data)
 * - Right to Access (View Data)
 * - Consent Management
 *
 * Legal Requirements:
 * - GDPR (EU): General Data Protection Regulation
 * - COPPA (USA): Children's Online Privacy Protection Act
 * - Maximum fine: €20M or 4% of annual revenue (whichever is higher)
 */

import { collection, doc, getDoc, getDocs, getFirestore, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import { isAuthenticationUnavailableError } from '../utils/authError';
import logger from '../utils/logger';
import secureStorage from '../utils/secureStorage';

interface UserData {
  profile: any;
  routes: any[];
  requests: any[];
  trackingHistory: any[];
  vacancies: any[];
  consent: any;
  preferences: any;
}

/**
 * Export all user data in portable format (JSON)
 * GDPR Article 20: Right to Data Portability
 */
export const exportUserData = async (userId: string): Promise<UserData> => {
  logger.info('Exporting user data', { userId });

  try {
    const db = getFirestore();
    const userData: UserData = {
      profile: null,
      routes: [],
      requests: [],
      trackingHistory: [],
      vacancies: [],
      consent: null,
      preferences: null,
    };

    // 1. Get user profile
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      userData.profile = userDocSnap.data();
    }

    // 2. Get user routes (if driver)
    const routesSnapshot = await getDocs(
      query(collection(db, 'routes'), where('driverId', '==', userId))
    );
    userData.routes = routesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 3. Get user requests (if parent)
    const requestsSnapshot = await getDocs(
      query(collection(db, 'requests'), where('parentId', '==', userId))
    );
    userData.requests = requestsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 4. Get tracking history
    const trackingSnapshot = await getDocs(
      query(collection(db, 'trackingPoints'), where('userId', '==', userId))
    );
    userData.trackingHistory = trackingSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 5. Get vacancies (if driver)
    const vacanciesSnapshot = await getDocs(
      query(collection(db, 'vacancies'), where('driverId', '==', userId))
    );
    userData.vacancies = vacanciesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 6. Get consent data from secure storage
    const consent = await secureStorage.getObject('parental_consent');
    userData.consent = consent || null;

    // 7. Get preferences
    const preferences = await secureStorage.getObject('user_preferences');
    userData.preferences = preferences || null;

    logger.info('User data exported successfully', {
      userId,
      profileExists: !!userData.profile,
      routesCount: userData.routes.length,
      requestsCount: userData.requests.length,
      trackingPointsCount: userData.trackingHistory.length,
      vacanciesCount: userData.vacancies.length,
    });

    return userData;
  } catch (error) {
    logger.error('Failed to export user data', { userId, error });
    throw new Error('No se pudo exportar los datos del usuario');
  }
};

export type AccountDeletionStatus = 'none' | 'pending' | 'processing' | 'failed' | 'completed';

export interface AccountDeletionState {
  status: AccountDeletionStatus;
  phase: string | null;
  errorCode: string | null;
  updatedAt: string | null;
}

export class AccountDeletionOperationError extends Error {
  readonly code?: string;
  readonly status?: number;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'AccountDeletionOperationError';
    this.code =
      typeof (cause as { code?: unknown } | null)?.code === 'string'
        ? (cause as { code: string }).code
        : undefined;
    const rawStatus =
      (cause as { status?: unknown } | null)?.status ??
      (cause as { statusCode?: unknown } | null)?.statusCode ??
      (cause as { response?: { status?: unknown } } | null)?.response?.status;
    this.status = typeof rawStatus === 'number' ? rawStatus : undefined;
  }
}

/** Whether an identity can no longer authorize backend requests. */
export const isAccountDeletionAuthenticationError = isAuthenticationUnavailableError;

type CallableData = Record<string, never>;

const requestAccountDeletionCallable = httpsCallable<CallableData, AccountDeletionState>(
  functions,
  'requestAccountDeletion'
);
const getAccountDeletionStatusCallable = httpsCallable<CallableData, AccountDeletionState>(
  functions,
  'getAccountDeletionStatus'
);

const LOCAL_DELETION_KEYS = Object.freeze([
  'parental_consent',
  'user_preferences',
  'premium_status',
  'consent_data',
  'analytics_user_properties',
]);

const clearLocalAccountData = async (): Promise<void> => {
  await Promise.all(
    LOCAL_DELETION_KEYS.map(async (key) => {
      try {
        await secureStorage.removeItem(key);
      } catch (error) {
        logger.warn('Failed to clear local account data', { key, error });
      }
    })
  );
};

/**
 * Request account erasure through the authenticated backend callable.
 *
 * The callable derives the user ID exclusively from `request.auth.uid`; the
 * client cannot select a different account and cannot delete Firebase data
 * directly.
 */
export const requestAccountDeletion = async (): Promise<AccountDeletionState> => {
  try {
    const result = await requestAccountDeletionCallable({});
    if (result.data.status !== 'failed') await clearLocalAccountData();
    logger.warn('Account deletion requested', { status: result.data.status });
    return result.data;
  } catch (error) {
    logger.error('Failed to request account deletion', { error });
    throw new AccountDeletionOperationError(
      'No se pudo solicitar la eliminación de la cuenta',
      error
    );
  }
};

/** Read the deletion state without changing it. */
export const getAccountDeletionStatus = async (): Promise<AccountDeletionState> => {
  try {
    const result = await getAccountDeletionStatusCallable({});
    return result.data;
  } catch (error) {
    logger.error('Failed to get account deletion status', { error });
    throw new AccountDeletionOperationError('No se pudo consultar el estado de eliminación', error);
  }
};

/** Backwards-compatible name for callers that previously deleted directly. */
export const deleteUserAccount = requestAccountDeletion;

/**
 * Get summary of what data we have on a user
 * GDPR Article 15: Right of Access
 */
export const getUserDataSummary = async (userId: string) => {
  logger.info('Getting user data summary', { userId });

  try {
    const db = getFirestore();

    const summary = {
      hasProfile: false,
      routesCount: 0,
      requestsCount: 0,
      trackingPointsCount: 0,
      vacanciesCount: 0,
      hasConsent: false,
      hasPreferences: false,
      lastUpdated: null as string | null,
    };

    // Get user profile
    const userDocRef = doc(db, 'users', userId);
    const userDocSnap = await getDoc(userDocRef);
    summary.hasProfile = userDocSnap.exists();
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      summary.lastUpdated = userData.updatedAt || userData.createdAt || null;
    }

    const routesDocs = await getDocs(
      query(collection(db, 'routes'), where('driverId', '==', userId))
    );
    summary.routesCount = routesDocs.size;

    const requestsDocs = await getDocs(
      query(collection(db, 'requests'), where('parentId', '==', userId))
    );
    summary.requestsCount = requestsDocs.size;

    const trackingDocs = await getDocs(
      query(collection(db, 'trackingPoints'), where('userId', '==', userId))
    );
    summary.trackingPointsCount = trackingDocs.size;

    const vacanciesDocs = await getDocs(
      query(collection(db, 'vacancies'), where('driverId', '==', userId))
    );
    summary.vacanciesCount = vacanciesDocs.size;

    const consent = await secureStorage.getObject('parental_consent');
    summary.hasConsent = !!consent;

    const preferences = await secureStorage.getObject('user_preferences');
    summary.hasPreferences = !!preferences;

    return summary;
  } catch (error) {
    logger.error('Failed to get user data summary', { userId, error });
    throw error;
  }
};

/**
 * Check if parental consent is required for a user
 * COPPA requires consent for children under 13
 */
export const isParentalConsentRequired = (age: number): boolean => {
  // COPPA: Under 13 requires consent
  // GDPR: Under 16 requires consent (varies by EU country)
  // We use COPPA's stricter rule (13) for global compliance
  return age < 13;
};

/**
 * Verify parental consent exists and is valid
 */
export const verifyParentalConsent = async (): Promise<boolean> => {
  try {
    const consent = await secureStorage.getObject('parental_consent');

    if (!consent) {
      return false;
    }

    // Check if consent has all required fields
    const requiredFields = [
      'parentName',
      'parentEmail',
      'childName',
      'childDateOfBirth',
      'consentDate',
      'agreedToTerms',
      'agreedToPrivacy',
    ];

    const isValid = requiredFields.every((field) => {
      const value = consent[field];
      return value !== undefined && value !== null && value !== '';
    });

    if (!isValid) {
      logger.warn('Parental consent is incomplete', { consent });
      return false;
    }

    // Check if consent is not too old (optional: re-verify annually)
    const consentDate = new Date(consent.consentDate);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    if (consentDate < oneYearAgo) {
      logger.warn('Parental consent is older than 1 year', {
        consentDate: consent.consentDate,
      });
      // Still valid, but we should prompt for re-verification
    }

    return true;
  } catch (error) {
    logger.error('Failed to verify parental consent', { error });
    return false;
  }
};

export default {
  exportUserData,
  requestAccountDeletion,
  getAccountDeletionStatus,
  deleteUserAccount,
  getUserDataSummary,
  isParentalConsentRequired,
  verifyParentalConsent,
};
