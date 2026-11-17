import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { addBreadcrumb, captureException, captureMessage } from '../../config/sentry';
import logger from '../logger';
import secureStorage from '../secureStorage';

jest.mock('../../config/sentry', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

const pii = [
  'PII_TEST_PARENT_NAME_B4',
  'pii-test-parent-b4@example.invalid',
  'PII_TEST_CHILD_NAME_B4',
  'PII_TEST_CONSENT_PAYLOAD_B4',
  'PII_TEST_ERROR_STACK_B4',
  'PII_TEST_ERROR_CAUSE_B4',
  'PII_TEST_STORAGE_ID_B4',
];

const loggerConfig = (logger as any).config;
const loggerSpies: Record<string, jest.SpyInstance> = {};
const consoleSpies: jest.SpyInstance[] = [];
let fetchSpy: jest.SpyInstance;

const makePiiError = () => {
  const error = new Error(pii[1]);
  error.stack = pii[4];
  Object.assign(error, {
    cause: new Error(pii[5]),
    parentName: pii[0],
    childName: pii[2],
    consentPayload: pii[3],
    storageId: pii[6],
  });
  return error;
};

const serializedDiagnostics = () =>
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
          cause: (value as Error & { cause?: unknown }).cause,
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
  const diagnostics = serializedDiagnostics();
  for (const value of pii) expect(diagnostics).not.toContain(value);
  expect(addBreadcrumb).not.toHaveBeenCalled();
  expect(captureException).not.toHaveBeenCalled();
  expect(captureMessage).not.toHaveBeenCalled();
  expect(fetchSpy).not.toHaveBeenCalled();
};

describe('secureStorage.removeItem parental consent diagnostics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loggerConfig.enableConsole = true;
    loggerConfig.enableSentry = true;
    loggerConfig.enableRemote = true;
    loggerConfig.remoteEndpoint = 'https://example.invalid/log';
    fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({} as Response);
    logger.setUserId(pii[0]);
    logger.setCorrelationId(pii[6]);

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

  it('removes from SecureStore and keeps the existing cleanup behavior', async () => {
    await expect(secureStorage.removeItem('parental_consent')).resolves.toBeUndefined();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('__secure_store_test__');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('parental_consent');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('parental_consent');
    expectNoPiiInDiagnostics();
  });

  it('enforces fail-closed behavior when the SecureStore probe fails on removeItem', async () => {
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(makePiiError());

    await expect(secureStorage.removeItem('parental_consent')).resolves.toBeUndefined();

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('parental_consent');
    expect(loggerSpies.privacySafeWarn).toHaveBeenCalledWith(
      'SecureStore not available, sensitive operation blocked (fail-closed)',
      {
        operation: 'secure_storage_remove',
        stage: 'availability_check',
        code: 'SECURE_STORE_UNAVAILABLE',
      }
    );
    expectNoPiiInDiagnostics();
  });

  it('logs safely and rethrows the original SecureStore deletion failure', async () => {
    const failure = makePiiError();
    (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'parental_consent') throw failure;
    });

    await expect(secureStorage.removeItem('parental_consent')).rejects.toBe(failure);

    expect(loggerSpies.privacySafeError).toHaveBeenCalledWith(
      'Failed to remove item from secure storage',
      {
        operation: 'secure_storage_remove',
        stage: 'delete',
        code: 'SECURE_STORAGE_REMOVE_FAILED',
      }
    );
    expectNoPiiInDiagnostics();
  });

  it('safely handles AsyncStorage removal errors during fallback cleanup without rethrowing', async () => {
    const failure = makePiiError();
    (SecureStore.setItemAsync as jest.Mock).mockRejectedValue(makePiiError());
    (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(failure);

    await expect(secureStorage.removeItem('parental_consent')).resolves.toBeUndefined();
    expectNoPiiInDiagnostics();
  });

  it('preserves repeated-removal behavior', async () => {
    await expect(secureStorage.removeItem('parental_consent')).resolves.toBeUndefined();
    await expect(secureStorage.removeItem('parental_consent')).resolves.toBeUndefined();

    expect(
      (SecureStore.deleteItemAsync as jest.Mock).mock.calls.filter(
        ([key]: [string]) => key === 'parental_consent'
      )
    ).toHaveLength(2);
    expectNoPiiInDiagnostics();
  });
});
