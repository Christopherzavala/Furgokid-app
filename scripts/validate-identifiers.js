#!/usr/bin/env node

/*
 * Validate that app identifiers are consistent across Expo config and Firebase config.
 *
 * Checks:
 * - app.config.js android.package matches google-services.json package_name
 * - app.config.js ios.bundleIdentifier is a valid reverse-DNS identifier
 * - Android/iOS IDs are lowercase (recommended; Android requires lowercase)
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

const APP_CONFIG_PATH = path.join(repoRoot, 'app.config.js');
const GOOGLE_SERVICES_PATH = path.join(repoRoot, 'google-services.json');

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function fail(message) {
  // eslint-disable-next-line no-console
  console.error(`❌ validate:ids: ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  // eslint-disable-next-line no-console
  console.log(`✅ validate:ids: ${message}`);
}

function parseExpoIdsFromAppConfig(appConfigText) {
  // We intentionally parse via regex to avoid module format issues (ESM export default).
  const androidPackageMatch = appConfigText.match(/\bpackage\s*:\s*['"]([^'"\n]+)['"]/);
  const iosBundleIdMatch = appConfigText.match(/\bbundleIdentifier\s*:\s*['"]([^'"\n]+)['"]/);

  return {
    androidPackage: androidPackageMatch ? androidPackageMatch[1].trim() : null,
    iosBundleIdentifier: iosBundleIdMatch ? iosBundleIdMatch[1].trim() : null,
  };
}

function isValidReverseDnsId(value) {
  // Conservative: 2+ segments, alphanum, underscore, dash allowed for iOS bundle IDs,
  // but Android applicationId must be lowercase letters/digits/underscore and dot.
  // We validate format and separately enforce lowercase.
  return /^[A-Za-z0-9][A-Za-z0-9_-]*(\.[A-Za-z0-9][A-Za-z0-9_-]*)+$/.test(value);
}

function isAllLowercase(value) {
  return value === value.toLowerCase();
}

function parseAndroidPackageFromGoogleServices(json) {
  if (!json || !Array.isArray(json.client)) return null;

  for (const client of json.client) {
    const pkg = client?.client_info?.android_client_info?.package_name;
    if (typeof pkg === 'string' && pkg.trim()) return pkg.trim();
  }

  return null;
}

function main() {
  if (!fs.existsSync(APP_CONFIG_PATH)) {
    fail(`Missing ${path.relative(repoRoot, APP_CONFIG_PATH)}`);
    return;
  }

  const appConfigText = readText(APP_CONFIG_PATH);
  const { androidPackage, iosBundleIdentifier } = parseExpoIdsFromAppConfig(appConfigText);

  if (!androidPackage) fail('Could not find android.package in app.config.js');
  if (!iosBundleIdentifier) fail('Could not find ios.bundleIdentifier in app.config.js');

  if (androidPackage) {
    // Android rules: must be lowercase and match applicationId-like format
    if (!isAllLowercase(androidPackage)) {
      fail(`android.package must be lowercase (found: ${androidPackage})`);
    }
    if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(androidPackage)) {
      fail(`android.package is not a valid Android applicationId (found: ${androidPackage})`);
    }
  }

  if (iosBundleIdentifier) {
    if (!isValidReverseDnsId(iosBundleIdentifier)) {
      fail(
        `ios.bundleIdentifier is not a valid reverse-DNS identifier (found: ${iosBundleIdentifier})`
      );
    }
    if (!isAllLowercase(iosBundleIdentifier)) {
      fail(
        `ios.bundleIdentifier should be lowercase for consistency (found: ${iosBundleIdentifier})`
      );
    }
  }

  if (fs.existsSync(GOOGLE_SERVICES_PATH)) {
    let googleServices;
    try {
      googleServices = JSON.parse(readText(GOOGLE_SERVICES_PATH));
    } catch (e) {
      fail(`google-services.json is not valid JSON (${e.message})`);
      googleServices = null;
    }

    if (googleServices) {
      const firebaseAndroidPackage = parseAndroidPackageFromGoogleServices(googleServices);
      if (!firebaseAndroidPackage) {
        fail('Could not find Android package_name in google-services.json');
      } else if (androidPackage && firebaseAndroidPackage !== androidPackage) {
        fail(
          `Mismatch: app.config.js android.package (${androidPackage}) != google-services.json package_name (${firebaseAndroidPackage}).\n` +
            'Re-download google-services.json from Firebase for the correct Android app.'
        );
      } else {
        ok(`Android IDs aligned (${androidPackage})`);
      }
    }
  } else {
    // Not all projects commit google-services.json (e.g., iOS-only). Don’t fail.
    ok('google-services.json not found; skipping Firebase Android package check');
  }

  if (androidPackage && iosBundleIdentifier) {
    if (androidPackage !== iosBundleIdentifier) {
      // Not strictly required, but recommended for sanity.
      // eslint-disable-next-line no-console
      console.warn(
        `⚠️  validate:ids: android.package (${androidPackage}) and ios.bundleIdentifier (${iosBundleIdentifier}) differ. ` +
          'This is allowed, but keep docs and Firebase key restrictions in sync.'
      );
    }
  }

  if (process.exitCode === 1) {
    // eslint-disable-next-line no-console
    console.error('❌ validate:ids: failed');
  } else {
    ok('passed');
  }
}

main();
