import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import PassengerAuthorizationScreen from '../PassengerAuthorizationScreen';
import { useAuth } from '../../context/AuthContext';
import passengerAuthorizationService, {
  PassengerAuthorizationError,
} from '../../services/passengerAuthorizationService';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('firebase/app', () => ({ getApp: () => ({ options: { projectId: 'demo-furgokid' } }) }));
jest.mock('../../context/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: { uid: 'adult-synthetic' },
    userProfile: { role: 'parent' },
    loading: false,
  })),
}));
jest.mock('../../services/passengerAuthorizationService', () => ({
  __esModule: true,
  PassengerAuthorizationError: class PassengerAuthorizationError extends Error {
    code: string;
    kind: string;
    constructor(code: string, kind: string) {
      super('opaque');
      this.code = code;
      this.kind = kind;
    }
  },
  default: {
    getPassengers: jest.fn(),
    getPendingOperations: jest.fn(),
    onboardPassenger: jest.fn(),
    revokePassengerAuthorization: jest.fn(),
  },
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const service = passengerAuthorizationService as jest.Mocked<typeof passengerAuthorizationService>;
const navigation = { goBack: jest.fn(), addListener: jest.fn(() => jest.fn()) };
const existingPassenger = {
  passengerId: 'passenger-existing',
  passengerAlias: 'Alias sintético',
  status: 'active' as const,
  authorization: {
    passengerId: 'passenger-existing',
    authorizationId: 'authorization-existing',
    status: 'active' as const,
    responsibilityDeclared: true,
    privacyNoticeAccepted: true,
  },
};

const openScreen = async () => {
  const screen = render(<PassengerAuthorizationScreen navigation={navigation} />);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return screen;
};
const acceptDeclarations = (screen: Awaited<ReturnType<typeof openScreen>>) => {
  fireEvent.press(screen.getAllByRole('checkbox')[0]);
  fireEvent.press(screen.getAllByRole('checkbox')[1]);
};

describe('PassengerAuthorizationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: { uid: 'adult-synthetic' },
      userProfile: { role: 'parent' },
      loading: false,
    });
    service.getPassengers.mockResolvedValue([]);
    service.getPendingOperations.mockResolvedValue([]);
    service.onboardPassenger.mockResolvedValue({
      operationId: 'request-synthetic',
      result: { ...existingPassenger.authorization },
    } as any);
    service.revokePassengerAuthorization.mockResolvedValue({
      ...existingPassenger.authorization,
      status: 'revoked',
    } as any);
  });

  it('shows server-fetched status and explains that active is only a technical state', async () => {
    service.getPassengers.mockResolvedValue([existingPassenger] as any);
    const screen = await openScreen();
    expect(await screen.findByText('Activo en el registro técnico')).toBeTruthy();
    expect(
      screen.getByText('Estado técnico; no acredita identidad ni representación legal.')
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Revocar autorización' })).toBeTruthy();
  });

  it.each([
    ['pending', 'Pendiente'],
    ['revoked', 'Revocado'],
    ['expired', 'Vencido'],
    ['rejected', 'Rechazado'],
    ['unknown', 'No verificable'],
  ] as const)('shows the server status %s without offering revocation', async (status, label) => {
    service.getPassengers.mockResolvedValue([
      {
        ...existingPassenger,
        status,
        authorization: { ...existingPassenger.authorization, status },
      },
    ] as any);
    const screen = await openScreen();
    expect(await screen.findByText(label)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Revocar autorización' })).toBeNull();
  });

  it('does not call the service when the account is unauthenticated', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, userProfile: null, loading: false });
    const screen = await openScreen();
    expect(
      await screen.findByText(
        'Esta función requiere una sesión autenticada con perfil de padre o madre.'
      )
    ).toBeTruthy();
    expect(service.getPassengers).not.toHaveBeenCalled();
    expect(service.onboardPassenger).not.toHaveBeenCalled();
  });

  it('sends the established contract and displays only the confirmed server result', async () => {
    const screen = await openScreen();
    fireEvent.changeText(screen.getByLabelText('Alias del pasajero'), 'Alias de prueba');
    acceptDeclarations(screen);
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Enviar solicitud de prueba' }));
      await waitFor(() => expect(service.onboardPassenger).toHaveBeenCalledTimes(1));
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(service.onboardPassenger).toHaveBeenCalledWith(
        expect.objectContaining({
          passengerId: expect.stringMatching(/^passenger_/),
          passengerAlias: 'Alias de prueba',
          purpose: 'school_transport',
          privacyNoticeVersion: 'privacy-v1',
          authorizationTextVersion: 'authorization-v1',
          responsibilityDeclared: true,
          privacyNoticeAccepted: true,
        }),
        undefined
      );
    });
    expect(screen.getByText(/Respuesta verificada desde el servidor/)).toBeTruthy();
  });

  it('displays multiple pending operations and allows selecting a specific one to retry', async () => {
    service.getPendingOperations.mockResolvedValue([
      { requestId: 'req-1', passengerId: 'passenger-1' },
      { requestId: 'req-2', passengerId: 'passenger-2' },
    ] as any);
    const screen = await openScreen();
    expect(await screen.findByText('Operaciones pendientes (2)')).toBeTruthy();
    expect(screen.getByText('ID: req-1')).toBeTruthy();
    expect(screen.getByText('ID: req-2')).toBeTruthy();

    fireEvent.press(screen.getByText('ID: req-2'));
    expect(screen.getByText(/Operación pendiente seleccionada/)).toBeTruthy();
  });

  it('retains the same passenger operation after an unknown response and retries without a new key', async () => {
    service.onboardPassenger
      .mockRejectedValueOnce(new PassengerAuthorizationError('functions/unavailable', 'unknown'))
      .mockResolvedValueOnce({
        operationId: 'request-stable',
        result: { ...existingPassenger.authorization },
      } as any);
    service.getPendingOperations.mockResolvedValue([
      { requestId: 'request-stable', passengerId: 'passenger-pending' },
    ] as any);
    const screen = await openScreen();
    await waitFor(() => expect(service.getPendingOperations).toHaveBeenCalled());
    fireEvent.changeText(screen.getByLabelText('Alias del pasajero'), 'Mismo alias');
    acceptDeclarations(screen);
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Reintentar verificación' }));
      await waitFor(() => expect(service.onboardPassenger).toHaveBeenCalledTimes(1));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.getByText(/No conocemos el resultado/)).toBeTruthy();
    const firstPassengerId = (service.onboardPassenger.mock.calls[0][0] as any).passengerId;

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Reintentar verificación' }));
      await waitFor(() => expect(service.onboardPassenger).toHaveBeenCalledTimes(2));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(service.onboardPassenger).toHaveBeenCalledTimes(2);
    expect((service.onboardPassenger.mock.calls[1][0] as any).passengerId).toBe(firstPassengerId);
    expect(service.onboardPassenger.mock.calls[1][1]).toBe('request-stable');
  });

  it('confirms revocation through the service and refreshes persisted state', async () => {
    service.getPassengers.mockResolvedValue([existingPassenger] as any);
    let revokeOperation: (() => void | Promise<void>) | undefined;
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      revokeOperation = buttons?.find((button) => button.text === 'Revocar')?.onPress;
    });
    const screen = await openScreen();
    fireEvent.press(await screen.findByRole('button', { name: 'Revocar autorización' }));
    await act(async () => {
      await revokeOperation?.();
      await waitFor(() =>
        expect(service.revokePassengerAuthorization).toHaveBeenCalledWith(
          'passenger-existing',
          'authorization-existing'
        )
      );
    });
    expect(service.getPassengers).toHaveBeenCalledTimes(2);
    alert.mockRestore();
  });

  it('represents a failed server read as unverifiable and never as active', async () => {
    service.getPassengers.mockRejectedValue(new Error('synthetic network marker'));
    const screen = await openScreen();
    expect(await screen.findByText(/estado queda desconocido/)).toBeTruthy();
    expect(screen.queryByText('Activo en el registro técnico')).toBeNull();
  });
});
