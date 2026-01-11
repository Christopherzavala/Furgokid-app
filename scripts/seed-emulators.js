/**
 * Seed Data for Firebase Emulators
 *
 * Este script puebla los emulators con datos de prueba
 */

const admin = require('firebase-admin');
const mockData = require('../functions/__mocks__/mockData');

// Initialize Admin SDK for emulator
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';

admin.initializeApp({ projectId: 'furgokid' });

const db = admin.firestore();
const auth = admin.auth();

async function seedFirestore() {
  console.log('🌱 Seeding Firestore...');

  // Clear existing data
  const collections = ['users', 'requests', 'vacancies'];
  for (const collectionName of collections) {
    const snapshot = await db.collection(collectionName).get();
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    console.log(`   ✓ Cleared ${collectionName}`);
  }

  // Seed users
  const { mockUsers } = mockData;
  for (const [key, user] of Object.entries(mockUsers)) {
    await db.collection('users').doc(user.uid).set(user);
  }
  console.log(`   ✓ Seeded ${Object.keys(mockUsers).length} users`);

  // Seed requests
  const { mockRequests } = mockData;
  for (const [key, request] of Object.entries(mockRequests)) {
    await db.collection('requests').doc(request.id).set(request);
  }
  console.log(`   ✓ Seeded ${Object.keys(mockRequests).length} requests`);

  // Seed vacancies
  const { mockVacancies } = mockData;
  for (const [key, vacancy] of Object.entries(mockVacancies)) {
    await db.collection('vacancies').doc(vacancy.id).set(vacancy);
  }
  console.log(`   ✓ Seeded ${Object.keys(mockVacancies).length} vacancies`);

  console.log('✅ Firestore seeding complete!\n');
}

async function seedAuth() {
  console.log('🔐 Seeding Auth...');

  const { mockUsers } = mockData;

  for (const [key, user] of Object.entries(mockUsers)) {
    try {
      await auth.createUser({
        uid: user.uid,
        email: user.email,
        emailVerified: true,
        displayName: user.displayName,
        password: 'password123', // Test password
      });
      console.log(`   ✓ Created auth user: ${user.email}`);
    } catch (error) {
      if (error.code === 'auth/uid-already-exists') {
        console.log(`   ⚠️  User already exists: ${user.email}`);
      } else {
        console.error(`   ❌ Error creating user ${user.email}:`, error.message);
      }
    }
  }

  console.log('✅ Auth seeding complete!\n');
}

async function main() {
  console.log('🚀 Starting Firebase Emulator Seed\n');
  console.log('📋 Emulator Hosts:');
  console.log(`   Firestore: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  console.log(`   Auth: ${process.env.FIREBASE_AUTH_EMULATOR_HOST}\n`);

  try {
    await seedAuth();
    await seedFirestore();

    console.log('🎉 Seeding complete!');
    console.log('\n📊 Test Credentials:');
    console.log('   Parent 1: maria.garcia@example.com / password123');
    console.log('   Parent 2: juan.martinez@example.com / password123');
    console.log('   Driver 1: carlos.rodriguez@example.com / password123');
    console.log('   Driver 2: ana.lopez@example.com / password123\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

main();
