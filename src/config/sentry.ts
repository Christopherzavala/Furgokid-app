/**
 * Sentry Configuration
 * Error tracking and performance monitoring
 */

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

interface SentryConfig {
  enabled: boolean;
  dsn: string | undefined;
  environment: 'development' | 'preview' | 'production';
  sampleRate: number;
  tracesSampleRate: number;
}

type SentrySeverityLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

/**
 * Get Sentry configuration based on environment
 */
function getSentryConfig(): SentryConfig {
  const appVariant = Constants.expoConfig?.extra?.APP_VARIANT || 'development';
  const sentryEnabled = Constants.expoConfig?.extra?.SENTRY_ENABLED === 'true';

  return {
    enabled: sentryEnabled && appVariant !== 'development',
    dsn: Constants.expoConfig?.extra?.SENTRY_DSN,
    environment: appVariant as SentryConfig['environment'],
    sampleRate: appVariant === 'production' ? 1.0 : 0.5,
    tracesSampleRate: appVariant === 'production' ? 0.2 : 0.1,
  };
}

/**
 * Initialize Sentry with configuration
 */
export function initSentry(): void {
  const config = getSentryConfig();

  if (!config.enabled) {
    console.log('[Sentry] Disabled in development');
    return;
  }

  if (!config.dsn) {
    console.warn('[Sentry] DSN not configured');
    return;
  }

  try {
    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,

      // Performance monitoring
      enableAutoSessionTracking: true,
      sessionTrackingIntervalMillis: 30000,

      // Sample rates
      sampleRate: config.sampleRate,
      tracesSampleRate: config.tracesSampleRate,

      // PII scrubbing
      beforeSend(event) {
        // Remove sensitive data
        if (event.user) {
          delete event.user.email;
          delete event.user.ip_address;
        }

        // Remove sensitive headers
        if (event.request?.headers) {
          delete event.request.headers['Authorization'];
          delete event.request.headers['Cookie'];
        }

        return event;
      },

      // Breadcrumbs
      beforeBreadcrumb(breadcrumb) {
        // Limit console logs
        if (breadcrumb.category === 'console' && breadcrumb.level === 'log') {
          return null;
        }
        return breadcrumb;
      },

      // Release tracking
      release: Constants.expoConfig?.version,
      dist:
        Constants.expoConfig?.ios?.buildNumber ||
        Constants.expoConfig?.android?.versionCode?.toString(),
    });

    console.log(`[Sentry] Initialized (${config.environment}, sample rate: ${config.sampleRate})`);
  } catch (error) {
    console.error('[Sentry] Init error:', error);
  }
}

/**
 * Capture an exception manually
 */
export function captureException(error: Error, context?: Record<string, any>): void {
  if (getSentryConfig().enabled) {
    Sentry.captureException(error, {
      extra: context,
    });
  } else {
    console.error('[Sentry] Exception (not sent):', error, context);
  }
}

/**
 * Capture a message manually
 */
export function captureMessage(message: string, level: SentrySeverityLevel = 'info'): void {
  if (getSentryConfig().enabled) {
    Sentry.captureMessage(message, level);
  } else {
    console.log(`[Sentry] Message (not sent) [${level}]:`, message);
  }
}

/**
 * Set user context
 */
export function setUser(user: { id: string; role?: string } | null): void {
  if (getSentryConfig().enabled) {
    Sentry.setUser(user ? { id: user.id, role: user.role } : null);
  }
}

/**
 * Add breadcrumb
 */
export function addBreadcrumb(message: string, category: string, data?: Record<string, any>): void {
  if (getSentryConfig().enabled) {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    });
  }
}

export default {
  initSentry,
  captureException,
  captureMessage,
  setUser,
  addBreadcrumb,
};
