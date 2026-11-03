/// <reference types="jest" />
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

const mockRequestAccountDeletion = jest.fn();
const mockGetAccountDeletionStatus = jest.fn();
const mockSignOutLocally = jest.fn();
const mockToastSuccess = jest.fn();

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-123' },
    signOutLocally: (...args: unknown[]) => mockSignOutLocally(...args),
  }),
}));

jest.mock('../../services/gdprService', () => ({
  exportUserData: jest.fn(),
  getUserDataSummary: jest.fn().mockResolvedValue(null),
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
});
