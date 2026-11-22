/**
 * FurgoKid Cloud Functions
 *
 * Push Notifications Backend
 * - notifyDriversNewRequest: Notifica conductores cuando padre crea solicitud
 * - notifyParentsNewVacancy: Notifica padres cuando conductor publica cupo
 * - sendWelcomeEmail: Email de bienvenida a nuevos usuarios (v1.1)
 */

const {
  onDocumentCreated,
  onDocumentDeleted,
  onDocumentUpdated,
} = require('firebase-functions/v2/firestore');
const { onCall, onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { createFirestoreGpsCleanupRepository } = require('./src/firestoreGpsCleanupRepository');
const { createMatchFinalizationCleanup } = require('./src/matchFinalizationCleanup');
const { createStopTrackingHandler } = require('./src/stopTrackingCallable');
const { createCleanupDriverTrackingHandler } = require('./src/cleanupDriverTrackingCallable');
const { createTrackingAuthorizationHandler } = require('./src/trackingAuthorization');
const { createDriverApprovalGpsCleanup } = require('./src/driverApprovalGpsCleanup');
const { createMatchDeletionGpsCleanup } = require('./src/matchDeletionGpsCleanup');
const { createStaleTrackingCleanup } = require('./src/staleTrackingCleanup');
const { createDriverTrackingCleanup } = require('./src/driverTrackingCleanup');
const { createMatchLifecycleRepository } = require('./src/matchLifecycle');
const { createMatchLifecycleCallables } = require('./src/matchLifecycleCallables');
const { createEnsureUserProfileHandler } = require('./src/userProfileTrigger');
const { createDriverApprovalRepository } = require('./src/driverApproval');
const { createDriverApprovalCallables } = require('./src/driverApprovalCallables');
const { createAccountDeletionService } = require('./src/accountDeletionService');
const { createAccountDeletionCallables } = require('./src/accountDeletionCallables');
const { createPassengerAuthorizationCallables } = require('./src/passengerAuthorizationCallables');
const { createPassengerAuthorizationManager } = require('./src/passengerAuthorization');
const {
  BLOCKED_CODE,
  initializeExternalNotificationGuard,
  sendExpoPush,
} = require('./src/externalNotifications');

initializeExternalNotificationGuard();

// Set global options
setGlobalOptions({
  region: 'us-central1',
  maxInstances: 10,
});

// App Check configuration (controlled via ENFORCE_APP_CHECK environment variable)
const callOpts = {
  enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true',
};

// Initialize Firebase Admin SDK
admin.initializeApp();

const resolveStorageBucket = () => {
  let firebaseConfig = {};
  if (process.env.FIREBASE_CONFIG) {
    try {
      firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);
    } catch (error) {
      console.warn('FIREBASE_CONFIG could not be parsed; Storage bucket must be explicit.');
    }
  }
  const projectId =
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    firebaseConfig.projectId ||
    admin.app().options.projectId ||
    null;
  return (
    process.env.STORAGE_BUCKET ||
    process.env.FIREBASE_STORAGE_BUCKET ||
    firebaseConfig.storageBucket ||
    admin.app().options.storageBucket ||
    (projectId ? `${projectId}.firebasestorage.app` : null)
  );
};

const accountDeletionService = createAccountDeletionService({
  firestore: admin.firestore(),
  auth: admin.auth(),
  storage: admin.storage(),
  storageBucket: resolveStorageBucket(),
  logger: (entry) => console.info('Account deletion', entry),
});

const accountDeletion = createAccountDeletionCallables({
  service: accountDeletionService,
  logger: (entry) => console.info('Account deletion', entry),
});

exports.requestAccountDeletion = onCall(callOpts, accountDeletion.requestAccountDeletion);
exports.getAccountDeletionStatus = onCall(callOpts, accountDeletion.getAccountDeletionStatus);
exports.resumeAccountDeletionRequests = onSchedule(
  { schedule: 'every 5 minutes', retryCount: 3 },
  async () => accountDeletionService.resumePendingRequests()
);

const matchLifecycle = createMatchLifecycleCallables({
  repository: createMatchLifecycleRepository({ firestore: admin.firestore() }),
  logger: (entry) => console.info('Match lifecycle', entry),
});

exports.createMatch = onCall(callOpts, matchLifecycle.createMatch);
exports.acceptMatch = onCall(callOpts, matchLifecycle.acceptMatch);
exports.cancelMatch = onCall(callOpts, matchLifecycle.cancelMatch);
exports.completeMatch = onCall(callOpts, matchLifecycle.completeMatch);
exports.closeRequest = onCall(callOpts, matchLifecycle.closeRequest);
exports.deleteRequests = onCall(callOpts, matchLifecycle.deleteRequests);
exports.updateVacancyCapacity = onCall(callOpts, matchLifecycle.updateVacancyCapacity);
exports.initializeVacancyCapacity = onCall(callOpts, matchLifecycle.initializeVacancyCapacity);

exports.stopTracking = onCall(
  callOpts,
  createStopTrackingHandler({
    createRepository: () => createFirestoreGpsCleanupRepository({ firestore: admin.firestore() }),
    logger: (entry) => console.info('GPS cleanup', entry),
  })
);

exports.cleanupDriverTracking = onCall(
  callOpts,
  createCleanupDriverTrackingHandler({
    createRepository: () => createFirestoreGpsCleanupRepository({ firestore: admin.firestore() }),
    logger: (entry) => console.info('GPS cleanup', entry),
  })
);

exports.startTracking = onCall(
  callOpts,
  createTrackingAuthorizationHandler({
    getUserProfile: async (uid) => {
      const userSnapshot = await admin.firestore().collection('users').doc(uid).get();
      return userSnapshot.exists ? userSnapshot.data() : null;
    },
    getMatch: async (matchId) => {
      const matchSnapshot = await admin.firestore().collection('matches').doc(matchId).get();
      return matchSnapshot.exists ? matchSnapshot.data() : null;
    },
  })
);

exports.ensureUserProfile = onCall(
  callOpts,
  createEnsureUserProfileHandler({
    firestore: admin.firestore(),
    logger: (entry) => console.info('User profile provisioning', entry),
  })
);

const driverApproval = createDriverApprovalRepository({ firestore: admin.firestore() });
const driverApprovalHandlers = createDriverApprovalCallables({
  repository: driverApproval,
  logger: (entry) => console.info('Driver approval', entry),
});

exports.requestDriverApproval = onCall(callOpts, driverApprovalHandlers.requestDriverApproval);
exports.reviewDriverRequest = onCall(callOpts, driverApprovalHandlers.reviewDriverRequest);

const passengerAuthCallables = createPassengerAuthorizationCallables({
  manager: createPassengerAuthorizationManager({ firestore: admin.firestore() }),
});

exports.onboardPassenger = onCall(callOpts, passengerAuthCallables.onboardPassengerCallable);
exports.updatePassengerAuthorizationStatus = onCall(
  callOpts,
  passengerAuthCallables.updatePassengerAuthorizationStatusCallable
);

const custodyChain = require('./src/custodyChain');
exports.updatePassengerState = onCall(callOpts, custodyChain.updatePassengerStateCallable);
exports.generateHandoverOtp = onCall(callOpts, custodyChain.generateHandoverOtp);
exports.confirmStudentHandover = onCall(callOpts, custodyChain.confirmStudentHandover);

exports.cleanupFinalizedMatchTracking = onDocumentUpdated(
  { document: 'matches/{matchId}', retry: true },
  createMatchFinalizationCleanup({
    repository: createFirestoreGpsCleanupRepository({ firestore: admin.firestore() }),
    logger: (entry) => console.info('GPS cleanup', entry),
  })
);

exports.cleanupDeletedMatchTracking = onDocumentDeleted(
  { document: 'matches/{matchId}', retry: true },
  createMatchDeletionGpsCleanup({
    repository: createFirestoreGpsCleanupRepository({ firestore: admin.firestore() }),
    logger: (entry) => console.info('GPS cleanup', entry),
  })
);

const cleanupDriverTracking = async (driverId) => {
  const repository = createFirestoreGpsCleanupRepository({ firestore: admin.firestore() });
  return createDriverTrackingCleanup({
    repository,
    logger: (entry) => console.info('GPS cleanup', entry),
  })(driverId);
};

exports.cleanupRevokedDriverTracking = onDocumentUpdated(
  { document: 'users/{userId}', retry: true },
  createDriverApprovalGpsCleanup({
    cleanupDriverTracking,
    logger: (entry) => console.info('GPS cleanup', entry),
  })
);

exports.cleanupStaleTracking = onSchedule(
  { schedule: 'every 5 minutes', retryCount: 3 },
  createStaleTrackingCleanup({
    repository: createFirestoreGpsCleanupRepository({ firestore: admin.firestore() }),
    logger: (entry) => console.info('GPS cleanup', entry),
  })
);

exports.retryPendingRevocationCleanups = onSchedule('every 1 hours', async (_event) => {
  const manager = createPassengerAuthorizationManager({
    firestore: admin.firestore(),
  });
  const result = await manager.retryPendingRevocationCleanups({
    workerId: 'cloud_scheduler_worker',
  });
  console.log('🔄 Retry pending revocation cleanups completed:', result);
  return null;
});

/**
 * ========================================
 * TRIGGER: New Pending Match Created
 * ========================================
 *
 * Notifies only the driver assigned by the trusted match lifecycle operation.
 */
exports.notifyDriversNewRequest = onDocumentCreated('matches/{matchId}', async (event) => {
  const startTime = Date.now();
  const snap = event.data;
  const matchId = event.params.matchId;
  const match = snap?.data();
  if (!match || match.status !== 'pending') return null;

  console.log('🚨 NEW MATCH RECEIVED');
  try {
    if (typeof match.driverId !== 'string' || !match.driverId) {
      console.warn('   Pending match has no assigned driver; notification skipped');
      return null;
    }
    const driverSnapshot = await admin.firestore().collection('users').doc(match.driverId).get();
    if (!driverSnapshot.exists || driverSnapshot.get('role') !== 'driver') {
      console.warn('   Assigned driver profile is unavailable; notification skipped');
      return null;
    }
    const driver = driverSnapshot.data();
    if (!driver.pushToken) {
      console.log('   Assigned driver has no push token');
      return null;
    }

    const notifications = [
      {
        to: driver.pushToken,
        sound: 'default',
        title: '🚌 Nueva solicitud asignada',
        body: `${match.parentName} busca transporte para ${match.childrenCount} niño(s) en ${match.zone}`,
        data: {
          type: 'new_request',
          requestId: match.requestId,
          matchId,
          zone: match.zone,
          schedule: match.schedule,
          school: match.school,
        },
        priority: 'high',
        channelId: 'urgent',
      },
    ];

    const response = await sendExpoPush({
      payload: notifications,
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    const duration = Date.now() - startTime;

    console.log(`   ✅ Notifications sent in ${duration}ms`);
    console.log(`   Response:`, JSON.stringify(result));

    await admin.firestore().collection('notification_logs').add({
      type: 'new_match',
      matchId,
      driverId: match.driverId,
      driversNotified: notifications.length,
      success: true,
      duration: duration,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return null;
  } catch (error) {
    if (error.code === BLOCKED_CODE) throw error;
    console.error('   ❌ ERROR in notifyDriversNewRequest:', error);

    await admin.firestore().collection('notification_errors').add({
      type: 'new_match',
      matchId,
      driverId: match.driverId,
      error: error.message,
      stack: error.stack,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return null;
  }
});

/**
 * ========================================
 * TRIGGER: New Vacancy Created (Driver)
 * ========================================
 *
 * Cuando un conductor publica un cupo disponible:
 * 1. Busca padres con solicitudes activas en la misma zona
 * 2. Filtra por schedule compatible
 * 3. Envía push notification a padres matched
 */
exports.notifyParentsNewVacancy = onDocumentCreated('vacancies/{vacancyId}', async (event) => {
  const startTime = Date.now();
  const snap = event.data;
  const vacancyId = event.params.vacancyId;
  const vacancy = snap.data();

  console.log('🚐 NEW VACANCY RECEIVED');

  try {
    const requestsSnapshot = await admin
      .firestore()
      .collection('requests')
      .where('zone', '==', vacancy.zone)
      .where('status', '==', 'active')
      .get();

    console.log(`   Found ${requestsSnapshot.size} requests in ${vacancy.zone}`);

    if (requestsSnapshot.empty) {
      console.log('   ⚠️ No active requests in zone');
      return null;
    }

    const notifications = [];

    for (const requestDoc of requestsSnapshot.docs) {
      const request = requestDoc.data();

      const scheduleMatch =
        vacancy.schedule === 'Ambas' ||
        request.schedule === 'Ambas' ||
        vacancy.schedule === request.schedule;

      if (!scheduleMatch) {
        console.log(`   ⏭️ Skip: Schedule mismatch (${vacancy.schedule} vs ${request.schedule})`);
        continue;
      }

      const parentDoc = await admin.firestore().collection('users').doc(request.parentId).get();

      const parent = parentDoc.data();

      if (parent && parent.pushToken) {
        notifications.push({
          to: parent.pushToken,
          sound: 'default',
          title: '✅ Nuevo conductor disponible',
          body: `${vacancy.driverName} tiene ${vacancy.availableSeats} cupo(s) en ${vacancy.zone} - ${vacancy.schedule}`,
          data: {
            type: 'new_vacancy',
            vacancyId: vacancyId,
            zone: vacancy.zone,
            schedule: vacancy.schedule,
            schools: vacancy.schools.join(', '),
            seatsAvailable: vacancy.availableSeats,
          },
          priority: 'high',
          channelId: 'urgent',
        });
      }
    }

    console.log(`   Prepared ${notifications.length} notifications`);

    if (notifications.length === 0) {
      console.log('   ⚠️ No parents with push tokens or schedule match');
      return null;
    }

    const response = await sendExpoPush({
      payload: notifications,
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();
    const duration = Date.now() - startTime;

    console.log(`   ✅ Notifications sent in ${duration}ms`);
    console.log(`   Response:`, JSON.stringify(result));

    await admin.firestore().collection('notification_logs').add({
      type: 'new_vacancy',
      vacancyId: vacancyId,
      driverId: vacancy.driverId,
      parentsNotified: notifications.length,
      success: true,
      duration: duration,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return null;
  } catch (error) {
    if (error.code === BLOCKED_CODE) throw error;
    console.error('   ❌ ERROR in notifyParentsNewVacancy:', error);

    await admin.firestore().collection('notification_errors').add({
      type: 'new_vacancy',
      vacancyId: vacancyId,
      driverId: vacancy.driverId,
      error: error.message,
      stack: error.stack,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return null;
  }
});

exports.sendWelcomeEmail = onDocumentCreated('users/{userId}', async (_event) => {
  console.log('👋 NEW USER PROFILE');
  console.log('   Welcome email feature coming in v1.1');
  return null;
});

/**
 * ========================================
 * HTTP FUNCTION: Test Notification (Protected Admin Only)
 * ========================================
 */
exports.testNotification = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const authHeader = req.headers?.authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    let isAdmin = decodedToken.role === 'admin' || decodedToken.admin === true;
    if (!isAdmin) {
      const userDoc = await admin.firestore().collection('users').doc(decodedToken.uid).get();
      if (userDoc.exists && userDoc.data().role === 'admin') {
        isAdmin = true;
      }
    }

    if (!isAdmin) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const { pushToken, message } = req.body;

    if (!pushToken) {
      res.status(400).send('Missing pushToken');
      return;
    }

    const response = await sendExpoPush({
      headers: { 'Content-Type': 'application/json' },
      payload: {
        to: pushToken,
        sound: 'default',
        title: 'Test Notification',
        body: message || 'This is a test notification from Firebase Functions',
        data: { type: 'test' },
      },
    });

    const result = await response.json();
    res.status(200).json({ success: true, result });
  } catch (error) {
    if (error.code === BLOCKED_CODE) {
      res.status(500).json({ success: false, error: error.message, code: error.code });
      return;
    }
    if (error.message && error.message.includes('Invalid token')) {
      res.status(401).json({ success: false, error: 'Unauthorized', message: error.message });
      return;
    }
    console.error('Error sending test notification:', error);
    res.status(500).json({ success: false, error: error.message, code: error.code });
  }
});

const { triggerSosAlert, resolveSosAlert } = require('./src/emergencyCallables');
exports.triggerSosAlert = triggerSosAlert;
exports.resolveSosAlert = resolveSosAlert;

const { getOpsDashboardSnapshot } = require('./src/adminOpsCallables');
exports.getOpsDashboardSnapshot = getOpsDashboardSnapshot;
