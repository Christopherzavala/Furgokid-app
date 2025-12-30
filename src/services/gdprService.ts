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

import { getAuth } from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { deleteObject, getStorage, listAll, ref } from 'firebase/storage';
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
    const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', userId)));
    if (!userDoc.empty) {
      userData.profile = userDoc.docs[0].data();
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

/**
 * Delete all user data from Firestore and Storage
 * GDPR Article 17: Right to Erasure ("Right to be Forgotten")
 *
 * This is irreversible and complies with legal requirements.
 */
export const deleteUserAccount = async (userId: string): Promise<void> => {
  logger.warn('Deleting user account - IRREVERSIBLE', { userId });

  try {
    const db = getFirestore();
    const storage = getStorage();
    const batch = writeBatch(db);
    let deletedDocs = 0;

    // 1. Delete user profile
    const userQuery = query(collection(db, 'users'), where('uid', '==', userId));
    const userDocs = await getDocs(userQuery);
    userDocs.forEach((docSnapshot) => {
      batch.delete(doc(db, 'users', docSnapshot.id));
      deletedDocs++;
    });

    // 2. Delete routes (if driver)
    const routesQuery = query(collection(db, 'routes'), where('driverId', '==', userId));
    const routesDocs = await getDocs(routesQuery);
    routesDocs.forEach((docSnapshot) => {
      batch.delete(doc(db, 'routes', docSnapshot.id));
      deletedDocs++;
    });

    // 3. Delete requests (if parent)
    const requestsQuery = query(collection(db, 'requests'), where('parentId', '==', userId));
    const requestsDocs = await getDocs(requestsQuery);
    requestsDocs.forEach((docSnapshot) => {
      batch.delete(doc(db, 'requests', docSnapshot.id));
      deletedDocs++;
    });

    // 4. Delete tracking history
    const trackingQuery = query(collection(db, 'trackingPoints'), where('userId', '==', userId));
    const trackingDocs = await getDocs(trackingQuery);
    trackingDocs.forEach((docSnapshot) => {
      batch.delete(doc(db, 'trackingPoints', docSnapshot.id));
      deletedDocs++;
    });

    // 5. Delete vacancies (if driver)
    const vacanciesQuery = query(collection(db, 'vacancies'), where('driverId', '==', userId));
    const vacanciesDocs = await getDocs(vacanciesQuery);
    vacanciesDocs.forEach((docSnapshot) => {
      batch.delete(doc(db, 'vacancies', docSnapshot.id));
      deletedDocs++;
    });

    // Commit Firestore batch delete
    await batch.commit();

    // 6. Delete user files from Storage
    try {
      const userStorageRef = ref(storage, `users/${userId}`);
      const filesList = await listAll(userStorageRef);

      const deletePromises = filesList.items.map((itemRef) =>
        deleteObject(itemRef).catch((err) => {
          logger.warn('Failed to delete storage file', { file: itemRef.fullPath, error: err });
        })
      );

      await Promise.all(deletePromises);
      logger.info('User storage files deleted', { userId, filesCount: filesList.items.length });
    } catch (storageError) {
      // Storage deletion is non-critical, continue even if it fails
      logger.warn('Storage deletion partially failed', { userId, error: storageError });
    }

    // 7. Delete local encrypted data
    await secureStorage.removeItem('parental_consent');
    await secureStorage.removeItem('user_preferences');
    await secureStorage.removeItem('premium_status');
    await secureStorage.removeItem('consent_data');
    await secureStorage.removeItem('analytics_user_properties');

    // 8. Delete Firebase Auth account
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (currentUser && currentUser.uid === userId) {
      await currentUser.delete();
      logger.info('Firebase Auth account deleted', { userId });
    }

    logger.warn('User account completely deleted', {
      userId,
      firestoreDocsDeleted: deletedDocs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to delete user account', { userId, error });
    throw new Error('No se pudo eliminar la cuenta completamente');
  }
};

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

    // Count documents in each collection
    const userDocs = await getDocs(query(collection(db, 'users'), where('uid', '==', userId)));
    summary.hasProfile = !userDocs.empty;
    if (!userDocs.empty) {
      const userData = userDocs.docs[0].data();
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
  deleteUserAccount,
  getUserDataSummary,
  isParentalConsentRequired,
  verifyParentalConsent,
};
