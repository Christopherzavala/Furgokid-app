/**
 * FurgoKid Cloud Functions
 *
 * Push Notifications Backend
 * - notifyDriversNewRequest: Notifica conductores cuando padre crea solicitud
 * - notifyParentsNewVacancy: Notifica padres cuando conductor publica cupo
 * - sendWelcomeEmail: Email de bienvenida a nuevos usuarios (v1.1)
 */

const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onCall, onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { createFirestoreGpsCleanupRepository } = require('./src/firestoreGpsCleanupRepository');
const { createMatchFinalizationCleanup } = require('./src/matchFinalizationCleanup');
const { createStopTrackingHandler } = require('./src/stopTrackingCallable');
const { createMatchLifecycleRepository } = require('./src/matchLifecycle');
const { createMatchLifecycleCallables } = require('./src/matchLifecycleCallables');
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

// Initialize Firebase Admin SDK
admin.initializeApp();

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
    getUserProfile: async (uid) => {
      const userSnapshot = await admin.firestore().collection('users').doc(uid).get();
      return userSnapshot.exists ? userSnapshot.data() : null;
    },
    logger: (entry) => console.info('GPS cleanup', entry),
  })
);

exports.cleanupFinalizedMatchTracking = onDocumentUpdated(
  { document: 'matches/{matchId}', retry: true },
  createMatchFinalizationCleanup({
    repository: createFirestoreGpsCleanupRepository({ firestore: admin.firestore() }),
    logger: (entry) => console.info('GPS cleanup', entry),
  })
);

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
  const match = snap.data();
  if (match.status !== 'pending') return null;

  console.log(`🚨 NEW MATCH: ${matchId} | Driver: ${match.driverId} | Zone: ${match.zone}`);
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

  console.log(
    `🚐 NEW VACANCY: ${vacancyId} | Driver: ${vacancy.driverName} | Zone: ${vacancy.zone}`
  );

  try {
    // 1. Find active parent requests in the same zone
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

    // 2. Get parent user data and filter by schedule compatibility
    const notifications = [];

    for (const requestDoc of requestsSnapshot.docs) {
      const request = requestDoc.data();

      // Check schedule compatibility
      const scheduleMatch =
        vacancy.schedule === 'Ambas' ||
        request.schedule === 'Ambas' ||
        vacancy.schedule === request.schedule;

      if (!scheduleMatch) {
        console.log(`   ⏭️ Skip: Schedule mismatch (${vacancy.schedule} vs ${request.schedule})`);
        continue;
      }

      // Get parent user data for pushToken
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

    // 3. Send notifications via Expo Push API
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

    // 4. Log success
    await admin.firestore().collection('notification_logs').add({
      type: 'new_vacancy',
      vacancyId: vacancyId,
      parentsNotified: notifications.length,
      success: true,
      duration: duration,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return null;
  } catch (error) {
    if (error.code === BLOCKED_CODE) throw error;
    console.error('   ❌ ERROR in notifyParentsNewVacancy:', error);

    // Log error
    await admin.firestore().collection('notification_errors').add({
      type: 'new_vacancy',
      vacancyId: vacancyId,
      error: error.message,
      stack: error.stack,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Graceful degradation
    return null;
  }
});

/**
 * ========================================
 * TRIGGER: Welcome Email (v1.1 - Optional)
 * ========================================
 *
 * Envía email de bienvenida cuando nuevo usuario se registra
 *
 * TODO v1.1:
 * - Integrar con SendGrid o Firebase Email Extension
 * - Templates HTML para emails
 * - Link de onboarding
 */
exports.sendWelcomeEmail = onDocumentCreated('users/{userId}', async (event) => {
  const snap = event.data;
  const user = snap.data();

  console.log(`👋 NEW USER: ${user.email} | Role: ${user.role}`);

  // TODO v1.1: Implementar email service
  // Por ahora solo log
  console.log('   Welcome email feature coming in v1.1');

  return null;
});

/**
 * ========================================
 * HTTP FUNCTION: Test Notification
 * ========================================
 *
 * Testing endpoint para enviar notificación de prueba
 *
 * USAGE:
 * curl -X POST https://<region>-furgokid.cloudfunctions.net/testNotification \
 *   -H "Content-Type: application/json" \
 *   -d '{"pushToken":"ExponentPushToken[xxx]","message":"Test"}'
 */
exports.testNotification = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { pushToken, message } = req.body;

  if (!pushToken) {
    res.status(400).send('Missing pushToken');
    return;
  }

  try {
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
    console.error('Error sending test notification:', error);
    res.status(500).json({ success: false, error: error.message, code: error.code });
  }
});
