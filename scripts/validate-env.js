/**
 * Environment Variables Validator
 * Validates that all required environment variables are set
 */

const chalk = require('chalk');

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
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.missing = [];
  }

  /**
   * Validate all environment variables
   */
  validate() {
    console.log(chalk.blue('\n🔍 Validating Environment Variables...\n'));

    Object.entries(REQUIRED_VARS).forEach(([key, config]) => {
      const value = process.env[key];

      if (!value) {
        if (config.critical) {
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
  const validator = new EnvValidator();

  const args = process.argv.slice(2);
  if (args.includes('--generate-example')) {
    validator.generateExample();
  } else {
    validator.validate();
  }
}

module.exports = EnvValidator;
