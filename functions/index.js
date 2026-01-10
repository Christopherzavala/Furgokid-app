/**
 * FurgoKid Cloud Functions
 *
 * Push Notifications Backend
 * - notifyDriversNewRequest: Notifica conductores cuando padre crea solicitud
 * - notifyParentsNewVacancy: Notifica padres cuando conductor publica cupo
 * - sendWelcomeEmail: Email de bienvenida a nuevos usuarios (v1.1)
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

// Set global options
setGlobalOptions({
  region: 'us-central1',
  maxInstances: 10,
});

// Initialize Firebase Admin SDK
admin.initializeApp();

/**
 * ========================================
 * TRIGGER: New Request Created (Parent)
 * ========================================
 *
 * Cuando un padre crea una solicitud de transporte:
 * 1. Busca conductores en la misma zona
 * 2. Filtra por pushToken válido
 * 3. Envía push notification a cada conductor matched
 *
 * ANÁLISIS BIG TECH:
 * - Graceful degradation: Si falla, user no se entera
 * - Batch processing: Envía todas las notificaciones en un batch
 * - Error logging: Log a Firestore para debugging
 */
exports.notifyDriversNewRequest = onDocumentCreated('requests/{requestId}', async (event) => {
  const startTime = Date.now();
  const snap = event.data;
  const requestId = event.params.requestId;
  const request = snap.data();

  console.log(
    `🚨 NEW REQUEST: ${requestId} | Parent: ${request.parentName} | Zone: ${request.zone}`
  );

  try {
    // 1. Find drivers in the same zone with pushToken
    const driversSnapshot = await admin
      .firestore()
      .collection('users')
      .where('role', '==', 'driver')
      .where('zone', '==', request.zone)
      .get();

    console.log(`   Found ${driversSnapshot.size} drivers in ${request.zone}`);

    if (driversSnapshot.empty) {
      console.log('   ⚠️ No drivers found in zone');
      return null;
    }

    // 2. Build notification payload for each driver
    const notifications = [];
    driversSnapshot.forEach((doc) => {
      const driver = doc.data();
      if (driver.pushToken) {
        notifications.push({
          to: driver.pushToken,
          sound: 'default',
          title: '🚌 Nueva solicitud en tu zona',
          body: `${request.parentName} busca transporte para ${request.childrenCount} niño(s) en ${request.zone}`,
          data: {
            type: 'new_request',
            requestId: requestId,
            zone: request.zone,
            schedule: request.schedule,
            school: request.school,
          },
          priority: 'high',
          channelId: 'urgent',
        });
      }
    });

    console.log(`   Prepared ${notifications.length} notifications`);

    if (notifications.length === 0) {
      console.log('   ⚠️ No drivers with push tokens');
      return null;
    }

    // 3. Send notifications via Expo Push API
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notifications),
    });

    const result = await response.json();
    const duration = Date.now() - startTime;

    console.log(`   ✅ Notifications sent in ${duration}ms`);
    console.log(`   Response:`, JSON.stringify(result));

    // 4. Log success to Firestore for analytics
    await admin.firestore().collection('notification_logs').add({
      type: 'new_request',
      requestId: requestId,
      driversNotified: notifications.length,
      success: true,
      duration: duration,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return null;
  } catch (error) {
    console.error('   ❌ ERROR in notifyDriversNewRequest:', error);

    // Log error to Firestore
    await admin.firestore().collection('notification_errors').add({
      type: 'new_request',
      requestId: requestId,
      error: error.message,
      stack: error.stack,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Don't throw - graceful degradation
    // App continues working even if notifications fail
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
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notifications),
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
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: pushToken,
        sound: 'default',
        title: 'Test Notification',
        body: message || 'This is a test notification from Firebase Functions',
        data: { type: 'test' },
      }),
    });

    const result = await response.json();
    res.status(200).json({ success: true, result });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});
