const fs = require('node:fs');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BLOCKED_CODE = 'CI_EXTERNAL_NOTIFICATION_BLOCKED';
const GUARD_ENABLED = 'CI_DISABLE_EXTERNAL_NOTIFICATIONS';
const READY_FILE = 'CI_EXTERNAL_NOTIFICATION_GUARD_READY_FILE';
const ATTEMPT_FILE = 'CI_EXTERNAL_NOTIFICATION_ATTEMPT_FILE';

const appendSignal = (environmentKey, contents) => {
  const filePath = process.env[environmentKey];
  if (!filePath) {
    throw new Error(`${environmentKey} must be set when the CI notification guard is enabled.`);
  }
  fs.appendFileSync(filePath, contents, 'utf8');
};

const initializeExternalNotificationGuard = () => {
  if (process.env[GUARD_ENABLED] !== 'true') return;

  try {
    appendSignal(ATTEMPT_FILE, '');
    appendSignal(READY_FILE, 'CI_EXTERNAL_NOTIFICATION_GUARD_ACTIVE\n');
  } catch (cause) {
    const error = new Error('Could not initialize the CI external notification guard.', {
      cause,
    });
    error.code = 'CI_EXTERNAL_NOTIFICATION_GUARD_CONFIGURATION_ERROR';
    throw error;
  }
};

const sendExpoPush = async ({ payload, headers }) => {
  if (process.env[GUARD_ENABLED] === 'true') {
    const error = new Error('Expo Push is disabled during CI.');
    error.code = BLOCKED_CODE;

    try {
      appendSignal(ATTEMPT_FILE, `${BLOCKED_CODE}\n`);
    } catch (cause) {
      error.cause = cause;
    }

    throw error;
  }

  return fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
};

module.exports = {
  BLOCKED_CODE,
  initializeExternalNotificationGuard,
  sendExpoPush,
};
