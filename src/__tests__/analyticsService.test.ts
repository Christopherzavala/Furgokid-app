/// <reference types="jest" />
/**
 * Tests para AnalyticsService (Versión completa con AsyncStorage)
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
}));

import analyticsService from '../services/analyticsService';

describe('AnalyticsService', () => {
  beforeEach(() => {
    // Clear storage between tests
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
  });

  it('should be defined', () => {
    expect(analyticsService).toBeDefined();
  });

  it('should have trackScreenView method', () => {
    expect(typeof analyticsService.trackScreenView).toBe('function');
  });

  it('should have trackSessionStart method', () => {
    expect(typeof analyticsService.trackSessionStart).toBe('function');
  });

  it('should have setUserId method', () => {
    expect(typeof analyticsService.setUserId).toBe('function');
  });

  it('should have trackAdImpression method', () => {
    expect(typeof analyticsService.trackAdImpression).toBe('function');
  });

  it('should handle trackScreenView without errors', async () => {
    await expect(analyticsService.trackScreenView('TestScreen')).resolves.toBeUndefined();
  });

  it('should handle trackSessionStart without errors', async () => {
    await expect(analyticsService.trackSessionStart()).resolves.toBeUndefined();
  });

  it('should handle setUserId without errors', async () => {
    await expect(analyticsService.setUserId('test-user-123')).resolves.toBeUndefined();
  });

  it('should handle trackAdImpression without errors', async () => {
    await expect(
      analyticsService.trackAdImpression('banner', 'HomeScreen')
    ).resolves.toBeUndefined();
  });

  it('should handle trackLogin without errors', async () => {
    await expect(analyticsService.trackLogin('parent')).resolves.toBeUndefined();
  });

  it('should handle trackSignUp without errors', async () => {
    await expect(analyticsService.trackSignUp('driver')).resolves.toBeUndefined();
  });

  it('should have trackAppError method', () => {
    expect(typeof analyticsService.trackAppError).toBe('function');
  });

  it('should handle trackAppError without errors', async () => {
    await expect(
      analyticsService.trackAppError('Test error', { fatal: false })
    ).resolves.toBeUndefined();
  });

  it('should have trackPerformance method', () => {
    expect(typeof analyticsService.trackPerformance).toBe('function');
  });

  it('should handle trackPerformance without errors', async () => {
    await expect(
      analyticsService.trackPerformance('test_metric', 100, { ok: true })
    ).resolves.toBeUndefined();
  });

  it('should have getAnalyticsSummary method', () => {
    expect(typeof analyticsService.getAnalyticsSummary).toBe('function');
  });

  it('should return analytics summary', async () => {
    const summary = await analyticsService.getAnalyticsSummary();
    expect(summary).toHaveProperty('totalEvents');
    expect(summary).toHaveProperty('sessionCount');
  });

  it('should have clearAnalytics method', () => {
    expect(typeof analyticsService.clearAnalytics).toBe('function');
  });

  it('should have exportEvents method', () => {
    expect(typeof analyticsService.exportEvents).toBe('function');
  });

  it('should export events as array', async () => {
    const events = await analyticsService.exportEvents();
    expect(Array.isArray(events)).toBe(true);
  });
});
