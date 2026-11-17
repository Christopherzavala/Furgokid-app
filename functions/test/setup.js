/**
 * Jest Test Setup
 */

// Suppress console logs during tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock environment variables
process.env.GCLOUD_PROJECT = 'demo-furgokid';
process.env.GOOGLE_CLOUD_PROJECT = 'demo-furgokid';
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
