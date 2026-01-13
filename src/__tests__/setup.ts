/// <reference types="jest" />
// Jest setup file
import '@testing-library/jest-native/extend-expect';

// Silence test logs by default to keep Jest output clean.
// Opt-in to verbose logs by setting JEST_VERBOSE_LOGS=1.
const VERBOSE_TEST_LOGS = process.env.JEST_VERBOSE_LOGS === '1';
const originalConsole = {
  log: console.log,
  info: console.info,
  debug: console.debug,
  warn: console.warn,
  error: console.error,
};

const shouldSilenceMessage = (args: unknown[]) => {
  if (VERBOSE_TEST_LOGS) return false;

  // By default, silence everything except errors.
  // Keep this function in case we ever want selective allow-listing.
  void args;
  return true;
};

console.log = (...args: unknown[]) => {
  if (!shouldSilenceMessage(args)) originalConsole.log.apply(console, args);
};

console.info = (...args: unknown[]) => {
  if (!shouldSilenceMessage(args)) originalConsole.info.apply(console, args);
};

console.debug = (...args: unknown[]) => {
  if (!shouldSilenceMessage(args)) originalConsole.debug.apply(console, args);
};

console.warn = (...args: unknown[]) => {
  if (!shouldSilenceMessage(args)) originalConsole.warn.apply(console, args);
};

// Keep console.error so test failures remain visible
console.error = (...args: unknown[]) => {
  originalConsole.error.apply(console, args);
};

// Mock expo-notifications to avoid Expo Go warnings during Jest runs
jest.mock('expo-notifications', () => {
  const addListener = () => ({ remove: jest.fn() });

  return {
    __esModule: true,
    setNotificationHandler: jest.fn(),
    getPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
    requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
    getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[TEST]' })),
    setNotificationChannelAsync: jest.fn(async () => undefined),
    scheduleNotificationAsync: jest.fn(async () => undefined),
    cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
    dismissAllNotificationsAsync: jest.fn(async () => undefined),
    getBadgeCountAsync: jest.fn(async () => 0),
    setBadgeCountAsync: jest.fn(async () => undefined),
    addNotificationReceivedListener: jest.fn(addListener),
    addNotificationResponseReceivedListener: jest.fn(addListener),
    removeNotificationSubscription: jest.fn(),
    AndroidNotificationPriority: { MAX: 'max', HIGH: 'high' },
    AndroidImportance: { MAX: 5, HIGH: 4 },
  };
});

// Mock expo-device so notification service short-circuits cleanly in tests
jest.mock('expo-device', () => ({
  __esModule: true,
  isDevice: false,
}));

// Mock de expo-constants
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        adsMode: 'test',
        adsForceTest: '1',
      },
    },
    executionEnvironment: 'storeClient',
  },
  ExecutionEnvironment: {
    StoreClient: 'storeClient',
    Standalone: 'standalone',
    Bare: 'bare',
  },
}));

// Mock de AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
}));

// Mock de Firebase
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  initializeAuth: jest.fn(() => ({})),
  getReactNativePersistence: jest.fn(() => ({})),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
}));

// Global timeout para tests async
jest.setTimeout(10000);
