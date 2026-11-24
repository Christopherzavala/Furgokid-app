'use strict';

const fs = require('node:fs');
const {
  BLOCKED_CODE,
  initializeExternalNotificationGuard,
  sendExpoPush,
} = require('../src/externalNotifications');

describe('externalNotifications Unit Tests', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  test('initializeExternalNotificationGuard does nothing if guard is not true', () => {
    process.env.CI_DISABLE_EXTERNAL_NOTIFICATIONS = 'false';
    expect(() => initializeExternalNotificationGuard()).not.toThrow();
  });

  test('initializeExternalNotificationGuard throws configuration error if environment variables are missing', () => {
    process.env.CI_DISABLE_EXTERNAL_NOTIFICATIONS = 'true';
    delete process.env.CI_EXTERNAL_NOTIFICATION_GUARD_READY_FILE;
    delete process.env.CI_EXTERNAL_NOTIFICATION_ATTEMPT_FILE;

    expect(() => initializeExternalNotificationGuard()).toThrow(
      'Could not initialize the CI external notification guard.'
    );
  });

  test('initializeExternalNotificationGuard successfully writes guard signals when enabled', () => {
    const tmpFile1 = `${__dirname}/temp_ready.txt`;
    const tmpFile2 = `${__dirname}/temp_attempt.txt`;

    process.env.CI_DISABLE_EXTERNAL_NOTIFICATIONS = 'true';
    process.env.CI_EXTERNAL_NOTIFICATION_GUARD_READY_FILE = tmpFile1;
    process.env.CI_EXTERNAL_NOTIFICATION_ATTEMPT_FILE = tmpFile2;

    try {
      initializeExternalNotificationGuard();
      expect(fs.existsSync(tmpFile1)).toBe(true);
      expect(fs.existsSync(tmpFile2)).toBe(true);
    } finally {
      if (fs.existsSync(tmpFile1)) fs.unlinkSync(tmpFile1);
      if (fs.existsSync(tmpFile2)) fs.unlinkSync(tmpFile2);
    }
  });

  test('sendExpoPush blocks requests and logs attempt when guard is enabled', async () => {
    const tmpFile = `${__dirname}/temp_attempt_push.txt`;
    process.env.CI_DISABLE_EXTERNAL_NOTIFICATIONS = 'true';
    process.env.CI_EXTERNAL_NOTIFICATION_ATTEMPT_FILE = tmpFile;

    try {
      await expect(sendExpoPush({ payload: {}, headers: {} })).rejects.toMatchObject({
        code: BLOCKED_CODE,
      });
      expect(fs.existsSync(tmpFile)).toBe(true);
    } finally {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });

  test('sendExpoPush handles error when attempt file env is missing in guard mode', async () => {
    process.env.CI_DISABLE_EXTERNAL_NOTIFICATIONS = 'true';
    delete process.env.CI_EXTERNAL_NOTIFICATION_ATTEMPT_FILE;

    await expect(sendExpoPush({ payload: {}, headers: {} })).rejects.toMatchObject({
      code: BLOCKED_CODE,
    });
  });

  test('sendExpoPush performs fetch request when guard is disabled', async () => {
    process.env.CI_DISABLE_EXTERNAL_NOTIFICATIONS = 'false';
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch;

    const res = await sendExpoPush({
      payload: { to: 'token', title: 'test' },
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://exp.host/--/api/v2/push/send',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });
});
