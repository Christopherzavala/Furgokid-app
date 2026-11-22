/**
 * Script for syncing Firebase Auth Custom Claims for active Admin users in Firestore.
 *
 * Usage:
 *   node scripts/sync-admin-custom-claims.js
 *
 * Prerequisite:
 *   GOOGLE_APPLICATION_CREDENTIALS set or firebase-admin initialized with service account.
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

async function syncAdminCustomClaims() {
  const db = admin.firestore();
  const auth = admin.auth();

  console.log('🔍 Buscando usuarios con rol de administrador en Firestore...');

  const snapshot = await db.collection('users').where('role', '==', 'admin').get();
  if (snapshot.empty) {
    console.log('⚠️ No se encontraron usuarios con rol "admin" en Firestore.');
    return;
  }

  console.log(
    `Encontrados ${snapshot.size} usuario(s) admin. Aplicando Custom Claims en Firebase Auth...`
  );

  let successCount = 0;
  for (const doc of snapshot.docs) {
    const uid = doc.id;
    const userData = doc.data();
    try {
      const userRecord = await auth.getUser(uid);
      const existingClaims = userRecord.customClaims || {};

      if (existingClaims.role === 'admin' && existingClaims.admin === true) {
        console.log(
          `  ✅ [${uid}] (${userData.email || 'sin email'}) ya tiene custom claims de admin.`
        );
        successCount++;
        continue;
      }

      await auth.setCustomUserClaims(uid, {
        ...existingClaims,
        role: 'admin',
        admin: true,
      });

      console.log(
        `  🎉 [${uid}] (${
          userData.email || 'sin email'
        }) Custom Claims aplicados: { role: 'admin', admin: true }`
      );
      successCount++;
    } catch (error) {
      console.error(`  ❌ [${uid}] Error al actualizar Custom Claims:`, error.message);
    }
  }

  console.log(
    `\n✅ Proceso finalizado: ${successCount}/${snapshot.size} administradores sincronizados.`
  );
}

if (require.main === module) {
  syncAdminCustomClaims()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error fatal al sincronizar custom claims:', err);
      process.exit(1);
    });
}

module.exports = { syncAdminCustomClaims };
