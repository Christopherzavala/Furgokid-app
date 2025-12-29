/// <reference types="jest" />
import analyticsService from '../services/analyticsService';

describe('AnalyticsService', () => {
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
});
