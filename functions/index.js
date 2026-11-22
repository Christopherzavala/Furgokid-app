/**
 * FurgoKid Cloud Functions
 *
 * Push Notifications Backend
 * - notifyDriversNewRequest: Notifica conductores cuando padre crea solicitud
 * - notifyParentsNewVacancy: Notifica padres cuando conductor publica cupo
 * - pollExpoReceipts: Consulta recibos asíncronos de Expo Push API
 * - cleanupInactiveDevices: Limpieza programada de dispositivos e índices obsoletos
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
const { createPushDeviceCallables } = require('./src/pushDeviceCallables');
const {
  onboardPassengerCallable,
  updatePassengerAuthorizationStatusCallable,
} = require('./src/passengerAuthorizationCallables');
const {
  BLOCKED_CODE,
  initializeExternalNotificationGuard,
  sendExpoPush,
  getUserActiveDevices,
  handleExpoReceipts,
  pollExpoReceiptsHandler,
  cleanupInactiveDevicesHandler,
} = require('./src/externalNotifications');

initializeExternalNotificationGuard();

// Set global options
setGlobalOptions({
  region: 'us-central1',
  maxInstances: 10,
});

// Initialize Firebase Admin SDK
admin.initializeApp();

const pushDeviceCallables = createPushDeviceCallables({
  firestore: admin.firestore(),
  logger: console,
});

exports.registerPushDevice = onCall(
  { enforceAppCheck: true },
  pushDeviceCallables.registerPushDevice
);
exports.revokePushDevice = onCall({ enforceAppCheck: true }, pushDeviceCallables.revokePushDevice);

exports.onboardPassenger = onboardPassengerCallable;
exports.updatePassengerAuthorizationStatus = updatePassengerAuthorizationStatusCallable;

exports.testNotification = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }
  const { pushToken, message } = req.body || {};
  if (!pushToken) {
    return res.status(400).send('Missing pushToken');
  }
  try {
    const response = await sendExpoPush({
      payload: [{ to: pushToken, body: message || 'Test' }],
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
    });
    const result = await response.json();
    return res.status(200).json({ success: true, result });
  } catch (err) {
    return res.status(500).json({ success: false, code: err.code, error: err.message });
  }
});

exports.pollExpoReceipts = onSchedule({ schedule: 'every 15 minutes', retryCount: 3 }, async () =>
  pollExpoReceiptsHandler({ firestore: admin.firestore(), logger: console })
);

exports.cleanupInactiveDevices = onSchedule(
  { schedule: 'every 24 hours', retryCount: 3 },
  async () => cleanupInactiveDevicesHandler({ firestore: admin.firestore(), logger: console })
);

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

exports.requestAccountDeletion = onCall(accountDeletion.requestAccountDeletion);
exports.getAccountDeletionStatus = onCall(accountDeletion.getAccountDeletionStatus);
exports.resumeAccountDeletionRequests = onSchedule(
  { schedule: 'every 5 minutes', retryCount: 3 },
  async () => accountDeletionService.resumePendingRequests()
);

const matchLifecycle = createMatchLifecycleCallables({
  repository: createMatchLifecycleRepository({ firestore: admin.firestore() }),
  logger: (entry) => console.info('Match lifecycle', entry),
});

exports.createMatch = onCall(matchLifecycle.createMatch);
exports.acceptMatch = onCall(matchLifecycle.acceptMatch);
exports.cancelMatch = onCall(matchLifecycle.cancelMatch);
exports.completeMatch = onCall(matchLifecycle.completeMatch);
exports.closeRequest = onCall(matchLifecycle.closeRequest);
exports.deleteRequests = onCall(matchLifecycle.deleteRequests);
exports.updateVacancyCapacity = onCall(matchLifecycle.updateVacancyCapacity);
exports.initializeVacancyCapacity = onCall(matchLifecycle.initializeVacancyCapacity);

exports.stopTracking = onCall(
  createStopTrackingHandler({
    createRepository: () => createFirestoreGpsCleanupRepository({ firestore: admin.firestore() }),
    logger: (entry) => console.info('GPS cleanup', entry),
  })
);

exports.cleanupDriverTracking = onCall(
  createCleanupDriverTrackingHandler({
    createRepository: () => createFirestoreGpsCleanupRepository({ firestore: admin.firestore() }),
    logger: (entry) => console.info('GPS cleanup', entry),
  })
);

exports.startTracking = onCall(
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
  createEnsureUserProfileHandler({
    firestore: admin.firestore(),
    logger: (entry) => console.info('User profile provisioning', entry),
  })
);

const driverApproval = createDriverApprovalCallables({
  repository: createDriverApprovalRepository({ firestore: admin.firestore() }),
  logger: (entry) => console.info('Driver approval', entry),
});

exports.requestDriverApproval = onCall(driverApproval.requestDriverApproval);
exports.reviewDriverRequest = onCall(driverApproval.reviewDriverRequest);

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

/**
 * ========================================
 * TRIGGER: New Pending Match Created
 * ========================================
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

    const activeDevices = await getUserActiveDevices(admin.firestore(), match.driverId);
    if (activeDevices.length === 0) {
      console.log('   Assigned driver has no active push devices');
      return null;
    }

    const notifications = [];
    const notificationTargets = [];

    for (const device of activeDevices) {
      if (device.expoPushToken) {
        notifications.push({
          to: device.expoPushToken,
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
        });
        notificationTargets.push({
          userId: match.driverId,
          deviceId: device.deviceId,
          tokenHash: device.tokenHash,
        });
      }
    }

    if (notifications.length === 0) {
      console.log('   Assigned driver has no valid push tokens');
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
    await handleExpoReceipts(admin.firestore(), result.data, notificationTargets);

    const ticketMap = {};
    if (result.data && Array.isArray(result.data)) {
      result.data.forEach((ticket, idx) => {
        if (ticket.status === 'ok' && ticket.id) {
          ticketMap[ticket.id] = notificationTargets[idx];
        }
      });
    }

    const duration = Date.now() - startTime;
    console.log(`   ✅ Notifications sent in ${duration}ms`);

    await admin
      .firestore()
      .collection('notification_logs')
      .add({
        type: 'new_match',
        matchId,
        driverId: match.driverId,
        driversNotified: notifications.length,
        success: true,
        ticketMap,
        pendingReceipts: Object.keys(ticketMap).length > 0,
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
    const notificationTargets = [];

    for (const requestDoc of requestsSnapshot.docs) {
      const request = requestDoc.data();

      const scheduleMatch =
        vacancy.schedule === 'Ambas' ||
        request.schedule === 'Ambas' ||
        vacancy.schedule === request.schedule;

      if (!scheduleMatch) {
        continue;
      }

      const activeDevices = await getUserActiveDevices(admin.firestore(), request.parentId);
      for (const device of activeDevices) {
        if (device.expoPushToken) {
          notifications.push({
            to: device.expoPushToken,
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
          notificationTargets.push({
            userId: request.parentId,
            deviceId: device.deviceId,
            tokenHash: device.tokenHash,
          });
        }
      }
    }

    console.log(`   Prepared ${notifications.length} notifications`);

    if (notifications.length === 0) {
      console.log('   ⚠️ No parents with active devices or schedule match');
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
    await handleExpoReceipts(admin.firestore(), result.data, notificationTargets);

    const ticketMap = {};
    if (result.data && Array.isArray(result.data)) {
      result.data.forEach((ticket, idx) => {
        if (ticket.status === 'ok' && ticket.id) {
          ticketMap[ticket.id] = notificationTargets[idx];
        }
      });
    }

    const duration = Date.now() - startTime;
    console.log(`   ✅ Notifications sent in ${duration}ms`);

    await admin
      .firestore()
      .collection('notification_logs')
      .add({
        type: 'new_vacancy',
        vacancyId: vacancyId,
        driverId: vacancy.driverId,
        parentsNotified: notifications.length,
        success: true,
        ticketMap,
        pendingReceipts: Object.keys(ticketMap).length > 0,
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
