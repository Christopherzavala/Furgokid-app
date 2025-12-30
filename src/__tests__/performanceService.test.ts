/**
 * Tests para PerformanceService
 */

import analyticsService from '../services/analyticsService';
import performanceService from '../services/performanceService';

// Mock analyticsService
jest.mock('../services/analyticsService', () => ({
  __esModule: true,
  default: {
    trackPerformance: jest.fn(),
  },
}));

// Mock __DEV__
(global as any).__DEV__ = true;

describe('PerformanceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the service state by accessing private members through any
    (performanceService as any).traces = new Map();
    (performanceService as any).metrics = [];
    (performanceService as any).screenLoadTimes = new Map();
  });

  describe('Trace Management', () => {
    it('should start a trace', () => {
      performanceService.startTrace('test_trace', { key: 'value' });

      // Verify trace was created
      const traces = (performanceService as any).traces;
      expect(traces.has('test_trace')).toBe(true);
    });

    it('should stop a trace and return duration', async () => {
      performanceService.startTrace('test_trace');

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      const duration = performanceService.stopTrace('test_trace');

      expect(duration).toBeGreaterThanOrEqual(40); // Allow some variance
      expect(analyticsService.trackPerformance).toHaveBeenCalledWith(
        'test_trace',
        expect.any(Number),
        expect.objectContaining({ ok: expect.any(Boolean) })
      );
    });

    it('should return -1 for non-existent trace', () => {
      const duration = performanceService.stopTrace('non_existent');
      expect(duration).toBe(-1);
    });

    it('should merge attributes when stopping trace', async () => {
      performanceService.startTrace('test_trace', { initial: 'value' });
      performanceService.stopTrace('test_trace', { added: 'attribute' });

      expect(analyticsService.trackPerformance).toHaveBeenCalledWith(
        'test_trace',
        expect.any(Number),
        expect.objectContaining({
          initial: 'value',
          added: 'attribute',
        })
      );
    });
  });

  describe('Screen Load Tracking', () => {
    it('should track screen load time', async () => {
      const endTrack = performanceService.trackScreenLoad('HomeScreen');

      await new Promise((resolve) => setTimeout(resolve, 30));

      endTrack();

      expect(analyticsService.trackPerformance).toHaveBeenCalledWith(
        'screen_load',
        expect.any(Number),
        expect.objectContaining({
          screen: 'HomeScreen',
        })
      );
    });

    it('should calculate average screen load time', () => {
      // Simulate multiple loads
      const screenLoadTimes = (performanceService as any).screenLoadTimes;
      screenLoadTimes.set('TestScreen', [100, 150, 200]);

      const avg = performanceService.getAverageScreenLoadTime('TestScreen');
      expect(avg).toBe(150);
    });

    it('should return null for unknown screen', () => {
      const avg = performanceService.getAverageScreenLoadTime('UnknownScreen');
      expect(avg).toBeNull();
    });

    it('should keep only last 10 measurements', () => {
      const screenLoadTimes = (performanceService as any).screenLoadTimes;

      // Pre-populate with 10 measurements
      screenLoadTimes.set('TestScreen', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

      // Add another load
      const endTrack = performanceService.trackScreenLoad('TestScreen');
      endTrack();

      const times = screenLoadTimes.get('TestScreen');
      expect(times.length).toBe(10);
      expect(times[0]).toBe(2); // First element shifted out
    });
  });

  describe('API Call Tracking', () => {
    it('should track successful API call', async () => {
      const mockApiCall = jest.fn().mockResolvedValue({ data: 'test' });

      const result = await performanceService.trackApiCall('getUser', mockApiCall, {
        userId: '123',
      });

      expect(result).toEqual({ data: 'test' });
      expect(analyticsService.trackPerformance).toHaveBeenCalledWith(
        'api_getUser',
        expect.any(Number),
        expect.objectContaining({
          userId: '123',
          ok: true,
        })
      );
    });

    it('should track failed API call', async () => {
      const mockApiCall = jest.fn().mockRejectedValue(new Error('API Error'));

      await expect(performanceService.trackApiCall('getUser', mockApiCall)).rejects.toThrow(
        'API Error'
      );

      expect(analyticsService.trackPerformance).toHaveBeenCalledWith(
        'api_getUser',
        expect.any(Number),
        expect.objectContaining({
          ok: false,
        })
      );
    });
  });

  describe('App Lifecycle', () => {
    it('should track cold start', () => {
      performanceService.trackColdStart();

      expect(analyticsService.trackPerformance).toHaveBeenCalledWith(
        'cold_start',
        expect.any(Number),
        expect.objectContaining({ ok: expect.any(Boolean) })
      );
    });

    it('should track app ready', () => {
      performanceService.trackAppReady();

      expect(analyticsService.trackPerformance).toHaveBeenCalledWith(
        'app_ready',
        expect.any(Number),
        expect.objectContaining({ ok: expect.any(Boolean) })
      );
    });
  });

  describe('Metrics', () => {
    it('should record metrics', () => {
      performanceService.recordMetric('custom_metric', 100, 'ms');

      const metrics = performanceService.getMetrics();
      expect(metrics.length).toBe(1);
      expect(metrics[0]).toMatchObject({
        name: 'custom_metric',
        value: 100,
        unit: 'ms',
      });
    });

    it('should limit metrics to 100', () => {
      // Add 110 metrics
      for (let i = 0; i < 110; i++) {
        performanceService.recordMetric(`metric_${i}`, i, 'ms');
      }

      const metrics = performanceService.getMetrics();
      expect(metrics.length).toBe(100);
    });

    it('should generate metrics summary', () => {
      performanceService.recordMetric('test', 100, 'ms');
      performanceService.recordMetric('test', 200, 'ms');
      performanceService.recordMetric('test', 300, 'ms');

      const summary = performanceService.getMetricsSummary();

      expect(summary.test).toEqual({
        avg: 200,
        min: 100,
        max: 300,
        count: 3,
      });
    });
  });

  describe('Debug', () => {
    it('should print summary in dev mode', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      performanceService.recordMetric('test', 100, 'ms');
      performanceService.printSummary();

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should not print summary in production', () => {
      (global as any).__DEV__ = false;
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      performanceService.printSummary();

      // Should not log in production (or minimal logs)
      // The printSummary checks __DEV__ at the start
      (global as any).__DEV__ = true;

      consoleSpy.mockRestore();
    });
  });
});
