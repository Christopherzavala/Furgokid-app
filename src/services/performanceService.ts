/**
 * PerformanceService - Monitoreo de Rendimiento de la App
 *
 * Trackea:
 * - Tiempos de carga de pantallas
 * - Tiempos de respuesta de API
 * - Uso de memoria
 * - FPS y jank
 * - Cold start / warm start
 *
 * Integra con Firebase Performance Monitoring cuando está disponible
 */

import analyticsService from './analyticsService';

// Optional Firebase Performance integration
let firebasePerf: any = null;
try {
  firebasePerf = require('@react-native-firebase/perf').default;
} catch (error) {
  console.log('[Performance] Firebase Perf not available, using fallback');
}

interface PerformanceTrace {
  name: string;
  startTime: number;
  attributes: Record<string, string | number | boolean>;
}

interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 's' | 'bytes' | 'count' | 'percent';
  timestamp: number;
}

class PerformanceService {
  private traces: Map<string, PerformanceTrace> = new Map();
  private firebaseTraces: Map<string, any> = new Map(); // Firebase trace objects
  private metrics: PerformanceMetric[] = [];
  private appStartTime: number;
  private screenLoadTimes: Map<string, number[]> = new Map();
  private firebasePerfEnabled: boolean = false;

  constructor() {
    this.appStartTime = Date.now();
    this.initFirebasePerf();
  }

  /**
   * Initialize Firebase Performance Monitoring
   */
  private async initFirebasePerf(): Promise<void> {
    if (!firebasePerf) return;

    try {
      this.firebasePerfEnabled = await firebasePerf().isPerformanceCollectionEnabled();
      if (__DEV__) {
        console.log(`[Performance] Firebase Perf enabled: ${this.firebasePerfEnabled}`);
      }
    } catch (error) {
      console.error('[Performance] Firebase init error:', error);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // TRACE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  startTrace(name: string, attributes: Record<string, string | number | boolean> = {}): void {
    // Local trace
    this.traces.set(name, {
      name,
      startTime: Date.now(),
      attributes,
    });

    // Firebase trace
    if (firebasePerf && this.firebasePerfEnabled) {
      firebasePerf()
        .startTrace(name)
        .then((trace: any) => {
          // Add attributes
          Object.entries(attributes).forEach(([key, value]) => {
            trace.putAttribute(key, String(value));
          });
          this.firebaseTraces.set(name, trace);
        })
        .catch((error: any) => {
          console.warn(`[Performance] Firebase startTrace error (${name}):`, error);
        });
    }

    if (__DEV__) {
      console.log(`[Perf] Trace started: ${name}`);
    }
  }

  stopTrace(
    name: string,
    additionalAttributes: Record<string, string | number | boolean> = {}
  ): number {
    const trace = this.traces.get(name);
    if (!trace) {
      console.warn(`[Perf] Trace not found: ${name}`);
      return -1;
    }

    const duration = Date.now() - trace.startTime;
    this.traces.delete(name);

    const allAttributes = { ...trace.attributes, ...additionalAttributes };

    // Record metric
    this.recordMetric(name, duration, 'ms');

    // Stop Firebase trace
    if (firebasePerf && this.firebasePerfEnabled) {
      const firebaseTrace = this.firebaseTraces.get(name);
      if (firebaseTrace) {
        // Add additional attributes and metrics
        Object.entries(additionalAttributes).forEach(([key, value]) => {
          firebaseTrace.putAttribute(key, String(value));
        });
        firebaseTrace.putMetric('duration', duration);

        firebaseTrace.stop().catch((error: any) => {
          console.warn(`[Performance] Firebase stopTrace error (${name}):`, error);
        });
        this.firebaseTraces.delete(name);
      }
    }

    // Send to analytics
    analyticsService.trackPerformance(name, duration, {
      ...allAttributes,
      ok: duration < 3000, // Consider > 3s as slow
    });

    if (__DEV__) {
      console.log(`[Perf] Trace completed: ${name} = ${duration}ms`);
    }

    return duration;
  }

  // ═══════════════════════════════════════════════════════════════
  // SCREEN LOAD TRACKING
  // ═══════════════════════════════════════════════════════════════

  trackScreenLoad(screenName: string): () => void {
    const startTime = Date.now();

    return () => {
      const loadTime = Date.now() - startTime;

      // Store for averaging
      if (!this.screenLoadTimes.has(screenName)) {
        this.screenLoadTimes.set(screenName, []);
      }
      const times = this.screenLoadTimes.get(screenName)!;
      times.push(loadTime);

      // Keep last 10 measurements
      if (times.length > 10) {
        times.shift();
      }

      // Track
      analyticsService.trackPerformance('screen_load', loadTime, {
        screen: screenName,
        ok: loadTime < 1000, // < 1s is good
      });

      if (__DEV__) {
        console.log(`[Perf] Screen load: ${screenName} = ${loadTime}ms`);
      }
    };
  }

  getAverageScreenLoadTime(screenName: string): number | null {
    const times = this.screenLoadTimes.get(screenName);
    if (!times || times.length === 0) return null;

    const sum = times.reduce((a, b) => a + b, 0);
    return Math.round(sum / times.length);
  }

  // ═══════════════════════════════════════════════════════════════
  // API CALL TRACKING
  // ═══════════════════════════════════════════════════════════════

  async trackApiCall<T>(
    name: string,
    apiCall: () => Promise<T>,
    attributes: Record<string, string | number | boolean> = {}
  ): Promise<T> {
    const startTime = Date.now();
    let success = false;

    try {
      const result = await apiCall();
      success = true;
      return result;
    } finally {
      const duration = Date.now() - startTime;

      analyticsService.trackPerformance(`api_${name}`, duration, {
        ...attributes,
        ok: success,
      });

      if (__DEV__) {
        console.log(`[Perf] API call: ${name} = ${duration}ms (${success ? 'success' : 'failed'})`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // APP LIFECYCLE
  // ═══════════════════════════════════════════════════════════════

  trackColdStart(): void {
    const coldStartTime = Date.now() - this.appStartTime;

    analyticsService.trackPerformance('cold_start', coldStartTime, {
      ok: coldStartTime < 3000,
    });

    if (__DEV__) {
      console.log(`[Perf] Cold start: ${coldStartTime}ms`);
    }
  }

  trackAppReady(): void {
    const readyTime = Date.now() - this.appStartTime;

    analyticsService.trackPerformance('app_ready', readyTime, {
      ok: readyTime < 5000,
    });

    if (__DEV__) {
      console.log(`[Perf] App ready: ${readyTime}ms`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // METRICS
  // ═══════════════════════════════════════════════════════════════

  recordMetric(
    name: string,
    value: number,
    unit: 'ms' | 's' | 'bytes' | 'count' | 'percent'
  ): void {
    this.metrics.push({
      name,
      value,
      unit,
      timestamp: Date.now(),
    });

    // Keep last 100 metrics
    if (this.metrics.length > 100) {
      this.metrics.shift();
    }
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  getMetricsSummary(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const summary: Record<string, { values: number[] }> = {};

    for (const metric of this.metrics) {
      if (!summary[metric.name]) {
        summary[metric.name] = { values: [] };
      }
      summary[metric.name].values.push(metric.value);
    }

    const result: Record<string, { avg: number; min: number; max: number; count: number }> = {};

    for (const [name, data] of Object.entries(summary)) {
      const values = data.values;
      result[name] = {
        avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
      };
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  // DEBUG
  // ═══════════════════════════════════════════════════════════════

  printSummary(): void {
    if (!__DEV__) return;

    console.log('\n═══════════════════════════════════════');
    console.log('      PERFORMANCE SUMMARY');
    console.log('═══════════════════════════════════════');

    const summary = this.getMetricsSummary();
    for (const [name, stats] of Object.entries(summary)) {
      console.log(`${name}:`);
      console.log(
        `  Avg: ${stats.avg}ms | Min: ${stats.min}ms | Max: ${stats.max}ms | Count: ${stats.count}`
      );
    }

    console.log('\nScreen Load Times:');
    for (const [screen, times] of this.screenLoadTimes.entries()) {
      const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      console.log(`  ${screen}: avg ${avg}ms (${times.length} loads)`);
    }

    console.log('═══════════════════════════════════════\n');
  }
}

export default new PerformanceService();
