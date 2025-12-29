/// <reference types="jest" />
/**
 * Tests para AdMobConfig
 */

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        adsMode: 'test',
        adsForceTest: '1',
      },
    },
  },
}));

import { AD_CONFIG, AD_UNITS, getAdUnitId, shouldShowInterstitial } from '../config/AdMobConfig';

describe('AdMobConfig', () => {
  describe('AD_UNITS', () => {
    it('should have banner home unit defined', () => {
      expect(AD_UNITS.BANNER_HOME).toBeDefined();
      expect(AD_UNITS.BANNER_HOME).toContain('ca-app-pub-');
    });

    it('should have interstitial unit defined', () => {
      expect(AD_UNITS.INTERSTITIAL_NAV).toBeDefined();
      expect(AD_UNITS.INTERSTITIAL_NAV).toContain('ca-app-pub-');
    });

    it('should have rewarded unit defined', () => {
      expect(AD_UNITS.REWARDED_FEATURE).toBeDefined();
      expect(AD_UNITS.REWARDED_FEATURE).toContain('ca-app-pub-');
    });
  });

  describe('AD_CONFIG', () => {
    it('should have interstitial interval defined', () => {
      expect(AD_CONFIG.INTERSTITIAL_INTERVAL).toBeDefined();
      expect(AD_CONFIG.INTERSTITIAL_INTERVAL).toBeGreaterThan(0);
    });

    it('should have minimum session time defined', () => {
      expect(AD_CONFIG.MINIMUM_SESSION_TIME).toBeDefined();
      expect(AD_CONFIG.MINIMUM_SESSION_TIME).toBeGreaterThan(0);
    });

    it('should have daily interstitial cap defined', () => {
      expect(AD_CONFIG.DAILY_INTERSTITIAL_CAP).toBeDefined();
      expect(AD_CONFIG.DAILY_INTERSTITIAL_CAP).toBeGreaterThan(0);
    });

    it('should have app ID defined', () => {
      expect(AD_CONFIG.APP_ID).toBeDefined();
      expect(AD_CONFIG.APP_ID).toContain('ca-app-pub-');
    });
  });

  describe('getAdUnitId', () => {
    it('should return null for invalid ad type', () => {
      // @ts-expect-error Testing invalid input
      expect(getAdUnitId(null)).toBe(null);
    });

    it('should return null for undefined ad type', () => {
      // @ts-expect-error Testing invalid input
      expect(getAdUnitId(undefined)).toBe(null);
    });

    it('should return test ID for BANNER_HOME in test mode', () => {
      const unitId = getAdUnitId('BANNER_HOME', 'parent');
      expect(unitId).toBeDefined();
      expect(unitId).toContain('ca-app-pub-');
    });

    it('should return test ID for INTERSTITIAL_NAV', () => {
      const unitId = getAdUnitId('INTERSTITIAL_NAV', 'parent');
      expect(unitId).toBeDefined();
    });

    it('should return null for unknown ad type', () => {
      const unitId = getAdUnitId('UNKNOWN_TYPE', 'parent');
      expect(unitId).toBe(null);
    });
  });

  describe('shouldShowInterstitial', () => {
    it('should be a function', () => {
      expect(typeof shouldShowInterstitial).toBe('function');
    });

    it('should return boolean', () => {
      const result = shouldShowInterstitial();
      expect(typeof result).toBe('boolean');
    });
  });
});
