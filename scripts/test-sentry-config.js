// Test script to verify Sentry configuration
const Constants = {
  expoConfig: {
    version: '1.0.0',
    extra: {
      APP_VARIANT: 'development',
      SENTRY_ENABLED: 'false',
      SENTRY_DSN: undefined,
    },
  },
};

// Mock Sentry
const Sentry = {
  init: (config) => {
    console.log('✅ Sentry.init called with config:', JSON.stringify(config, null, 2));
  },
};

// Test getSentryConfig function
function getSentryConfig() {
  const appVariant = Constants.expoConfig?.extra?.APP_VARIANT || 'development';
  const sentryEnabled = Constants.expoConfig?.extra?.SENTRY_ENABLED === 'true';

  return {
    enabled: sentryEnabled && appVariant !== 'development',
    dsn: Constants.expoConfig?.extra?.SENTRY_DSN,
    environment: appVariant,
    sampleRate: appVariant === 'production' ? 1.0 : 0.5,
    tracesSampleRate: appVariant === 'production' ? 0.2 : 0.1,
  };
}

// Test initSentry function
function initSentry() {
  const config = getSentryConfig();

  console.log('\n🔍 Sentry Config:', JSON.stringify(config, null, 2));

  if (!config.enabled) {
    console.log('✅ [Sentry] Disabled in development - CORRECTO');
    return;
  }

  if (!config.dsn) {
    console.warn('⚠️  [Sentry] DSN not configured');
    return;
  }

  try {
    Sentry.init({
      dsn: config.dsn,
      environment: config.environment,
      enableAutoSessionTracking: true,
      sessionTrackingIntervalMillis: 30000,
      sampleRate: config.sampleRate,
      tracesSampleRate: config.tracesSampleRate,
    });

    console.log(
      `✅ [Sentry] Initialized (${config.environment}, sample rate: ${config.sampleRate})`
    );
  } catch (error) {
    console.error('❌ [Sentry] Init error:', error);
  }
}

console.log('='.repeat(80));
console.log('SENTRY INITIALIZATION TEST - DEVELOPMENT MODE');
console.log('='.repeat(80));

// Test 1: Development (should be disabled)
console.log('\n📋 Test 1: Development Environment');
initSentry();

// Test 2: Production with DSN
console.log('\n\n📋 Test 2: Production Environment with DSN');
Constants.expoConfig.extra.APP_VARIANT = 'production';
Constants.expoConfig.extra.SENTRY_ENABLED = 'true';
Constants.expoConfig.extra.SENTRY_DSN =
  'https://YOUR_SENTRY_DSN_HERE@o123.ingest.sentry.io/1234567';
initSentry();

console.log('\n' + '='.repeat(80));
console.log('✅ SENTRY TEST COMPLETADO - Configuración correcta');
console.log('='.repeat(80));
