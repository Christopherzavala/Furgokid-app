const fs = require('node:fs');
const { FieldValue } = require('firebase-admin/firestore');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const BLOCKED_CODE = 'CI_EXTERNAL_NOTIFICATION_BLOCKED';
const GUARD_ENABLED = 'CI_DISABLE_EXTERNAL_NOTIFICATIONS';
const READY_FILE = 'CI_EXTERNAL_NOTIFICATION_GUARD_READY_FILE';
const ATTEMPT_FILE = 'CI_EXTERNAL_NOTIFICATION_ATTEMPT_FILE';

const appendSignal = (environmentKey, contents) => {
  const filePath = process.env[environmentKey];
  if (!filePath) {
    throw new Error(`${environmentKey} must be set when the CI notification guard is enabled.`);
  }
  fs.appendFileSync(filePath, contents, 'utf8');
};

const initializeExternalNotificationGuard = () => {
  if (process.env[GUARD_ENABLED] !== 'true') return;

  try {
    appendSignal(ATTEMPT_FILE, '');
    appendSignal(READY_FILE, 'CI_EXTERNAL_NOTIFICATION_GUARD_ACTIVE\n');
  } catch (cause) {
    const error = new Error('Could not initialize the CI external notification guard.', {
      cause,
    });
    error.code = 'CI_EXTERNAL_NOTIFICATION_GUARD_CONFIGURATION_ERROR';
    throw error;
  }
};

const sendExpoPush = async ({ payload, headers }) => {
  if (process.env[GUARD_ENABLED] === 'true') {
    const error = new Error('Expo Push is disabled during CI.');
    error.code = BLOCKED_CODE;

    try {
      appendSignal(ATTEMPT_FILE, `${BLOCKED_CODE}\n`);
    } catch (cause) {
      error.cause = cause;
    }

    throw error;
  }

  let response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  // Handle HTTP 429 Too Many Requests with retry-after backoff
  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after');
    const delayMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5000;
    console.warn(`⚠️ Expo Push Rate Limited (429). Retrying after ${delayMs}ms...`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  }

  return response;
};

/**
 * Fetch all active devices for a given user ID from /users/{uid}/devices
 */
const getUserActiveDevices = async (firestore, userId) => {
  if (!userId) return [];
  try {
    const snapshot = await firestore
      .collection('users')
      .doc(userId)
      .collection('devices')
      .where('status', '==', 'active')
      .get();

    return snapshot.docs.map((docSnap) => docSnap.data());
  } catch (error) {
    console.error(`Error fetching active devices for user ${userId}:`, error);
    return [];
  }
};

/**
 * Handle Expo Push Tickets / Receipts response and update device statuses accordingly.
 */
const handleExpoReceipts = async (firestore, receipts, notificationTargets) => {
  if (!receipts || !Array.isArray(receipts) || !notificationTargets) return;

  for (let i = 0; i < receipts.length; i++) {
    const ticket = receipts[i];
    const target = notificationTargets[i];

    if (!ticket || !target) continue;

    if (ticket.status === 'error') {
      const errorDetails = ticket.details?.error;
      console.warn(
        `⚠️ Expo Push Error for device ${target.deviceId}:`,
        errorDetails,
        ticket.message
      );

      if (errorDetails === 'DeviceNotRegistered') {
        // Mark device and index as unregistered
        try {
          const deviceRef = firestore
            .collection('users')
            .doc(target.userId)
            .collection('devices')
            .doc(target.deviceId);

          const deviceDoc = await deviceRef.get();
          if (deviceDoc.exists) {
            const data = deviceDoc.data();
            // Verify tokenHash still matches to prevent race conditions on token renewal
            if (data.tokenHash === target.tokenHash) {
              await deviceRef.update({
                status: 'unregistered',
                updatedAt: FieldValue.serverTimestamp(),
              });

              const indexRef = firestore.collection('pushTokenIndex').doc(target.tokenHash);
              await indexRef.set(
                { status: 'unregistered', updatedAt: FieldValue.serverTimestamp() },
                { merge: true }
              );
              console.log(`✅ Device ${target.deviceId} marked as unregistered.`);
            }
          }
        } catch (err) {
          console.error(`❌ Failed to mark device ${target.deviceId} as unregistered:`, err);
        }
      } else if (errorDetails === 'InvalidCredentials' || errorDetails === 'MismatchSenderId') {
        console.error(`🚨 CRITICAL EXPO PUSH CREDENTIAL ERROR: ${errorDetails}`);
        // Do NOT deactivate user devices for credential errors
      }
    }
  }
};

/**
 * Scheduled Worker: Poll Expo Push Receipts for pending tickets (/getReceipts)
 */
const pollExpoReceiptsHandler = async ({ firestore, logger = console }) => {
  if (process.env[GUARD_ENABLED] === 'true') {
    logger.info('Receipt polling disabled during CI.');
    return null;
  }

  try {
    const logsSnapshot = await firestore
      .collection('notification_logs')
      .where('pendingReceipts', '==', true)
      .limit(20)
      .get();

    if (logsSnapshot.empty) return { polledLogs: 0 };

    for (const logDoc of logsSnapshot.docs) {
      const logData = logDoc.data();
      const ticketMap = logData.ticketMap || {};
      const ticketIds = Object.keys(ticketMap);

      if (ticketIds.length === 0) {
        await logDoc.ref.update({ pendingReceipts: false });
        continue;
      }

      const response = await fetch(EXPO_RECEIPTS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: ticketIds }),
      });

      if (!response.ok) {
        logger.warn(`Failed to fetch receipts from Expo API: ${response.statusText}`);
        continue;
      }

      const { data: receipts } = await response.json();
      if (!receipts) continue;

      for (const [ticketId, receipt] of Object.entries(receipts)) {
        if (receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered') {
          const target = ticketMap[ticketId];
          if (target && target.userId && target.deviceId) {
            const deviceRef = firestore
              .collection('users')
              .doc(target.userId)
              .collection('devices')
              .doc(target.deviceId);
            const deviceDoc = await deviceRef.get();
            if (deviceDoc.exists && deviceDoc.data().tokenHash === target.tokenHash) {
              await deviceRef.update({
                status: 'unregistered',
                updatedAt: FieldValue.serverTimestamp(),
              });
              await firestore
                .collection('pushTokenIndex')
                .doc(target.tokenHash)
                .set(
                  { status: 'unregistered', updatedAt: FieldValue.serverTimestamp() },
                  { merge: true }
                );
              logger.info(`Device ${target.deviceId} marked as unregistered via pollReceipts.`);
            }
          }
        }
      }

      await logDoc.ref.update({ pendingReceipts: false });
    }

    return { polledLogs: logsSnapshot.size };
  } catch (error) {
    logger.error('Error polling Expo receipts:', error);
    return null;
  }
};

/**
 * Scheduled Worker: Cleanup inactive devices (detached / unregistered > 30 days old) with pagination
 */
const cleanupInactiveDevicesHandler = async ({ firestore, logger = console }) => {
  try {
    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    // 1. Devices subcollection (paginated batch loop)
    let hasMoreDevices = true;
    while (hasMoreDevices) {
      const staleDevicesQuery = await firestore
        .collectionGroup('devices')
        .where('status', 'in', ['detached', 'unregistered'])
        .where('updatedAt', '<=', cutoffDate)
        .limit(400)
        .get();

      if (staleDevicesQuery.empty) break;

      const batch = firestore.batch();
      for (const docSnap of staleDevicesQuery.docs) {
        batch.delete(docSnap.ref);
        deletedCount++;
      }
      await batch.commit();

      if (staleDevicesQuery.size < 400) {
        hasMoreDevices = false;
      }
    }

    // 2. Token index (paginated batch loop)
    let hasMoreIndexes = true;
    while (hasMoreIndexes) {
      const staleIndexQuery = await firestore
        .collection('pushTokenIndex')
        .where('status', 'in', ['detached', 'unregistered'])
        .where('updatedAt', '<=', cutoffDate)
        .limit(400)
        .get();

      if (staleIndexQuery.empty) break;

      const batch = firestore.batch();
      for (const docSnap of staleIndexQuery.docs) {
        batch.delete(docSnap.ref);
        deletedCount++;
      }
      await batch.commit();

      if (staleIndexQuery.size < 400) {
        hasMoreIndexes = false;
      }
    }

    logger.info(`Cleaned up ${deletedCount} inactive device/index records older than 30 days.`);
    return { deletedCount };
  } catch (error) {
    logger.error('Error cleaning up inactive devices:', error);
    return null;
  }
};

module.exports = {
  BLOCKED_CODE,
  initializeExternalNotificationGuard,
  sendExpoPush,
  getUserActiveDevices,
  handleExpoReceipts,
  pollExpoReceiptsHandler,
  cleanupInactiveDevicesHandler,
};
