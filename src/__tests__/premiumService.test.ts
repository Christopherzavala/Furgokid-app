/// <reference types="jest" />
/**
 * Tests para PremiumService
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
    trackPremiumPurchaseStarted: jest.fn(),
    trackPremiumPurchaseCompleted: jest.fn(),
    trackPremiumCancelled: jest.fn(),
    trackUserSegment: jest.fn(),
  },
}));

// Import after mocks
import premiumService, { PREMIUM_PLANS } from '../services/premiumService';

describe('PremiumService', () => {
  beforeEach(() => {
    // Clear storage between tests
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  });

  describe('initialization', () => {
    it('should initialize with free status by default', async () => {
      const status = await premiumService.initialize();
      expect(status.isPremium).toBe(false);
      expect(status.plan).toBe('free');
    });

    it('should return false for isPremium by default', () => {
      expect(premiumService.isPremium()).toBe(false);
    });

    it('should show ads by default', () => {
      expect(premiumService.shouldShowAds()).toBe(true);
    });
  });

  describe('plans', () => {
    it('should have monthly plan defined', () => {
      expect(PREMIUM_PLANS.monthly).toBeDefined();
      expect(PREMIUM_PLANS.monthly.price).toBe(4.99);
      expect(PREMIUM_PLANS.monthly.durationDays).toBe(30);
    });

    it('should have annual plan defined', () => {
      expect(PREMIUM_PLANS.annual).toBeDefined();
      expect(PREMIUM_PLANS.annual.price).toBe(39.99);
      expect(PREMIUM_PLANS.annual.durationDays).toBe(365);
    });

    it('should have trial plan defined', () => {
      expect(PREMIUM_PLANS.trial).toBeDefined();
      expect(PREMIUM_PLANS.trial.price).toBe(0);
      expect(PREMIUM_PLANS.trial.durationDays).toBe(7);
    });
  });

  describe('features', () => {
    it('should return false for premium features when free', () => {
      expect(premiumService.hasFeature('noAds')).toBe(false);
      expect(premiumService.hasFeature('advancedTracking')).toBe(false);
      expect(premiumService.hasFeature('prioritySupport')).toBe(false);
    });
  });

  describe('days remaining', () => {
    it('should return null when not premium', () => {
      expect(premiumService.getDaysRemaining()).toBe(null);
    });
  });

  describe('status', () => {
    it('should return current status object', () => {
      const status = premiumService.getStatus();
      expect(status).toHaveProperty('isPremium');
      expect(status).toHaveProperty('plan');
      expect(status).toHaveProperty('features');
    });
  });
});
