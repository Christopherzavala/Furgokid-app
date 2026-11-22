const { HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');

function createPushDeviceCallables({ firestore, logger = console }) {
  const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
  };

  const registerPushDevice = async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'User must be authenticated to register push device.'
      );
    }

    const uid = request.auth.uid;
    const { expoPushToken, deviceId, platform } = request.data || {};

    if (!expoPushToken || typeof expoPushToken !== 'string') {
      throw new HttpsError('invalid-argument', 'Valid expoPushToken is required.');
    }

    if (!deviceId || typeof deviceId !== 'string') {
      throw new HttpsError('invalid-argument', 'Valid deviceId is required.');
    }

    const tokenRegex = /^(Exponent|Expo)PushToken\[.+\]$/;
    if (!tokenRegex.test(expoPushToken)) {
      throw new HttpsError('invalid-argument', 'Invalid expoPushToken format.');
    }

    const tokenHash = hashToken(expoPushToken);
    const deviceRef = firestore.collection('users').doc(uid).collection('devices').doc(deviceId);
    const indexRef = firestore.collection('pushTokenIndex').doc(tokenHash);
    const userRef = firestore.collection('users').doc(uid);

    await firestore.runTransaction(async (transaction) => {
      // 1. Check if tokenHash is already registered to another user/device
      const indexDoc = await transaction.get(indexRef);
      if (indexDoc.exists) {
        const indexData = indexDoc.data();
        if (indexData.uid && indexData.uid !== uid) {
          // Detach from previous owner to prevent cross-user notification leakage
          const prevDeviceRef = firestore
            .collection('users')
            .doc(indexData.uid)
            .collection('devices')
            .doc(indexData.deviceId);
          transaction.set(
            prevDeviceRef,
            { status: 'detached', updatedAt: FieldValue.serverTimestamp() },
            { merge: true }
          );
        }
      }

      const timestamp = FieldValue.serverTimestamp();

      // 2. Upsert device record
      transaction.set(
        deviceRef,
        {
          deviceId,
          userId: uid,
          expoPushToken,
          tokenHash,
          platform: platform || 'unknown',
          status: 'active',
          updatedAt: timestamp,
        },
        { merge: true }
      );

      // 3. Upsert token index
      transaction.set(indexRef, {
        tokenHash,
        uid,
        deviceId,
        status: 'active',
        updatedAt: timestamp,
      });

      // 4. Remove legacy pushToken field if present on user profile
      transaction.set(
        userRef,
        {
          pushToken: FieldValue.delete(),
          updatedAt: timestamp,
        },
        { merge: true }
      );
    });

    logger.info(`Registered push device ${deviceId} for user ${uid}`);
    return { success: true, deviceId };
  };

  const revokePushDevice = async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated to revoke push device.');
    }

    const uid = request.auth.uid;
    const { deviceId } = request.data || {};

    const devicesRef = firestore.collection('users').doc(uid).collection('devices');
    const userRef = firestore.collection('users').doc(uid);

    // Fetch active devices outside transaction since queries aren't supported directly inside transaction.get()
    let activeDevicesDocs = [];
    if (deviceId) {
      const deviceDoc = await devicesRef.doc(deviceId).get();
      if (deviceDoc.exists) {
        activeDevicesDocs = [deviceDoc];
      }
    } else {
      const activeQuery = await devicesRef.where('status', '==', 'active').get();
      activeDevicesDocs = activeQuery.docs;
    }

    await firestore.runTransaction(async (transaction) => {
      const timestamp = FieldValue.serverTimestamp();
      for (const docSnap of activeDevicesDocs) {
        const data = docSnap.data();
        if (data.tokenHash) {
          const indexRef = firestore.collection('pushTokenIndex').doc(data.tokenHash);
          transaction.set(indexRef, { status: 'detached', updatedAt: timestamp }, { merge: true });
        }
        transaction.set(docSnap.ref, { status: 'detached', updatedAt: timestamp }, { merge: true });
      }

      transaction.set(
        userRef,
        {
          pushToken: FieldValue.delete(),
          updatedAt: timestamp,
        },
        { merge: true }
      );
    });

    logger.info(`Revoked push device(s) for user ${uid}`);
    return { success: true };
  };

  return {
    registerPushDevice,
    revokePushDevice,
  };
}

module.exports = {
  createPushDeviceCallables,
};
