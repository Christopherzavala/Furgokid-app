import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';
import { addBreadcrumb, captureException, captureMessage } from '../../config/sentry';
import logger from '../../utils/logger';
import secureStorage from '../../utils/secureStorage';
import ParentalConsentScreen from '../ParentalConsentScreen';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../../config/sentry', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

const fakePii = [
  'PII_TEST_PARENT_NAME_63817',
  'pii-test-parent-63817@example.invalid',
  'PII_TEST_CHILD_NAME_63817',
  '2014-05-17',
  'PII_TEST_AGE_63817',
  'PII_TEST_CONSENT_PAYLOAD_63817',
  'PII_TEST_STORAGE_ID_63817',
  'PII_TEST_ERROR_STACK_63817',
];

const fakeB3Pii = [
  'PII_TEST_PARENT_NAME_B3',
  'pii-test-parent-b3@example.invalid',
  'PII_TEST_CHILD_NAME_B3',
  'PII_TEST_BIRTHDATE_B3_2014-05-17',
  'PII_TEST_AGE_B3_12',
  'PII_TEST_CONSENT_PAYLOAD_B3',
];

const loggerConfig = (logger as any).config;
const loggerSpies: Record<string, jest.SpyInstance> = {};
const consoleSpies: jest.SpyInstance[] = [];
let fetchSpy: jest.SpyInstance;

const makeErrorWithPii = () => {
  const error = new Error(fakePii[1]);
  error.stack = fakePii[7];
  Object.assign(error, {
    parentName: fakePii[0],
    childName: fakePii[2],
    consentPayload: fakePii[5],
    storageId: fakePii[6],
  });
  return error;
};

const serializedDiagnosticCalls = () =>
  JSON.stringify(
    {
      logger: Object.values(loggerSpies).map((spy) => spy.mock.calls),
      console: consoleSpies.map((spy) => spy.mock.calls),
      sentry: {
        breadcrumbs: (addBreadcrumb as jest.Mock).mock.calls,
        exceptions: (captureException as jest.Mock).mock.calls,
        messages: (captureMessage as jest.Mock).mock.calls,
      },
    },
    (_key, value) => {
      if (value instanceof Error) {
        return {
          message: value.message,
          stack: value.stack,
          parentName: (value as Error & { parentName?: unknown }).parentName,
          childName: (value as Error & { childName?: unknown }).childName,
          consentPayload: (value as Error & { consentPayload?: unknown }).consentPayload,
          storageId: (value as Error & { storageId?: unknown }).storageId,
        };
      }
      return value;
    }
  );

const expectNoPiiInDiagnostics = () => {
  const diagnostics = serializedDiagnosticCalls();
  for (const value of fakePii) expect(diagnostics).not.toContain(value);
  for (const value of fakeB3Pii) expect(diagnostics).not.toContain(value);
  expect(addBreadcrumb).not.toHaveBeenCalled();
  expect(captureException).not.toHaveBeenCalled();
  expect(captureMessage).not.toHaveBeenCalled();
  expect(fetchSpy).not.toHaveBeenCalled();
};

const submitValidConsent = async () => {
  const { getByPlaceholderText, getByText } = render(
    <ParentalConsentScreen
      route={{ params: { userRole: 'parent', childAge: '12' } } as any}
      navigation={{ navigate: jest.fn(), goBack: jest.fn() } as any}
    />
  );
  fireEvent.changeText(getByPlaceholderText('Ej: María García'), fakePii[0]);
  fireEvent.changeText(getByPlaceholderText('Ej: maria@example.com'), fakePii[1]);
  fireEvent.changeText(getByPlaceholderText('Ej: Carlos García'), fakePii[2]);
  fireEvent.changeText(getByPlaceholderText('Ej: 2015-03-25'), fakePii[3]);
  fireEvent.press(getByText(/Acepto los/i));
  fireEvent.press(getByText(/Acepto la/i));
  fireEvent.press(getByText('Otorgar Consentimiento'));
};

describe('ParentalConsentScreen storage logging privacy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loggerConfig.enableConsole = true;
    loggerConfig.enableSentry = true;
    loggerConfig.enableRemote = true;
    loggerConfig.remoteEndpoint = 'https://example.invalid/log';
    fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({} as Response);
    logger.setUserId(fakePii[0]);
    logger.setCorrelationId(fakePii[6]);

    for (const method of [
      'debug',
      'info',
      'warn',
      'error',
      'privacySafeDebug',
      'privacySafeInfo',
      'privacySafeWarn',
      'privacySafeError',
    ]) {
      loggerSpies[method] = jest.spyOn(logger, method as keyof typeof logger);
    }
    const consoleMethods = ['debug', 'log', 'info', 'warn', 'error'] as const;
    for (const method of consoleMethods) {
      consoleSpies.push(jest.spyOn(console, method).mockImplementation(() => undefined));
    }

    (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('test');
    (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    Object.values(loggerSpies).forEach((spy) => spy.mockRestore());
    consoleSpies.splice(0).forEach((spy) => spy.mockRestore());
    fetchSpy.mockRestore();
    logger.clearUserId();
    logger.clearCorrelationId();
    loggerConfig.enableConsole = false;
    loggerConfig.enableSentry = false;
    loggerConfig.enableRemote = false;
    loggerConfig.remoteEndpoint = undefined;
  });

  it('stores valid consent in SecureStore without leaking PII to diagnostics', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await submitValidConsent();

    await waitFor(() =>
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'parental_consent',
        expect.stringContaining(fakePii[0]),
        undefined
      )
    );
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith('parental_consent', expect.anything());
    expectNoPiiInDiagnostics();
    alertSpy.mockRestore();
  });

  it('enforces fail-closed behavior and blocks AsyncStorage write fallback when SecureStore is unavailable', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(makeErrorWithPii());
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await submitValidConsent();

    await waitFor(() =>
      expect(serializedDiagnosticCalls()).toContain('SECURE_STORAGE_WRITE_FAILED')
    );
    expect(AsyncStorage.setItem).not.toHaveBeenCalledWith('parental_consent', expect.anything());
    expectNoPiiInDiagnostics();
    alertSpy.mockRestore();
  });

  it('propagates fallback failures without exposing nested or missing-message errors', async () => {
    const fallbackError = Object.assign(new Error(), {
      message: '',
      stack: fakePii[7],
      cause: makeErrorWithPii(),
      extra: fakePii[5],
    });
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(makeErrorWithPii());
    (AsyncStorage.setItem as jest.Mock).mockRejectedValue(fallbackError);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await submitValidConsent();

    await waitFor(() =>
      expect(serializedDiagnosticCalls()).toContain('SECURE_STORAGE_WRITE_FAILED')
    );
    expectNoPiiInDiagnostics();
    expect(loggerSpies.privacySafeError).toHaveBeenCalledWith(
      'Failed to store item in secure storage',
      {
        operation: 'secure_storage_set',
        stage: 'write',
        code: 'SECURE_STORAGE_WRITE_FAILED',
      }
    );
    alertSpy.mockRestore();
  });

  it('preserves existing error logging and propagation for unrelated storage callers', async () => {
    const failure = new Error('unrelated storage failure');
    (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key !== '__secure_store_test__') throw failure;
    });

    await expect(secureStorage.setItem('ordinary_profile', 'safe-value')).rejects.toBe(failure);
    expect(loggerSpies.error).toHaveBeenCalledWith(
      'Failed to store item in secure storage',
      { key: 'ordinary_profile' },
      failure
    );
    expect(captureException).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({ level: 'error' })
    );
  });

  it('reads parental consent without exposing a successful SecureStore value', async () => {
    const consent = {
      parentName: fakeB3Pii[0],
      parentEmail: fakeB3Pii[1],
      childName: fakeB3Pii[2],
      childDateOfBirth: fakeB3Pii[3],
      childAge: fakeB3Pii[4],
      payload: fakeB3Pii[5],
    };
    const serializedConsent = JSON.stringify(consent);
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) =>
      key === '__secure_store_test__' ? 'test' : serializedConsent
    );

    await expect(secureStorage.getObject('parental_consent')).resolves.toEqual(consent);
    expectNoPiiInDiagnostics();
  });

  it('returns null and sanitizes a SecureStore read error', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === '__secure_store_test__') return 'test';
      throw makeErrorWithPii();
    });

    await expect(secureStorage.getObject('parental_consent')).resolves.toBeNull();
    expectNoPiiInDiagnostics();
    expect(loggerSpies.privacySafeError).toHaveBeenCalledWith(
      'Failed to retrieve item from secure storage',
      {
        operation: 'secure_storage_read',
        stage: 'read',
        code: 'SECURE_STORAGE_READ_FAILED',
      }
    );
  });

  it('enforces fail-closed behavior on read when SecureStore is unavailable', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(makeErrorWithPii());
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify({ parentName: fakeB3Pii[0] })
    );

    await expect(secureStorage.getObject('parental_consent')).resolves.toBeNull();
    expectNoPiiInDiagnostics();
  });

  it('sanitizes fallback failures and invalid JSON while preserving null returns', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(makeErrorWithPii());
    (AsyncStorage.getItem as jest.Mock).mockRejectedValue(makeErrorWithPii());

    await expect(secureStorage.getObject('parental_consent')).resolves.toBeNull();
    expectNoPiiInDiagnostics();
  });
});
