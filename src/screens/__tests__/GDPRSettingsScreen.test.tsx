/// <reference types="jest" />
import React from 'react';
import { Alert, Share } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

const mockRequestAccountDeletion = jest.fn();
const mockGetAccountDeletionStatus = jest.fn();
const mockGetUserDataSummary = jest.fn().mockResolvedValue(null);
const mockExportUserData = jest.fn();
const mockSignOutLocally = jest.fn();
const mockToastSuccess = jest.fn();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-123' },
    signOutLocally: (...args: unknown[]) => mockSignOutLocally(...args),
  }),
}));

jest.mock('../../services/gdprService', () => ({
  exportUserData: (...args: unknown[]) => mockExportUserData(...args),
  getUserDataSummary: (...args: unknown[]) => mockGetUserDataSummary(...args),
  getAccountDeletionStatus: (...args: unknown[]) => mockGetAccountDeletionStatus(...args),
  requestAccountDeletion: (...args: unknown[]) => mockRequestAccountDeletion(...args),
  isAccountDeletionAuthenticationError: (error: { code?: string; status?: number }) =>
    error?.status === 401 || error?.code === 'functions/unauthenticated',
}));

jest.mock('../../services/toastService', () => ({
  __esModule: true,
  default: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    privacySafeDebug: jest.fn(),
    privacySafeInfo: jest.fn(),
    privacySafeWarn: jest.fn(),
    privacySafeError: jest.fn(),
  },
}));

jest.mock('@expo/vector-icons', () => {
  const ReactModule = require('react');
  const { Text } = require('react-native');
  return {
    Ionicons: (props: { name: string }) => ReactModule.createElement(Text, null, props.name),
  };
});

import GDPRSettingsScreen from '../GDPRSettingsScreen';

const mockLogger = jest.requireMock('../../utils/logger').default;

const navigation = {
  navigate: jest.fn(),
};

const confirmDeletion = async () => {
  fireEvent.press(screen.getByText('Derecho al Olvido'));

  const firstAlert = jest.mocked(Alert.alert).mock.calls[0];
  const firstConfirmation = firstAlert?.[2]?.find((button) => button.text === 'Eliminar Mi Cuenta');
  await act(async () => {
    await firstConfirmation?.onPress?.();
  });

  const secondAlert = jest.mocked(Alert.alert).mock.calls[1];
  const secondConfirmation = secondAlert?.[2]?.find((button) => button.text === 'ELIMINAR');
  await act(async () => {
    await secondConfirmation?.onPress?.();
  });
};

describe('GDPRSettingsScreen account deletion', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockSignOutLocally.mockResolvedValue({ success: true });
    mockGetUserDataSummary.mockResolvedValue(null);
    mockExportUserData.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
    alertSpy.mockRestore();
  });

  it('closes the local session without claiming deletion started on initial 401', async () => {
    mockRequestAccountDeletion.mockRejectedValue({
      code: 'functions/unauthenticated',
      status: 401,
    });
    render(<GDPRSettingsScreen navigation={navigation} />);

    await confirmDeletion();

    expect(mockSignOutLocally).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Sesión cerrada',
      expect.stringContaining('No se pudo confirmar el inicio de la eliminación')
    );
    expect(mockToastSuccess).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('continuará en segundo plano')
    );
  });

  it('closes the local session when polling can no longer authenticate', async () => {
    mockRequestAccountDeletion.mockResolvedValue({
      status: 'pending',
      phase: 'matches',
      errorCode: null,
      updatedAt: null,
    });
    mockGetAccountDeletionStatus.mockRejectedValue({
      code: 'functions/unauthenticated',
      status: 401,
    });
    render(<GDPRSettingsScreen navigation={navigation} />);

    await confirmDeletion();
    expect(mockSignOutLocally).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(15000);
      await Promise.resolve();
    });

    expect(mockGetAccountDeletionStatus).toHaveBeenCalledTimes(1);
    expect(mockSignOutLocally).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Sesión cerrada',
      expect.stringContaining('continuará en segundo plano')
    );
  });

  it('closes the local session once when deletion reaches completed', async () => {
    mockRequestAccountDeletion.mockResolvedValue({
      status: 'completed',
      phase: null,
      errorCode: null,
      updatedAt: null,
    });
    render(<GDPRSettingsScreen navigation={navigation} />);

    await confirmDeletion();

    expect(mockSignOutLocally).toHaveBeenCalledTimes(1);
    expect(mockToastSuccess).toHaveBeenCalledWith(
      'Cuenta eliminada',
      'Tu cuenta y todos tus datos han sido eliminados permanentemente.'
    );
  });

  it('logs summary failures without passing the original PII-bearing exception', async () => {
    const error = new Error('PII_TEST_SUMMARY_EXCEPTION_B3');
    error.stack = 'PII_TEST_SUMMARY_STACK_B3';
    mockGetUserDataSummary.mockRejectedValue(error);
    render(<GDPRSettingsScreen navigation={navigation} />);
    fireEvent.press(screen.getByText('Cargar Resumen'));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockLogger.privacySafeError).toHaveBeenCalledWith('Failed to load data summary', {
      operation: 'gdpr_summary',
      stage: 'screen',
      code: 'GDPR_SUMMARY_DISPLAY_FAILED',
    });
    const logged = JSON.stringify([
      mockLogger.info.mock.calls,
      mockLogger.warn.mock.calls,
      mockLogger.error.mock.calls,
      mockLogger.privacySafeInfo.mock.calls,
      mockLogger.privacySafeWarn.mock.calls,
      mockLogger.privacySafeError.mock.calls,
    ]);
    expect(logged).not.toContain(error.message);
    expect(logged).not.toContain(error.stack);
  });

  it('logs export failures without PII while keeping the user-facing error path', async () => {
    const error = new Error('PII_TEST_EXPORT_EXCEPTION_B3');
    error.stack = 'PII_TEST_EXPORT_STACK_B3';
    mockExportUserData.mockRejectedValue(error);
    render(<GDPRSettingsScreen navigation={navigation} />);

    fireEvent.press(screen.getByText('Derecho a la Portabilidad'));
    const confirmation = jest
      .mocked(Alert.alert)
      .mock.calls[0]?.[2]?.find((button) => button.text === 'Exportar');
    await act(async () => {
      await confirmation?.onPress?.();
    });

    expect(mockLogger.privacySafeError).toHaveBeenCalledWith('Failed to export user data', {
      operation: 'gdpr_export',
      stage: 'screen',
      code: 'GDPR_EXPORT_DISPLAY_FAILED',
    });
    const logged = JSON.stringify([
      mockLogger.info.mock.calls,
      mockLogger.warn.mock.calls,
      mockLogger.error.mock.calls,
      mockLogger.privacySafeInfo.mock.calls,
      mockLogger.privacySafeWarn.mock.calls,
      mockLogger.privacySafeError.mock.calls,
    ]);
    expect(logged).not.toContain(error.message);
    expect(logged).not.toContain(error.stack);
  });

  it('includes consent in the intended export payload but not in logs when sharing fails', async () => {
    const consent = {
      parentName: 'PII_TEST_PARENT_NAME_B3',
      parentEmail: 'pii-test-parent-b3@example.invalid',
      childName: 'PII_TEST_CHILD_NAME_B3',
      childDateOfBirth: 'PII_TEST_BIRTHDATE_B3_2014-05-17',
      childAge: 'PII_TEST_AGE_B3_12',
      evidence: 'PII_TEST_CONSENT_PAYLOAD_B3',
    };
    mockExportUserData.mockResolvedValue({
      profile: null,
      routes: [],
      requests: [],
      trackingHistory: [],
      vacancies: [],
      consent,
      preferences: null,
    });
    const shareError = new Error('PII_TEST_SHARE_EXCEPTION_B3');
    shareError.stack = 'PII_TEST_SHARE_STACK_B3';
    const shareSpy = jest.spyOn(Share, 'share').mockRejectedValue(shareError);
    render(<GDPRSettingsScreen navigation={navigation} />);

    fireEvent.press(screen.getByText('Derecho a la Portabilidad'));
    const confirmation = jest
      .mocked(Alert.alert)
      .mock.calls[0]?.[2]?.find((button) => button.text === 'Exportar');
    await act(async () => {
      await confirmation?.onPress?.();
    });

    const sharePayload = jest.mocked(Share.share).mock.calls[0]?.[0]?.message;
    expect(sharePayload).toContain(consent.parentName);
    expect(sharePayload).toContain(consent.parentEmail);
    expect(sharePayload).toContain(consent.childName);
    expect(sharePayload).toContain(consent.childDateOfBirth);
    expect(sharePayload).toContain(consent.evidence);
    expect(mockLogger.privacySafeError).toHaveBeenCalledWith('Failed to export user data', {
      operation: 'gdpr_export',
      stage: 'screen',
      code: 'GDPR_EXPORT_DISPLAY_FAILED',
    });
    const logged = JSON.stringify([
      mockLogger.info.mock.calls,
      mockLogger.warn.mock.calls,
      mockLogger.error.mock.calls,
      mockLogger.privacySafeInfo.mock.calls,
      mockLogger.privacySafeWarn.mock.calls,
      mockLogger.privacySafeError.mock.calls,
    ]);
    for (const value of [...Object.values(consent), shareError.message, shareError.stack]) {
      expect(logged).not.toContain(String(value));
    }
    shareSpy.mockRestore();
  });
});
