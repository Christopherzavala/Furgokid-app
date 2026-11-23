/**
 * Driver Fleet Assets & Assistants Callables (Ola 3 - #4)
 *
 * Allows verified drivers to manage their vehicles and fleet assistants,
 * and allows admin/ops personnel to audit and verify those assets.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { enforceRateLimit, getCallableSecurityOptions } = require('./securityGuard');
const { assertAdminOrOps } = require('./adminOpsCallables');

const VALID_DOCUMENT_ID = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= 1500 &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/');

exports.upsertDriverFleetAsset = onCall(getCallableSecurityOptions(), async (request) => {
  const driverUid = request?.auth?.uid;
  if (!driverUid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }

  const db = admin.firestore();
  await enforceRateLimit(db, {
    uid: driverUid,
    action: 'upsertDriverFleetAsset',
    maxRequests: 10,
    windowMs: 10 * 60 * 1000,
  });

  const driverDoc = await db.collection('users').doc(driverUid).get();
  if (!driverDoc.exists || driverDoc.data()?.role !== 'driver') {
    throw new HttpsError('permission-denied', 'Only registered drivers can manage fleet assets.');
  }

  const { assetType, payload } = request?.data || {};
  if (assetType !== 'vehicle' && assetType !== 'assistant') {
    throw new HttpsError('invalid-argument', 'assetType must be "vehicle" or "assistant".');
  }
  if (!payload || typeof payload !== 'object') {
    throw new HttpsError('invalid-argument', 'Valid payload object is required.');
  }

  const serverNow = admin.firestore.FieldValue.serverTimestamp();

  if (assetType === 'vehicle') {
    const { plate, brand, model, year, capacity, technicalReviewExpiry, insuranceExpiry } = payload;
    if (!plate || typeof plate !== 'string' || !plate.trim()) {
      throw new HttpsError('invalid-argument', 'Valid vehicle plate is required.');
    }

    const vehicleId = `veh_${plate
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')}`;
    const vehicleRef = db
      .collection('driverFleets')
      .doc(driverUid)
      .collection('vehicles')
      .doc(vehicleId);

    const vehicleData = {
      vehicleId,
      driverId: driverUid,
      plate: plate.trim().toUpperCase(),
      brand: typeof brand === 'string' ? brand.trim() : '',
      model: typeof model === 'string' ? model.trim() : '',
      year: typeof year === 'number' ? year : Number(year) || null,
      capacity: typeof capacity === 'number' ? capacity : Number(capacity) || 4,
      technicalReviewExpiry: technicalReviewExpiry || null,
      insuranceExpiry: insuranceExpiry || null,
      status: 'PENDING',
      updatedAt: serverNow,
      createdAt: serverNow,
    };

    await vehicleRef.set(vehicleData, { merge: true });

    return {
      success: true,
      assetType: 'vehicle',
      vehicleId,
      status: 'PENDING',
    };
  }

  // Assistant
  const { fullName, rut, phone, assistantId: customId } = payload;
  if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
    throw new HttpsError('invalid-argument', 'Valid assistant full name is required.');
  }
  if (!rut || typeof rut !== 'string' || !rut.trim()) {
    throw new HttpsError('invalid-argument', 'Valid assistant RUT is required.');
  }

  const assistantId =
    customId && VALID_DOCUMENT_ID(customId)
      ? customId
      : `ast_${rut
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')}`;

  const assistantRef = db
    .collection('driverFleets')
    .doc(driverUid)
    .collection('assistants')
    .doc(assistantId);

  const assistantData = {
    assistantId,
    driverId: driverUid,
    fullName: fullName.trim(),
    rut: rut.trim(),
    phone: typeof phone === 'string' ? phone.trim() : '',
    backgroundCheckStatus: 'PENDING',
    active: true,
    updatedAt: serverNow,
    createdAt: serverNow,
  };

  await assistantRef.set(assistantData, { merge: true });

  return {
    success: true,
    assetType: 'assistant',
    assistantId,
    backgroundCheckStatus: 'PENDING',
  };
});

exports.verifyDriverFleetAsset = onCall(getCallableSecurityOptions(), async (request) => {
  const uid = request?.auth?.uid;
  const db = admin.firestore();

  await assertAdminOrOps(request, db);

  const { driverId, assetType, assetId, decision } = request?.data || {};

  if (!VALID_DOCUMENT_ID(driverId) || !VALID_DOCUMENT_ID(assetId)) {
    throw new HttpsError('invalid-argument', 'Valid driverId and assetId are required.');
  }
  if (assetType !== 'vehicle' && assetType !== 'assistant') {
    throw new HttpsError('invalid-argument', 'assetType must be "vehicle" or "assistant".');
  }
  if (decision !== 'approve' && decision !== 'reject') {
    throw new HttpsError('invalid-argument', 'Decision must be "approve" or "reject".');
  }

  const serverNow = admin.firestore.FieldValue.serverTimestamp();
  const collectionName = assetType === 'vehicle' ? 'vehicles' : 'assistants';
  const assetRef = db
    .collection('driverFleets')
    .doc(driverId)
    .collection(collectionName)
    .doc(assetId);

  const snap = await assetRef.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', `${assetType} record not found.`);
  }

  const targetStatus = decision === 'approve' ? 'VERIFIED' : 'REJECTED';
  const updatePayload =
    assetType === 'vehicle'
      ? { status: targetStatus, updatedAt: serverNow, verifiedBy: uid }
      : { backgroundCheckStatus: targetStatus, updatedAt: serverNow, verifiedBy: uid };

  await assetRef.update(updatePayload);

  return {
    success: true,
    driverId,
    assetType,
    assetId,
    status: targetStatus,
  };
});
