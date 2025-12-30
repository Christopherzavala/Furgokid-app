/**
 * Crashlytics Service
 *
 * Critical for monetization:
 * - Crash-free sessions increase AdMob revenue by 20-30%
 * - Google Play ranking improves with stability metrics
 * - User retention = more ad impressions
 *
 * FREE tier: Unlimited crash reports
 */

import crashlytics from '@react-native-firebase/crashlytics';
import { Platform } from 'react-native';
import logger from '../utils/logger';

interface CrashlyticsMetrics {
  crashFreeUsers: number;
  crashFreeRate: number;
  totalCrashes: number;
  affectedUsers: number;
}

class CrashlyticsService {
  private isEnabled: boolean = false;

  /**
   * Initialize Crashlytics
   * Call this in App.js before any other code
   */
  async initialize(): Promise<void> {
    try {
      // Enable Crashlytics collection
      await crashlytics().setCrashlyticsCollectionEnabled(true);

      this.isEnabled = true;

      logger.info('Crashlytics initialized successfully', {
        platform: Platform.OS,
        version: Platform.Version,
      });

      // Set initial attributes
      await this.setDefaultAttributes();
    } catch (error) {
      logger.error('Failed to initialize Crashlytics', { error });
      this.isEnabled = false;
    }
  }

  /**
   * Set default attributes for all crash reports
   */
  private async setDefaultAttributes(): Promise<void> {
    try {
      await crashlytics().setAttribute('platform', Platform.OS);
      await crashlytics().setAttribute('platform_version', String(Platform.Version));
      await crashlytics().setAttribute('app_version', '1.0.0'); // Update from package.json
    } catch (error) {
      logger.error('Failed to set Crashlytics attributes', { error });
    }
  }

  /**
   * Set user identifier
   * Critical for tracking revenue per user
   */
  async setUserId(userId: string): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await crashlytics().setUserId(userId);
      logger.debug('Crashlytics user ID set', { userId });
    } catch (error) {
      logger.error('Failed to set Crashlytics user ID', { error });
    }
  }

  /**
   * Set user type (Parent/Driver)
   * Essential for monetization analysis
   */
  async setUserType(userType: 'parent' | 'driver'): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await crashlytics().setAttribute('user_type', userType);

      // Revenue-critical: Track which user type crashes more
      // Parents = higher AdMob value (more engaged)
      logger.debug('User type set for Crashlytics', { userType });
    } catch (error) {
      logger.error('Failed to set user type', { error });
    }
  }

  /**
   * Log non-fatal error
   * Use for handled errors that affect UX but don't crash
   *
   * Example: Failed to load ad, Network timeout, etc.
   */
  async logError(error: Error, context?: Record<string, any>): Promise<void> {
    if (!this.isEnabled) return;

    try {
      // Add context attributes
      if (context) {
        for (const [key, value] of Object.entries(context)) {
          await crashlytics().setAttribute(key, String(value));
        }
      }

      // Record non-fatal error
      await crashlytics().recordError(error);

      logger.warn('Non-fatal error logged to Crashlytics', {
        error: error.message,
        context,
      });
    } catch (err) {
      logger.error('Failed to log error to Crashlytics', { error: err });
    }
  }

  /**
   * Log custom event for revenue tracking
   * Examples: ad_impression, ad_click, route_created, payment_initiated
   */
  async logEvent(eventName: string, params?: Record<string, any>): Promise<void> {
    if (!this.isEnabled) return;

    try {
      // Set event as breadcrumb for crash context
      await crashlytics().log(`Event: ${eventName} ${JSON.stringify(params || {})}`);

      logger.debug('Event logged to Crashlytics', { eventName, params });
    } catch (error) {
      logger.error('Failed to log event to Crashlytics', { error });
    }
  }

  /**
   * Set custom attributes for revenue analysis
   * Critical metrics:
   * - subscription_status: 'free' | 'premium'
   * - ad_blocker_detected: boolean
   * - lifetime_value: number (estimated)
   * - session_count: number
   */
  async setRevenueAttributes(attributes: {
    subscriptionStatus?: 'free' | 'premium';
    adBlockerDetected?: boolean;
    lifetimeValue?: number;
    sessionCount?: number;
    lastAdImpression?: string;
  }): Promise<void> {
    if (!this.isEnabled) return;

    try {
      const entries = Object.entries(attributes);
      for (const [key, value] of entries) {
        if (value !== undefined) {
          await crashlytics().setAttribute(key, String(value));
        }
      }

      logger.debug('Revenue attributes set', { attributes });
    } catch (error) {
      logger.error('Failed to set revenue attributes', { error });
    }
  }

  /**
   * Force a crash (testing only)
   * NEVER call in production code
   */
  async testCrash(): Promise<void> {
    if (__DEV__) {
      crashlytics().crash();
    } else {
      logger.warn('testCrash() called in production - ignoring');
    }
  }

  /**
   * Check if crash reporting is enabled
   */
  isCollectionEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Track AdMob-specific crashes
   * Critical: AdMob crashes reduce fill rate and revenue
   */
  async logAdError(
    errorType: 'load_failed' | 'show_failed' | 'clicked',
    adUnitId: string,
    error?: Error
  ): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await crashlytics().setAttribute('ad_error_type', errorType);
      await crashlytics().setAttribute('ad_unit_id', adUnitId);

      if (error) {
        await crashlytics().recordError(error);
      } else {
        await crashlytics().log(`AdMob Error: ${errorType} for ${adUnitId}`);
      }

      logger.error('AdMob error logged', { errorType, adUnitId, error });
    } catch (err) {
      logger.error('Failed to log AdMob error', { error: err });
    }
  }

  /**
   * Track route creation errors
   * Revenue impact: Failed routes = lost drivers = less revenue
   */
  async logRouteError(routeId: string, errorMessage: string): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await crashlytics().setAttribute('route_id', routeId);
      await crashlytics().log(`Route Error: ${errorMessage}`);

      logger.error('Route error logged', { routeId, errorMessage });
    } catch (error) {
      logger.error('Failed to log route error', { error });
    }
  }

  /**
   * Track payment errors
   * Direct revenue impact
   */
  async logPaymentError(amount: number, currency: string, errorMessage: string): Promise<void> {
    if (!this.isEnabled) return;

    try {
      await crashlytics().setAttribute('payment_amount', String(amount));
      await crashlytics().setAttribute('payment_currency', currency);
      await crashlytics().log(`Payment Error: ${errorMessage}`);

      logger.error('Payment error logged', { amount, currency, errorMessage });
    } catch (error) {
      logger.error('Failed to log payment error', { error });
    }
  }
}

// Singleton instance
const crashlyticsService = new CrashlyticsService();

export default crashlyticsService;
