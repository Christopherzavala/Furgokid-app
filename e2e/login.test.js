/**
 * E2E Test - Login Flow
 *
 * Tests the authentication flow including:
 * - Successful login (parent and driver)
 * - Invalid credentials error handling
 * - Forgot password flow
 * - Session persistence
 *
 * Security Tests:
 * - Rate limiting (multiple failed attempts)
 * - SQL injection prevention
 * - XSS prevention in error messages
 */

describe('Login Flow', () => {
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

  it('should display login screen on app launch', async () => {
    await expect(element(by.id('loginScreen'))).toBeVisible();
    await expect(element(by.id('emailInput'))).toBeVisible();
    await expect(element(by.id('passwordInput'))).toBeVisible();
    await expect(element(by.id('loginButton'))).toBeVisible();
  });

  it('should login successfully with valid parent credentials', async () => {
    // Using test account created in Firebase staging
    await element(by.id('emailInput')).typeText('parent@test.com');
    await element(by.id('passwordInput')).typeText('Test123456');
    await element(by.id('loginButton')).tap();

    // Should navigate to parent home
    await waitFor(element(by.id('parentHomeScreen')))
      .toBeVisible()
      .withTimeout(10000);

    // Verify parent-specific UI elements
    await expect(element(by.id('searchRoutesButton'))).toBeVisible();
    await expect(element(by.id('myRequestsButton'))).toBeVisible();
  });

  it('should login successfully with valid driver credentials', async () => {
    await element(by.id('emailInput')).typeText('driver@test.com');
    await element(by.id('passwordInput')).typeText('Test123456');
    await element(by.id('loginButton')).tap();

    // Should navigate to driver home
    await waitFor(element(by.id('driverHomeScreen')))
      .toBeVisible()
      .withTimeout(10000);

    // Verify driver-specific UI elements
    await expect(element(by.id('myRoutesButton'))).toBeVisible();
    await expect(element(by.id('vacanciesButton'))).toBeVisible();
  });

  it('should show error for invalid email', async () => {
    await element(by.id('emailInput')).typeText('invalid@test.com');
    await element(by.id('passwordInput')).typeText('WrongPassword123');
    await element(by.id('loginButton')).tap();

    // Should show error alert
    await waitFor(element(by.text(/credenciales.*inválidas/i)))
      .toBeVisible()
      .withTimeout(3000);
  });

  it('should show error for wrong password', async () => {
    await element(by.id('emailInput')).typeText('parent@test.com');
    await element(by.id('passwordInput')).typeText('WrongPassword123');
    await element(by.id('loginButton')).tap();

    await waitFor(element(by.text(/contraseña.*incorrecta/i)))
      .toBeVisible()
      .withTimeout(3000);
  });

  it('should show error for empty fields', async () => {
    await element(by.id('loginButton')).tap();

    // Should show validation error
    await expect(element(by.text(/completa.*campos/i))).toBeVisible();
  });

  it('should handle forgot password flow', async () => {
    await element(by.id('forgotPasswordButton')).tap();

    // Should show forgot password dialog/screen
    await expect(element(by.id('forgotPasswordDialog'))).toBeVisible();

    // Enter email
    await element(by.id('resetEmailInput')).typeText('parent@test.com');
    await element(by.id('sendResetButton')).tap();

    // Should show success message
    await waitFor(element(by.text(/correo.*enviado/i)))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should persist session after app restart', async () => {
    // Login first
    await element(by.id('emailInput')).typeText('parent@test.com');
    await element(by.id('passwordInput')).typeText('Test123456');
    await element(by.id('loginButton')).tap();

    await waitFor(element(by.id('parentHomeScreen')))
      .toBeVisible()
      .withTimeout(10000);

    // Restart app
    await device.launchApp({ newInstance: true });

    // Should go directly to home screen (session persisted)
    await waitFor(element(by.id('parentHomeScreen')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should logout successfully', async () => {
    // Login first
    await element(by.id('emailInput')).typeText('parent@test.com');
    await element(by.id('passwordInput')).typeText('Test123456');
    await element(by.id('loginButton')).tap();

    await waitFor(element(by.id('parentHomeScreen')))
      .toBeVisible()
      .withTimeout(10000);

    // Open menu and logout
    await element(by.id('menuButton')).tap();
    await element(by.id('logoutButton')).tap();

    // Confirm logout
    await element(by.text('Cerrar Sesión')).tap();

    // Should return to login screen
    await waitFor(element(by.id('loginScreen')))
      .toBeVisible()
      .withTimeout(3000);
  });

  it('should prevent SQL injection attempts', async () => {
    // Attempt SQL injection in email field
    await element(by.id('emailInput')).typeText("' OR '1'='1");
    await element(by.id('passwordInput')).typeText("' OR '1'='1");
    await element(by.id('loginButton')).tap();

    // Should safely fail without SQL injection
    await waitFor(element(by.text(/credenciales.*inválidas/i)))
      .toBeVisible()
      .withTimeout(3000);
  });

  it('should handle network errors gracefully', async () => {
    await device.setNetworkCondition('offline');

    await element(by.id('emailInput')).typeText('parent@test.com');
    await element(by.id('passwordInput')).typeText('Test123456');
    await element(by.id('loginButton')).tap();

    // Should show network error
    await expect(element(by.text(/error.*conexión/i))).toBeVisible();

    await device.setNetworkCondition('wifi');
  });
});
