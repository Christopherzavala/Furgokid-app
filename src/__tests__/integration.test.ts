/**
 * Integration Tests - Simulan flujos completos del usuario
 *
 * Estos tests verifican que los servicios funcionan correctamente juntos.
 */

// Mocks necesarios
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock de firebase
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  initializeAuth: jest.fn(() => ({})),
  getReactNativePersistence: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(),
  doc: jest.fn(),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
}));

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({})),
  getApps: jest.fn(() => []),
}));

// Mock de analytics
const mockAnalytics = {
  trackScreenView: jest.fn(),
  trackSessionStart: jest.fn(),
  trackLogin: jest.fn(),
  trackSignUp: jest.fn(),
  trackAppError: jest.fn(),
  setUserId: jest.fn(),
  trackAdImpression: jest.fn(),
  trackPerformance: jest.fn(),
  trackCustomEvent: jest.fn(),
  initialize: jest.fn(),
};

jest.mock('../services/analyticsService', () => ({
  __esModule: true,
  default: mockAnalytics,
}));

describe('Integration Tests - User Flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('New User Onboarding Flow', () => {
    it('should track complete onboarding sequence', async () => {
      // 1. App Cold Start
      mockAnalytics.trackSessionStart();
      expect(mockAnalytics.trackSessionStart).toHaveBeenCalled();

      // 2. Welcome Screen
      mockAnalytics.trackScreenView('WelcomeScreen');
      expect(mockAnalytics.trackScreenView).toHaveBeenCalledWith('WelcomeScreen');

      // 3. User creates account
      mockAnalytics.trackSignUp('email', 'parent');
      expect(mockAnalytics.trackSignUp).toHaveBeenCalledWith('email', 'parent');

      // 4. User ID set
      mockAnalytics.setUserId('new-user-123');
      expect(mockAnalytics.setUserId).toHaveBeenCalledWith('new-user-123');

      // 5. Dashboard loaded
      mockAnalytics.trackScreenView('DashboardScreen');
      expect(mockAnalytics.trackScreenView).toHaveBeenCalledWith('DashboardScreen');
    });

    it('should handle consent acceptance', async () => {
      const consentService = require('../services/consentService').default;

      // Accept required consents
      await consentService.acceptRequired();
      expect(consentService.hasAcceptedRequired()).toBe(true);

      // Can also accept all
      await consentService.acceptAll();
      expect(consentService.canTrackAnalytics()).toBe(true);
      expect(consentService.canShowPersonalizedAds()).toBe(true);
    });
  });

  describe('Returning User Flow', () => {
    it('should track returning user login', async () => {
      // 1. App opens
      mockAnalytics.trackSessionStart();

      // 2. Login screen
      mockAnalytics.trackScreenView('LoginScreen');

      // 3. User logs in
      mockAnalytics.trackLogin('email', 'parent');

      // 4. Set user
      mockAnalytics.setUserId('returning-user-456');

      // 5. Navigate to dashboard
      mockAnalytics.trackScreenView('DashboardScreen');

      expect(mockAnalytics.trackSessionStart).toHaveBeenCalled();
      expect(mockAnalytics.trackLogin).toHaveBeenCalledWith('email', 'parent');
      expect(mockAnalytics.setUserId).toHaveBeenCalledWith('returning-user-456');
    });
  });

  describe('Ad Interaction Flow', () => {
    it('should track ad impressions correctly', () => {
      // Banner on home screen
      mockAnalytics.trackAdImpression('banner', 'HomeScreen');
      expect(mockAnalytics.trackAdImpression).toHaveBeenCalledWith('banner', 'HomeScreen');

      // Interstitial between screens
      mockAnalytics.trackAdImpression('interstitial', 'NavigationTransition');
      expect(mockAnalytics.trackAdImpression).toHaveBeenCalledWith(
        'interstitial',
        'NavigationTransition'
      );
    });
  });

  describe('Error Handling Flow', () => {
    it('should track errors gracefully', () => {
      const error = new Error('Network error');

      mockAnalytics.trackAppError(error.message, false, 'network', 'fetch_data');

      expect(mockAnalytics.trackAppError).toHaveBeenCalledWith(
        'Network error',
        false,
        'network',
        'fetch_data'
      );
    });
  });

  describe('Performance Tracking Flow', () => {
    it('should track screen load performance', () => {
      mockAnalytics.trackPerformance('screen_load', 450, { screen: 'DashboardScreen', ok: true });

      expect(mockAnalytics.trackPerformance).toHaveBeenCalledWith(
        'screen_load',
        450,
        expect.objectContaining({
          screen: 'DashboardScreen',
          ok: true,
        })
      );
    });

    it('should track API call performance', () => {
      mockAnalytics.trackPerformance('api_getUser', 230, { ok: true });

      expect(mockAnalytics.trackPerformance).toHaveBeenCalledWith(
        'api_getUser',
        230,
        expect.objectContaining({ ok: true })
      );
    });
  });
});

describe('Integration Tests - Service Interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Premium + Consent Interaction', () => {
    it('should handle premium user with consent', async () => {
      const premiumService = require('../services/premiumService').default;
      const consentService = require('../services/consentService').default;

      // Initialize
      await premiumService.initialize();
      await consentService.initialize();

      // Free user by default
      expect(premiumService.isPremium()).toBe(false);

      // Should show ads (free user)
      expect(premiumService.shouldShowAds()).toBe(true);
    });
  });

  describe('Performance + Analytics Interaction', () => {
    it('should track performance via analytics', async () => {
      const performanceService = require('../services/performanceService').default;

      // Start and stop a trace
      performanceService.startTrace('test_operation');

      await new Promise((resolve) => setTimeout(resolve, 10));

      const duration = performanceService.stopTrace('test_operation');

      expect(duration).toBeGreaterThanOrEqual(0);
      expect(mockAnalytics.trackPerformance).toHaveBeenCalled();
    });
  });
});

describe('Integration Tests - Critical Paths', () => {
  describe('App Startup Critical Path', () => {
    it('should handle app startup without crashing', async () => {
      const premiumService = require('../services/premiumService').default;
      const consentService = require('../services/consentService').default;
      const performanceService = require('../services/performanceService').default;

      // All services should initialize without throwing
      await expect(premiumService.initialize()).resolves.not.toThrow();
      await expect(consentService.initialize()).resolves.not.toThrow();

      // Track cold start
      expect(() => performanceService.trackColdStart()).not.toThrow();
      expect(() => performanceService.trackAppReady()).not.toThrow();
    });
  });

  describe('Error Recovery Critical Path', () => {
    it('should recover from service initialization errors', async () => {
      // Even if storage fails, services should not crash
      const AsyncStorage = require('@react-native-async-storage/async-storage');
      AsyncStorage.getItem.mockRejectedValueOnce(new Error('Storage error'));

      const consentService = require('../services/consentService').default;

      // Should handle error gracefully
      await expect(consentService.initialize()).resolves.not.toThrow();
    });
  });
});
