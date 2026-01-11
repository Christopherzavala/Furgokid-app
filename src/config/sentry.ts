/**
 * Sentry Configuration
 * Error tracking and performance monitoring
 */

let Sentry: any = null;

try {
  Sentry = require('@sentry/react-native');
} catch (error) {
  console.warn('[Sentry] Package not installed: @sentry/react-native');
}

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
  if (!Sentry) {
    console.log('[Sentry] Package not available, skipping initialization');
    return;
  }

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
    const appVersion = Constants.expoConfig?.version || '1.0.0';
    const buildNumber =
      Constants.expoConfig?.ios?.buildNumber ||
      Constants.expoConfig?.android?.versionCode?.toString() ||
      '1';

    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,

      // Release tracking - linkear errores a versiones específicas
      release: `furgokid@${appVersion}`,
      dist: buildNumber,

      // Performance monitoring
      enableAutoSessionTracking: true,
      sessionTrackingIntervalMillis: 30000,

      // Sample rates
      sampleRate: config.sampleRate,
      tracesSampleRate: config.tracesSampleRate,

      // Tags iniciales de negocio
      initialScope: {
        tags: {
          appVersion,
          buildNumber,
          environment: config.environment,
          platform: Constants.platform?.ios ? 'ios' : 'android',
        },
      },

      // PII scrubbing
      beforeSend(event: any) {
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

        // Enrich with current context (if available)
        event.tags = event.tags || {};

        return event;
      },

      // Breadcrumbs
      beforeBreadcrumb(breadcrumb: { category: string; level: string }) {
        // Limit console logs
        if (breadcrumb.category === 'console' && breadcrumb.level === 'log') {
          return null;
        }
        return breadcrumb;
      },
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
  if (!Sentry || !getSentryConfig().enabled) {
    console.error('[Sentry] Exception (not sent):', error, context);
    return;
  }

  try {
    Sentry.captureException(error, {
      extra: context,
    });
  } catch (e) {
    console.error('[Sentry] Error capturing exception:', e);
  }
}

/**
 * Capture a message manually
 */
export function captureMessage(message: string, level: SentrySeverityLevel = 'info'): void {
  if (!Sentry || !getSentryConfig().enabled) {
    console.log(`[Sentry] Message (not sent) [${level}]:`, message);
    return;
  }

  try {
    Sentry.captureMessage(message, level);
  } catch (e) {
    console.error('[Sentry] Error capturing message:', e);
  }
}

/**
 * Set user context with role (driver, parent, admin)
 * Call this after login to track which user had the error
 */
export function setUserContext(
  user: {
    id: string;
    role: 'driver' | 'parent' | 'admin';
    schoolId?: string;
  } | null
): void {
  if (!Sentry || !getSentryConfig().enabled) {
    return;
  }

  try {
    if (user) {
      Sentry.setUser({ id: user.id });
      Sentry.setTag('userRole', user.role);
      if (user.schoolId) {
        Sentry.setTag('schoolId', user.schoolId);
      }
    } else {
      Sentry.setUser(null);
    }
  } catch (e) {
    console.error('[Sentry] Error setting user:', e);
  }
}

/**
 * Legacy alias - kept for backward compatibility
 */
export function setUser(user: { id: string; role?: string } | null): void {
  setUserContext(user as any);
}

/**
 * Set current screen name
 * Call this in navigation listener to track where errors occur
 */
export function setScreen(screenName: string): void {
  if (!Sentry || !getSentryConfig().enabled) {
    return;
  }

  try {
    Sentry.setTag('screen', screenName);
    addBreadcrumb(`Navigated to ${screenName}`, 'navigation');
  } catch (e) {
    console.error('[Sentry] Error setting screen:', e);
  }
}

/**
 * Set custom tag for business logic tracking
 */
export function setTag(key: string, value: string): void {
  if (!Sentry || !getSentryConfig().enabled) {
    return;
  }

  try {
    Sentry.setTag(key, value);
  } catch (e) {
    console.error('[Sentry] Error setting tag:', e);
  }
}

/**
 * Add breadcrumb
 */
export function addBreadcrumb(message: string, category: string, data?: Record<string, any>): void {
  if (!Sentry || !getSentryConfig().enabled) {
    return;
  }

  try {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    });
  } catch (e) {
    console.error('[Sentry] Error adding breadcrumb:', e);
  }
}

export default {
  initSentry,
  captureException,
  captureMessage,
  setUser, // Legacy
  setUserContext,
  setScreen,
  setTag,
  addBreadcrumb,
};
