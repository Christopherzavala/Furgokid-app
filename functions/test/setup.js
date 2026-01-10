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
process.env.GCLOUD_PROJECT = 'furgokid-test';
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
