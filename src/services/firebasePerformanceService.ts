/**
 * Firebase Performance Monitoring Service
 *
 * CRITICAL FOR MONETIZATION:
 * - Track AdMob load times (slow ads = less revenue)
 * - Monitor route creation performance (UX = retention)
 * - Measure API response times (Firebase calls)
 * - Track screen rendering (parents = high value users)
 *
 * FREE tier: Unlimited performance traces
 *
 * Revenue Impact:
 * - 1s faster ad load = 7% more ad revenue
 * - 100ms faster app = 1% better conversion
 * - Crash-free sessions = 20-30% more AdMob revenue
 */

import perf from '@react-native-firebase/perf';
import { Platform } from 'react-native';
import logger from '../utils/logger';

interface CustomMetrics {
  [key: string]: number;
}

interface CustomAttributes {
  [key: string]: string;
}

class FirebasePerformanceService {
  private isEnabled: boolean = false;
  private activeTraces: Map<string, any> = new Map();

  /**
   * Initialize Firebase Performance
   * Call this in App.js
   */
  async initialize(): Promise<void> {
    try {
      // Enable performance collection
      await perf().setPerformanceCollectionEnabled(true);

      this.isEnabled = true;

      logger.info('Firebase Performance initialized', {
        platform: Platform.OS,
      });
    } catch (error) {
      logger.error('Failed to initialize Firebase Performance', { error });
      this.isEnabled = false;
    }
  }

  /**
   * Start a custom trace
   * Use for tracking critical user flows
   *
   * Examples:
   * - ad_load_time
   * - route_creation
   * - search_results
   * - parent_signup
   */
  async startTrace(traceName: string, attributes?: CustomAttributes): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const trace = await perf().startTrace(traceName);

      // Add custom attributes
      if (attributes) {
        for (const [key, value] of Object.entries(attributes)) {
          await trace.putAttribute(key, String(value));
        }
      }

      // Store trace for later stop
      this.activeTraces.set(traceName, {
        trace,
        startTime: Date.now(),
      });

      logger.debug('Performance trace started', { traceName, attributes });
    } catch (error) {
      logger.error('Failed to start performance trace', { error, traceName });
    }
  }

  /**
   * Stop a custom trace
   */
  async stopTrace(traceName: string, metrics?: CustomMetrics): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const traceData = this.activeTraces.get(traceName);
      if (!traceData) {
        logger.warn('Trace not found', { traceName });
        return;
      }

      const { trace, startTime } = traceData;
      const duration = Date.now() - startTime;

      // Add custom metrics
      if (metrics) {
        for (const [key, value] of Object.entries(metrics)) {
          await trace.putMetric(key, value);
        }
      }

      // Stop trace and send to Firebase
      await trace.stop();
      this.activeTraces.delete(traceName);

      logger.debug('Performance trace stopped', {
        traceName,
        duration,
        metrics,
      });
    } catch (error) {
      logger.error('Failed to stop performance trace', { error, traceName });
    }
  }

  /**
   * Track AdMob ad load time
   * CRITICAL: Slow ads = less impressions = less $$
   */
  async trackAdLoad(
    adUnitId: string,
    adType: 'banner' | 'interstitial' | 'rewarded'
  ): Promise<void> {
    const traceName = `ad_load_${adType}`;
    await this.startTrace(traceName, {
      ad_unit_id: adUnitId,
      ad_type: adType,
      platform: Platform.OS,
    });
  }

  /**
   * Track ad load completion
   */
  async trackAdLoadComplete(
    adType: 'banner' | 'interstitial' | 'rewarded',
    success: boolean,
    errorCode?: string
  ): Promise<void> {
    const traceName = `ad_load_${adType}`;
    await this.stopTrace(traceName, {
      success: success ? 1 : 0,
      error_code: errorCode ? parseInt(errorCode, 10) : 0,
    });
  }

  /**
   * Track route creation performance
   * Revenue impact: Failed routes = lost drivers = less users
   */
  async trackRouteCreation(routeId: string, origin: string, destination: string): Promise<void> {
    await this.startTrace('route_creation', {
      route_id: routeId,
      origin,
      destination,
      platform: Platform.OS,
    });
  }

  /**
   * Track route creation completion
   */
  async trackRouteCreationComplete(
    success: boolean,
    stopsCount: number,
    price: number
  ): Promise<void> {
    await this.stopTrace('route_creation', {
      success: success ? 1 : 0,
      stops_count: stopsCount,
      price_cents: Math.floor(price * 100),
    });
  }

  /**
   * Track parent signup flow
   * CRITICAL: Parents = higher LTV than drivers
   */
  async trackParentSignup(): Promise<void> {
    await this.startTrace('parent_signup', {
      user_type: 'parent',
      platform: Platform.OS,
    });
  }

  /**
   * Track signup completion
   */
  async trackSignupComplete(
    success: boolean,
    hasChildren: number,
    acceptedCoppa: boolean
  ): Promise<void> {
    await this.stopTrace('parent_signup', {
      success: success ? 1 : 0,
      children_count: hasChildren,
      coppa_accepted: acceptedCoppa ? 1 : 0,
    });
  }

  /**
   * Track driver signup flow
   */
  async trackDriverSignup(): Promise<void> {
    await this.startTrace('driver_signup', {
      user_type: 'driver',
      platform: Platform.OS,
    });
  }

  /**
   * Track driver signup completion
   */
  async trackDriverSignupComplete(
    success: boolean,
    hasVehicle: boolean,
    hasLicense: boolean
  ): Promise<void> {
    await this.stopTrace('driver_signup', {
      success: success ? 1 : 0,
      has_vehicle: hasVehicle ? 1 : 0,
      has_license: hasLicense ? 1 : 0,
    });
  }

  /**
   * Track search performance
   * UX = retention = more ads shown
   */
  async trackSearch(query: string, filters: any): Promise<void> {
    await this.startTrace('search_routes', {
      query_length: String(query.length),
      has_filters: filters ? 'true' : 'false',
      platform: Platform.OS,
    });
  }

  /**
   * Track search completion
   */
  async trackSearchComplete(resultCount: number, searchTimeMs: number): Promise<void> {
    await this.stopTrace('search_routes', {
      result_count: resultCount,
      search_time_ms: searchTimeMs,
    });
  }

  /**
   * Track screen rendering time
   * Slow screens = poor UX = churn
   */
  async trackScreenRender(screenName: string, userType: 'parent' | 'driver'): Promise<void> {
    await this.startTrace(`screen_${screenName}`, {
      screen_name: screenName,
      user_type: userType,
      platform: Platform.OS,
    });
  }

  /**
   * Track screen render completion
   */
  async trackScreenRenderComplete(
    screenName: string,
    renderTimeMs: number,
    componentsCount: number
  ): Promise<void> {
    await this.stopTrace(`screen_${screenName}`, {
      render_time_ms: renderTimeMs,
      components_count: componentsCount,
    });
  }

  /**
   * Track API call performance
   * Slow Firebase = poor UX = churn
   */
  async trackApiCall(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE'): Promise<void> {
    await this.startTrace('api_call', {
      endpoint,
      method,
      platform: Platform.OS,
    });
  }

  /**
   * Track API call completion
   */
  async trackApiCallComplete(
    success: boolean,
    statusCode: number,
    responseSize: number
  ): Promise<void> {
    await this.stopTrace('api_call', {
      success: success ? 1 : 0,
      status_code: statusCode,
      response_size_bytes: responseSize,
    });
  }

  /**
   * Track payment flow
   * Direct revenue tracking
   */
  async trackPayment(amount: number, currency: string, paymentMethod: string): Promise<void> {
    await this.startTrace('payment_processing', {
      currency,
      payment_method: paymentMethod,
      platform: Platform.OS,
    });
  }

  /**
   * Track payment completion
   */
  async trackPaymentComplete(
    success: boolean,
    amount: number,
    processingTimeMs: number
  ): Promise<void> {
    await this.stopTrace('payment_processing', {
      success: success ? 1 : 0,
      amount_cents: Math.floor(amount * 100),
      processing_time_ms: processingTimeMs,
    });
  }

  /**
   * Track GDPR data export
   * Legal compliance performance
   */
  async trackGdprExport(userId: string, dataSize: number): Promise<void> {
    await this.startTrace('gdpr_export', {
      user_id: userId,
      platform: Platform.OS,
    });

    // Simulate export (real implementation in gdprService)
    setTimeout(async () => {
      await this.stopTrace('gdpr_export', {
        success: 1,
        data_size_kb: Math.floor(dataSize / 1024),
      });
    }, 100);
  }

  /**
   * Get HTTP metric (automatic tracking)
   * Firebase automatically tracks network calls
   */
  async getHttpMetric(url: string, httpMethod: 'GET' | 'POST' | 'PUT' | 'DELETE'): Promise<any> {
    if (!this.isEnabled) return null;

    try {
      const metric = await perf().newHttpMetric(url, httpMethod);
      return metric;
    } catch (error) {
      logger.error('Failed to create HTTP metric', { error });
      return null;
    }
  }

  /**
   * Check if performance monitoring is enabled
   */
  isCollectionEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Get active traces count (for debugging)
   */
  getActiveTracesCount(): number {
    return this.activeTraces.size;
  }
}

// Singleton instance
const firebasePerformanceService = new FirebasePerformanceService();

export default firebasePerformanceService;
