/**
 * Environment Variables Validator
 * Validates that all required environment variables are set
 */

const chalk = require('chalk');
require('dotenv').config({ override: false });

function parseArgs(argv) {
  const options = {
    mode: null,
    requireProdAds: false,
    generateExample: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--generate-example') {
      options.generateExample = true;
      continue;
    }
    if (arg === '--mode') {
      options.mode = String(argv[i + 1] || '').toLowerCase();
      i++;
      continue;
    }
    if (arg === '--production') {
      options.mode = 'production';
      continue;
    }
    if (arg === '--require-prod-ads') {
      options.requireProdAds = true;
      continue;
    }
  }

  return options;
}

// Required environment variables
const REQUIRED_VARS = {
  // Firebase
  EXPO_PUBLIC_FIREBASE_API_KEY: {
    description: 'Firebase API Key',
    example: 'AIzaSy...',
    critical: true,
  },
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: {
    description: 'Firebase Auth Domain',
    example: 'your-project.firebaseapp.com',
    critical: true,
  },
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: {
    description: 'Firebase Project ID',
    example: 'your-project-id',
    critical: true,
  },
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: {
    description: 'Firebase Storage Bucket',
    example: 'your-project.appspot.com',
    critical: true,
  },
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: {
    description: 'Firebase Messaging Sender ID',
    example: '1234567890',
    critical: true,
  },
  EXPO_PUBLIC_FIREBASE_APP_ID: {
    description: 'Firebase App ID',
    example: '1:1234567890:web:abcdef',
    critical: true,
  },

  // AdMob
  ADMOB_ANDROID_APP_ID: {
    description: 'AdMob Android App ID',
    example: 'ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX',
    critical: true,
    warning: 'Using TEST ID - change before production!',
  },
  ADMOB_IOS_APP_ID: {
    description: 'AdMob iOS App ID',
    example: 'ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX',
    critical: true,
    warning: 'Using TEST ID - change before production!',
  },

  // Ad unit IDs (recommended in dev, required for production ads mode)
  BANNER_AD_UNIT_ID: {
    description: 'AdMob Android Banner Ad Unit ID',
    example: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
    critical: false,
    requiresProdAds: true,
  },
  INTERSTITIAL_AD_UNIT_ID: {
    description: 'AdMob Android Interstitial Ad Unit ID',
    example: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
    critical: false,
    requiresProdAds: true,
  },
  REWARDED_AD_UNIT_ID: {
    description: 'AdMob Android Rewarded Ad Unit ID',
    example: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
    critical: false,
    requiresProdAds: true,
  },
  BANNER_AD_UNIT_IOS: {
    description: 'AdMob iOS Banner Ad Unit ID',
    example: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
    critical: false,
    requiresProdAds: false,
  },
  INTERSTITIAL_AD_UNIT_IOS: {
    description: 'AdMob iOS Interstitial Ad Unit ID',
    example: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
    critical: false,
    requiresProdAds: false,
  },
  REWARDED_AD_UNIT_IOS: {
    description: 'AdMob iOS Rewarded Ad Unit ID',
    example: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
    critical: false,
    requiresProdAds: false,
  },

  // Google Maps
  GOOGLE_MAPS_API_KEY: {
    description: 'Google Maps API Key',
    example: 'AIzaSy...',
    critical: true,
  },

  // Optional but recommended
  SENTRY_DSN: {
    description: 'Sentry DSN for error tracking',
    example: 'https://[key]@[org].ingest.sentry.io/[project]',
    critical: false,
    requiresSentry: true,
  },
  SENTRY_ENABLED: {
    description: 'Enable Sentry error tracking',
    example: 'true',
    critical: false,
  },
  FIREBASE_ANALYTICS_ENABLED: {
    description: 'Enable Firebase Analytics (SDK 55+)',
    example: 'false',
    critical: false,
  },
};

class EnvValidator {
  constructor(options = {}) {
    this.errors = [];
    this.warnings = [];
    this.missing = [];
    this.options = options;
  }

  /**
   * Validate all environment variables
   */
  validate() {
    const mode = String(this.options.mode || '').toLowerCase();
    const isProductionValidation = mode === 'prod' || mode === 'production';

    console.log(chalk.blue('\n🔍 Validating Environment Variables...\n'));
    if (isProductionValidation) {
      console.log(chalk.gray('Mode: production (stricter checks enabled)\n'));
    }

    const adsModeRaw = String(process.env.EXPO_PUBLIC_ADS_MODE || '').toLowerCase();
    const adsForceTestRaw = String(process.env.EXPO_PUBLIC_ADS_FORCE_TEST || '').toLowerCase();
    const adsMode = adsModeRaw || 'test';
    const adsForceTest =
      adsForceTestRaw === '1' || adsForceTestRaw === 'true' || adsForceTestRaw === 'yes';
    const requireProdAds =
      (this.options.requireProdAds ||
        isProductionValidation ||
        adsMode === 'prod' ||
        adsMode === 'production') &&
      !adsForceTest;

    const sentryEnabledRaw = String(process.env.SENTRY_ENABLED || '').toLowerCase();
    const sentryEnabled =
      sentryEnabledRaw === '1' || sentryEnabledRaw === 'true' || sentryEnabledRaw === 'yes';
    const requireSentryDsn = isProductionValidation && sentryEnabled;

    Object.entries(REQUIRED_VARS).forEach(([key, config]) => {
      const value = process.env[key];

      const isCriticalNow = Boolean(
        config.critical ||
          (config.requiresProdAds && requireProdAds) ||
          (config.requiresSentry && requireSentryDsn)
      );

      if (!value) {
        if (isCriticalNow) {
          this.errors.push({
            key,
            message: `Missing critical variable: ${config.description}`,
            example: config.example,
          });
        } else {
          this.warnings.push({
            key,
            message: `Missing optional variable: ${config.description}`,
            example: config.example,
          });
        }
        this.missing.push(key);
      } else {
        // Check for test/placeholder values
        if (this.isTestValue(value, key)) {
          this.warnings.push({
            key,
            message: config.warning || `${key} appears to be a test value`,
            value: this.maskValue(value),
          });
        }

        console.log(chalk.green(`✓ ${key}`));
      }
    });

    this.printResults();

    // Exit with error if critical vars are missing
    if (this.errors.length > 0) {
      process.exit(1);
    }
  }

  /**
   * Check if value is a test/placeholder
   */
  isTestValue(value, key) {
    const testPatterns = [
      /test/i,
      /demo/i,
      /example/i,
      /placeholder/i,
      /XXX/,
      /ca-app-pub-3940256099942544/i, // AdMob test ID
    ];

    return testPatterns.some((pattern) => pattern.test(value));
  }

  /**
   * Mask sensitive values for logging
   */
  maskValue(value) {
    if (value.length <= 10) return '***';
    return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
  }

  /**
   * Print validation results
   */
  printResults() {
    console.log('\n' + '='.repeat(60));

    if (this.errors.length > 0) {
      console.log(chalk.red('\n❌ CRITICAL ERRORS:\n'));
      this.errors.forEach(({ key, message, example }) => {
        console.log(chalk.red(`  • ${message}`));
        console.log(chalk.gray(`    Example: ${example}`));
      });
      console.log(chalk.yellow('\nAdd to .env file or EAS Secrets:'));
      console.log(
        chalk.gray(
          `  eas secret:create --scope project --name ${this.missing[0]} --value "your-value"`
        )
      );
    }

    if (this.warnings.length > 0) {
      console.log(chalk.yellow('\n⚠️  WARNINGS:\n'));
      this.warnings.forEach(({ key, message, value }) => {
        console.log(chalk.yellow(`  • ${message}`));
        if (value) {
          console.log(chalk.gray(`    Current: ${value}`));
        }
      });
    }

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log(chalk.green('\n✅ All environment variables are configured correctly!'));
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }

  /**
   * Generate .env.example file
   */
  generateExample() {
    console.log(chalk.blue('Generating .env.example...\n'));

    const lines = [
      '# FurgoKid Environment Variables',
      '# Copy this file to .env and fill in your values',
      '# DO NOT commit .env to git!',
      '',
    ];

    Object.entries(REQUIRED_VARS).forEach(([key, config]) => {
      lines.push(`# ${config.description}`);
      lines.push(`${key}=${config.example}`);
      lines.push('');
    });

    const fs = require('fs');
    fs.writeFileSync('.env.example', lines.join('\n'));

    console.log(chalk.green('✅ .env.example generated!'));
  }
}

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  const validator = new EnvValidator(options);

  if (options.generateExample) validator.generateExample();
  else validator.validate();
}

module.exports = EnvValidator;
