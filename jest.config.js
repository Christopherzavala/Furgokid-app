module.exports = {
  preset: 'react-native',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx,js,jsx}'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx,js,jsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/index.{ts,tsx,js,jsx}',
    // Exclude UI-heavy areas from global coverage until we add component tests
    '!src/screens/**',
    '!src/components/**',
    '!src/hooks/**',
    // Exclude non-critical config scaffolding and large integration surfaces
    '!src/config/constants.js',
    '!src/config/firebase.js',
    '!src/config/remoteConfig.ts',
    '!src/config/sentry.ts',
    '!src/context/LocationContext.js',
    // Exclude optional/native-only integrations from coverage gates in Expo-managed CI
    '!src/services/crashlyticsService.ts',
    '!src/services/firebasePerformanceService.ts',
    '!src/services/admobService.ts',
    '!src/services/backgroundLocation.js',
    '!src/services/gdprService.ts',
    '!src/services/locationService.js',
    '!src/services/notificationService.js',
    '!src/services/toastService.ts',
    '!src/services/trackingService.js',
    '!src/utils/errorHandler.js',
    '!src/utils/notificationService.js',
    '!src/utils/offlineCache.ts',
    '!src/utils/retryUtils.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 25,
      functions: 30,
      lines: 30,
      statements: 30,
    },
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|firebase|@firebase)',
  ],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
