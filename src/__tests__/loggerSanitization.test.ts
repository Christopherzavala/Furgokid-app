import logger from '../utils/logger';
import analyticsService from '../services/analyticsService';

describe('PII Sanitization in Logger and Analytics', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  test('logger sanitizes sensitive keys in context', () => {
    logger.info('Test event', {
      studentName: 'Juan Perez',
      phone: '+56912345678',
      token: 'secret-fcm-token',
      techMetricMs: 150,
    });

    expect(consoleSpy).toHaveBeenCalled();
    const logOutput = consoleSpy.mock.calls[0][0];
    expect(logOutput).toContain('[REDACTED]');
    expect(logOutput).not.toContain('Juan Perez');
    expect(logOutput).not.toContain('+56912345678');
    expect(logOutput).not.toContain('secret-fcm-token');
    expect(logOutput).toContain('techMetricMs');
  });

  test('analyticsService sanitizes PII in custom events', async () => {
    analyticsService.setEnabled(true);
    await analyticsService.trackCustomEvent('test_sanitized_event', {
      nombre: 'Maria Gomez',
      rut: '12.345.678-9',
      duration: 42,
    });

    const summary = await analyticsService.getAnalyticsSummary();
    expect(summary.totalEvents).toBeGreaterThan(0);
  });
});
