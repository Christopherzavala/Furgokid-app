/**
 * E2E Test - Registration Flow
 *
 * Tests the complete user registration process for both parent and driver roles.
 * This test ensures COPPA/GDPR compliance with parental consent flow.
 *
 * Test Cases:
 * 1. Parent registration (successful)
 * 2. Driver registration (successful)
 * 3. Invalid email format (error handling)
 * 4. Weak password (error handling)
 * 5. Parental consent flow (for users with children)
 */

describe('Registration Flow', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { location: 'always', notifications: 'YES' },
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('should display registration screen', async () => {
    await expect(element(by.id('loginScreen'))).toBeVisible();
    await element(by.id('registerButton')).tap();
    await expect(element(by.id('registerScreen'))).toBeVisible();
  });

  it('should register a new parent user successfully', async () => {
    // Navigate to registration
    await element(by.id('registerButton')).tap();
    await expect(element(by.id('registerScreen'))).toBeVisible();

    // Fill registration form
    await element(by.id('nameInput')).typeText('Test Parent');
    await element(by.id('emailInput')).typeText(`parent${Date.now()}@test.com`);
    await element(by.id('passwordInput')).typeText('Test123456');
    await element(by.id('whatsappInput')).typeText('+1234567890');

    // Select parent role
    await element(by.id('roleSelector')).tap();
    await element(by.text('Padre/Madre')).tap();

    // Submit registration
    await element(by.id('submitButton')).tap();

    // Should show parental consent screen for parents with children
    await waitFor(element(by.id('parentalConsentScreen')))
      .toBeVisible()
      .withTimeout(5000);

    // Fill parental consent
    await element(by.id('parentNameInput')).typeText('Test Parent');
    await element(by.id('parentEmailInput')).typeText(`parent${Date.now()}@test.com`);
    await element(by.id('childNameInput')).typeText('Test Child');
    await element(by.id('childDOBInput')).typeText('01/01/2015');
    await element(by.id('consentCheckbox')).tap();
    await element(by.id('submitConsentButton')).tap();

    // Should navigate to parent home screen
    await waitFor(element(by.id('parentHomeScreen')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should register a new driver user successfully', async () => {
    // Navigate to registration
    await element(by.id('registerButton')).tap();

    // Fill registration form
    await element(by.id('nameInput')).typeText('Test Driver');
    await element(by.id('emailInput')).typeText(`driver${Date.now()}@test.com`);
    await element(by.id('passwordInput')).typeText('Test123456');
    await element(by.id('whatsappInput')).typeText('+0987654321');

    // Select driver role
    await element(by.id('roleSelector')).tap();
    await element(by.text('Conductor')).tap();

    // Submit registration
    await element(by.id('submitButton')).tap();

    // Should navigate to driver home screen (no parental consent needed)
    await waitFor(element(by.id('driverHomeScreen')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should show error for invalid email format', async () => {
    await element(by.id('registerButton')).tap();

    await element(by.id('nameInput')).typeText('Test User');
    await element(by.id('emailInput')).typeText('invalid-email');
    await element(by.id('passwordInput')).typeText('Test123456');
    await element(by.id('submitButton')).tap();

    // Should show error message
    await expect(element(by.text('Email inválido'))).toBeVisible();
  });

  it('should show error for weak password', async () => {
    await element(by.id('registerButton')).tap();

    await element(by.id('nameInput')).typeText('Test User');
    await element(by.id('emailInput')).typeText(`test${Date.now()}@test.com`);
    await element(by.id('passwordInput')).typeText('123'); // Too short
    await element(by.id('submitButton')).tap();

    // Should show error message
    await expect(element(by.text(/contraseña.*6.*caracteres/i))).toBeVisible();
  });

  it('should handle network errors gracefully', async () => {
    // Simulate offline mode
    await device.setNetworkCondition('offline');

    await element(by.id('registerButton')).tap();
    await element(by.id('nameInput')).typeText('Test User');
    await element(by.id('emailInput')).typeText(`test${Date.now()}@test.com`);
    await element(by.id('passwordInput')).typeText('Test123456');
    await element(by.id('submitButton')).tap();

    // Should show network error
    await expect(element(by.text(/error.*conexión/i))).toBeVisible();

    // Restore network
    await device.setNetworkCondition('wifi');
  });
});
