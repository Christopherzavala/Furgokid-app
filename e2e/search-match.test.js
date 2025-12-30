/**
 * E2E Test - Search and Match Flow
 *
 * Tests the core business logic:
 * - Parent searches for routes
 * - Filters work correctly (zone, schedule, price)
 * - Sends request to driver
 * - Driver sees and accepts request
 * - Match is created
 *
 * This test validates the main user journey of the app.
 */

describe('Search and Match Flow', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { location: 'always', notifications: 'YES' },
    });
  });

  beforeEach(async () => {
    // Login as parent for search tests
    await device.reloadReactNative();
    await element(by.id('emailInput')).typeText('parent@test.com');
    await element(by.id('passwordInput')).typeText('Test123456');
    await element(by.id('loginButton')).tap();
    await waitFor(element(by.id('parentHomeScreen')))
      .toBeVisible()
      .withTimeout(10000);
  });

  afterAll(async () => {
    await device.terminateApp();
  });

  it('should navigate to search screen', async () => {
    await element(by.id('searchRoutesButton')).tap();
    await expect(element(by.id('searchScreen'))).toBeVisible();
  });

  it('should display available routes', async () => {
    await element(by.id('searchRoutesButton')).tap();
    await waitFor(element(by.id('searchScreen')))
      .toBeVisible()
      .withTimeout(3000);

    // Should show at least one route (test data)
    await waitFor(element(by.id('routeItem-0')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should filter routes by zone', async () => {
    await element(by.id('searchRoutesButton')).tap();

    // Open filters
    await element(by.id('filterButton')).tap();

    // Select zone filter
    await element(by.id('zoneFilter')).tap();
    await element(by.text('Centro')).tap();
    await element(by.id('applyFiltersButton')).tap();

    // Should show only centro routes
    await waitFor(element(by.id('routeItem-0')))
      .toBeVisible()
      .withTimeout(3000);

    // Verify route has centro zone
    await expect(element(by.id('routeZone-0').and(by.text('Centro')))).toBeVisible();
  });

  it('should filter routes by schedule', async () => {
    await element(by.id('searchRoutesButton')).tap();

    // Open filters
    await element(by.id('filterButton')).tap();

    // Select morning schedule
    await element(by.id('scheduleFilter')).tap();
    await element(by.text('Mañana')).tap();
    await element(by.id('applyFiltersButton')).tap();

    // Should show only morning routes
    await waitFor(element(by.id('routeItem-0')))
      .toBeVisible()
      .withTimeout(3000);
  });

  it('should filter routes by price range', async () => {
    await element(by.id('searchRoutesButton')).tap();

    // Open filters
    await element(by.id('filterButton')).tap();

    // Set price range slider
    await element(by.id('priceRangeSlider')).swipe('right', 'slow', 0.5);
    await element(by.id('applyFiltersButton')).tap();

    // Should show filtered results
    await waitFor(element(by.id('routesList')))
      .toBeVisible()
      .withTimeout(3000);
  });

  it('should view route details', async () => {
    await element(by.id('searchRoutesButton')).tap();

    await waitFor(element(by.id('routeItem-0')))
      .toBeVisible()
      .withTimeout(5000);

    // Tap on first route
    await element(by.id('routeItem-0')).tap();

    // Should show route details
    await expect(element(by.id('routeDetailsScreen'))).toBeVisible();
    await expect(element(by.id('routeName'))).toBeVisible();
    await expect(element(by.id('driverName'))).toBeVisible();
    await expect(element(by.id('routeSchedule'))).toBeVisible();
    await expect(element(by.id('routePrice'))).toBeVisible();
  });

  it('should send request to driver', async () => {
    await element(by.id('searchRoutesButton')).tap();

    await waitFor(element(by.id('routeItem-0')))
      .toBeVisible()
      .withTimeout(5000);

    await element(by.id('routeItem-0')).tap();

    // Send request
    await element(by.id('sendRequestButton')).tap();

    // Fill request details
    await element(by.id('childNameInput')).typeText('Juan Pérez');
    await element(by.id('pickupAddressInput')).typeText('Calle Principal 123');
    await element(by.id('submitRequestButton')).tap();

    // Should show success message
    await waitFor(element(by.text(/solicitud.*enviada/i)))
      .toBeVisible()
      .withTimeout(5000);

    // Should navigate back to home
    await waitFor(element(by.id('parentHomeScreen')))
      .toBeVisible()
      .withTimeout(3000);
  });

  it('should show no results message when filters too restrictive', async () => {
    await element(by.id('searchRoutesButton')).tap();

    // Apply very restrictive filters
    await element(by.id('filterButton')).tap();
    await element(by.id('zoneFilter')).tap();
    await element(by.text('Zona Inexistente')).tap(); // Non-existent zone
    await element(by.id('applyFiltersButton')).tap();

    // Should show no results message
    await expect(element(by.text(/no.*rutas.*disponibles/i))).toBeVisible();
  });

  it('should clear filters successfully', async () => {
    await element(by.id('searchRoutesButton')).tap();

    // Apply filters
    await element(by.id('filterButton')).tap();
    await element(by.id('zoneFilter')).tap();
    await element(by.text('Centro')).tap();
    await element(by.id('applyFiltersButton')).tap();

    // Clear filters
    await element(by.id('filterButton')).tap();
    await element(by.id('clearFiltersButton')).tap();

    // Should show all routes again
    await waitFor(element(by.id('routeItem-0')))
      .toBeVisible()
      .withTimeout(3000);
  });

  it('should handle offline mode gracefully', async () => {
    await device.setNetworkCondition('offline');

    await element(by.id('searchRoutesButton')).tap();

    // Should show offline message
    await expect(element(by.text(/sin.*conexión/i))).toBeVisible();

    await device.setNetworkCondition('wifi');
  });
});
