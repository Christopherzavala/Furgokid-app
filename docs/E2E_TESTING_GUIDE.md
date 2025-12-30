# E2E Testing with Detox

## 🎯 Overview

FurgoKid uses Detox for End-to-End testing to validate critical user flows before production deployment.

---

## 📋 Installation

```bash
# Install Detox CLI globally
npm install -g detox-cli

# Install Detox and dependencies
npm install --save-dev detox@20.13.0 jest@29.7.0
```

---

## 🔧 Android Setup

### Prerequisites

1. **Android Studio** installed
2. **Android SDK** (API 34)
3. **Android Emulator** created and running

### Create AVD (Android Virtual Device)

```bash
# Open Android Studio → Tools → Device Manager → Create Device
# Name: Pixel_7_API_34
# Device: Pixel 7
# System Image: API 34 (Android 14)
```

### Build and Test

```bash
# Build test APK
npm run e2e:build:android

# Run E2E tests
npm run e2e:test:android
```

---

## 🍎 iOS Setup

### Prerequisites

1. **Xcode** installed (15.0+)
2. **iOS Simulator** installed
3. **applesimutils** installed:

```bash
brew tap wix/brew
brew install applesimutils
```

### Build and Test

```bash
# Build test app
npm run e2e:build:ios

# Run E2E tests
npm run e2e:test:ios
```

---

## 📝 Test Files

| File                         | Description            | Test Cases                                                                                     |
| ---------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------- |
| **e2e/registration.test.js** | User registration flow | Parent registration, Driver registration, Email validation, Password validation, COPPA consent |
| **e2e/login.test.js**        | Authentication flow    | Login success/failure, Forgot password, Session persistence, SQL injection prevention          |
| **e2e/search-match.test.js** | Core business logic    | Search routes, Apply filters, Send requests, Match creation                                    |

---

## 🧪 Running Tests

### Run all tests

```bash
# Android
detox test --configuration android.debug

# iOS
detox test --configuration ios.debug
```

### Run specific test file

```bash
# Run only login tests
detox test e2e/login.test.js --configuration android.debug

# Run only search tests
detox test e2e/search-match.test.js --configuration android.debug
```

### Run in headless mode (CI/CD)

```bash
detox test --configuration android.release --headless
```

---

## 🎯 Test Coverage

Our E2E tests cover:

✅ **Registration Flow**

- Parent registration with COPPA compliance
- Driver registration
- Input validation (email, password)
- Error handling

✅ **Login Flow**

- Successful authentication
- Invalid credentials handling
- Forgot password flow
- Session persistence
- Security (SQL injection, XSS prevention)

✅ **Search & Match Flow**

- Route search
- Filter by zone, schedule, price
- Route details view
- Send request to driver
- Offline mode handling

✅ **GDPR Compliance**

- Parental consent flow
- Data export functionality
- Account deletion

---

## 🐛 Troubleshooting

### Android: "No emulator found"

```bash
# List available AVDs
emulator -list-avds

# Start emulator manually
emulator -avd Pixel_7_API_34
```

### iOS: "Simulator not found"

```bash
# List simulators
xcrun simctl list devices

# Boot simulator
xcrun simctl boot "iPhone 15 Pro"
```

### Test timeout errors

```javascript
// Increase timeout in e2e/jest.config.js
module.exports = {
  testTimeout: 180000, // 3 minutes
};
```

### App not responding

```bash
# Rebuild the app
npm run e2e:build:android

# Clear app data
adb shell pm clear com.furgokid.app
```

---

## 📊 Test Execution Time

| Test Suite     | Duration         |
| -------------- | ---------------- |
| Registration   | ~2-3 minutes     |
| Login          | ~1-2 minutes     |
| Search & Match | ~3-4 minutes     |
| **Total**      | **~6-9 minutes** |

---

## 🚀 CI/CD Integration

Tests run automatically on Pull Requests:

```yaml
# .github/workflows/ci-cd.yml
- name: Run E2E Tests
  run: |
    npm run e2e:build:android
    npm run e2e:test:android
```

---

## 📝 Writing New Tests

### Test Structure

```javascript
describe('Feature Name', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should do something', async () => {
    await element(by.id('buttonId')).tap();
    await expect(element(by.id('resultId'))).toBeVisible();
  });

  afterAll(async () => {
    await device.terminateApp();
  });
});
```

### Element Selectors

```javascript
// By test ID (recommended)
element(by.id('loginButton'));

// By text
element(by.text('Login'));

// By label (iOS)
element(by.label('Login'));

// Combined selectors
element(by.id('button').and(by.text('Submit')));
```

### Actions

```javascript
// Tap
await element(by.id('button')).tap();

// Type text
await element(by.id('input')).typeText('Hello');

// Swipe
await element(by.id('scrollView')).swipe('up');

// Replace text
await element(by.id('input')).replaceText('New text');
```

### Assertions

```javascript
// Visibility
await expect(element(by.id('element'))).toBeVisible();
await expect(element(by.id('element'))).not.toBeVisible();

// Existence
await expect(element(by.id('element'))).toExist();

// Text
await expect(element(by.id('element'))).toHaveText('Hello');

// Value
await expect(element(by.id('input'))).toHaveValue('123');
```

---

## 🔐 Test Data

Use Firebase staging project for test data:

**Test Accounts:**

- Parent: `parent@test.com` / `Test123456`
- Driver: `driver@test.com` / `Test123456`

**Test Routes:**

- Ruta Centro - Escuela Norte (morning, centro zone)
- Ruta Sur - Colegio Oeste (afternoon, sur zone)

---

## ✅ Pre-Production Checklist

Before building production APK:

- [ ] All E2E tests passing
- [ ] No console errors in tests
- [ ] Test coverage > 80%
- [ ] Performance tests passing
- [ ] Security tests passing
- [ ] GDPR/COPPA compliance validated

---

**Last Updated:** 30 December 2025  
**Detox Version:** 20.13.0  
**Jest Version:** 29.7.0
