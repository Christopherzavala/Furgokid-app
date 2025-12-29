/// <reference types="jest" />
/**
 * Tests para ConsentService
 */

// Mock AsyncStorage
const mockStorage: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
    return Promise.resolve();
  }),
  getItem: jest.fn((key: string) => {
    return Promise.resolve(mockStorage[key] || null);
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage[key];
    return Promise.resolve();
  }),
  multiRemove: jest.fn((keys: string[]) => {
    keys.forEach((key) => delete mockStorage[key]);
    return Promise.resolve();
  }),
}));

// Mock analyticsService
jest.mock('../services/analyticsService', () => ({
  default: {
    logEvent: jest.fn(),
    clearAnalytics: jest.fn(),
  },
}));

// Import after mocks
import consentService from '../services/consentService';

describe('ConsentService', () => {
  beforeEach(() => {
    // Clear storage between tests
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const prefs = await consentService.initialize();
      expect(prefs).toBeDefined();
      expect(prefs.consentVersion).toBeDefined();
    });

    it('should have privacy policy not accepted by default', async () => {
      const prefs = await consentService.initialize();
      expect(prefs.privacyPolicyAccepted).toBe(false);
    });

    it('should have terms not accepted by default', async () => {
      const prefs = await consentService.initialize();
      expect(prefs.termsOfServiceAccepted).toBe(false);
    });
  });

  describe('consent status', () => {
    it('should return false for hasAcceptedRequired by default', () => {
      expect(consentService.hasAcceptedRequired()).toBe(false);
    });

    it('should need consent prompt by default', () => {
      expect(consentService.needsConsentPrompt()).toBe(true);
    });

    it('should not allow personalized ads by default', () => {
      expect(consentService.canShowPersonalizedAds()).toBe(false);
    });

    it('should not allow analytics by default', () => {
      expect(consentService.canTrackAnalytics()).toBe(false);
    });

    it('should not allow location tracking by default', () => {
      expect(consentService.canTrackLocation()).toBe(false);
    });
  });

  describe('preferences', () => {
    it('should return preferences object', () => {
      const prefs = consentService.getPreferences();
      expect(prefs).toHaveProperty('privacyPolicyAccepted');
      expect(prefs).toHaveProperty('termsOfServiceAccepted');
      expect(prefs).toHaveProperty('analyticsEnabled');
      expect(prefs).toHaveProperty('personalizedAdsEnabled');
    });
  });

  describe('AdMob consent status', () => {
    it('should return UNKNOWN when required consent not accepted', () => {
      expect(consentService.getAdMobConsentStatus()).toBe('UNKNOWN');
    });
  });

  describe('consent history', () => {
    it('should return empty history initially', () => {
      const history = consentService.getConsentHistory();
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('data export', () => {
    it('should export user data', async () => {
      const data = await consentService.exportUserData();
      expect(data).toHaveProperty('preferences');
      expect(data).toHaveProperty('history');
      expect(data).toHaveProperty('exportedAt');
      expect(typeof data.exportedAt).toBe('number');
    });
  });
});
