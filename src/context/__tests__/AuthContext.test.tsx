/// <reference types="jest" />
import React from 'react';
import { act, renderHook } from '@testing-library/react-native';

const mockFirebaseSignOut = jest.fn();
const mockCleanupDriverTracking = jest.fn();
const mockClearTrackingMatchId = jest.fn();
const mockStopBackgroundLocation = jest.fn();
const mockStopForegroundLocationTracking = jest.fn();

jest.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: jest.fn(),
  signOut: (...args: unknown[]) => mockFirebaseSignOut(...args),
  onAuthStateChanged: jest.fn((_auth, callback) => {
    callback(null);
    return jest.fn();
  }),
  reload: jest.fn(),
  sendEmailVerification: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  updateProfile: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  serverTimestamp: jest.fn(),
  updateDoc: jest.fn(),
}));

jest.mock('../../config/firebase', () => ({ auth: {}, db: {} }));
jest.mock('../../config/sentry', () => ({ setUserContext: jest.fn() }));
jest.mock('../../services/analyticsService', () => ({
  default: {
    setUserId: jest.fn(),
    trackUserRole: jest.fn(),
    trackUserSegment: jest.fn(),
    trackLogin: jest.fn(),
    trackSignUp: jest.fn(),
    trackPerformance: jest.fn(),
    trackAppError: jest.fn(),
  },
}));
jest.mock('../../services/notificationService', () => ({
  registerForPushNotifications: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../services/userProfileService', () => ({
  ensureUserProfile: jest.fn(),
  waitForUserProfile: jest.fn(),
}));
jest.mock('../../services/driverApprovalService', () => ({
  requestDriverApproval: jest.fn(),
}));
jest.mock('../../services/backgroundLocation', () => ({
  stopBackgroundLocation: (...args: unknown[]) => mockStopBackgroundLocation(...args),
}));
jest.mock('../../services/locationService', () => ({
  stopForegroundLocationTracking: (...args: unknown[]) =>
    mockStopForegroundLocationTracking(...args),
}));
jest.mock('../../services/matchTrackingService', () => ({
  cleanupDriverTracking: (...args: unknown[]) => mockCleanupDriverTracking(...args),
  clearTrackingMatchId: (...args: unknown[]) => mockClearTrackingMatchId(...args),
}));

import { AuthProvider, useAuth } from '../AuthContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthContext sign-out', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFirebaseSignOut.mockResolvedValue(undefined);
    mockCleanupDriverTracking.mockResolvedValue(undefined);
    mockClearTrackingMatchId.mockResolvedValue(undefined);
    mockStopBackgroundLocation.mockResolvedValue(undefined);
    mockStopForegroundLocationTracking.mockResolvedValue(undefined);
  });

  it('completes local logout when tracking cleanup can no longer authenticate', async () => {
    mockCleanupDriverTracking.mockRejectedValue({
      code: 'functions/unauthenticated',
      status: 401,
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    let outcome: Awaited<ReturnType<typeof result.current.signOut>> | undefined;

    await act(async () => {
      outcome = await result.current.signOut();
    });

    expect(outcome).toEqual({ success: true, sdkSignOutConfirmed: true });
    expect(mockClearTrackingMatchId).toHaveBeenCalledTimes(1);
    expect(mockFirebaseSignOut).toHaveBeenCalledTimes(1);
  });

  it('keeps the local session closed when the SDK identity was already deleted', async () => {
    mockFirebaseSignOut.mockRejectedValue({ code: 'auth/user-not-found' });
    const { result } = renderHook(() => useAuth(), { wrapper });
    let outcome: Awaited<ReturnType<typeof result.current.signOutLocally>> | undefined;

    await act(async () => {
      outcome = await result.current.signOutLocally();
    });

    expect(outcome).toEqual({
      success: true,
      sdkSignOutConfirmed: false,
      sdkError: undefined,
    });
    expect(mockClearTrackingMatchId).toHaveBeenCalledTimes(1);
    expect(mockFirebaseSignOut).toHaveBeenCalledTimes(1);
  });

  it('revokes the SDK session before running best-effort sensor cleanup', async () => {
    const callOrder: string[] = [];
    mockFirebaseSignOut.mockImplementation(async () => {
      callOrder.push('firebase-sign-out');
    });
    mockStopBackgroundLocation.mockImplementation(async () => {
      callOrder.push('stop-background-location');
    });
    mockClearTrackingMatchId.mockImplementation(async () => {
      callOrder.push('clear-tracking');
    });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signOutLocally();
    });

    expect(callOrder).toEqual(['firebase-sign-out', 'stop-background-location', 'clear-tracking']);
  });

  it('keeps the local session closed when any SDK failure occurs', async () => {
    mockFirebaseSignOut.mockRejectedValue(new Error('network unavailable'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    let outcome: Awaited<ReturnType<typeof result.current.signOutLocally>> | undefined;

    await act(async () => {
      outcome = await result.current.signOutLocally();
    });

    expect(outcome).toEqual({
      success: true,
      sdkSignOutConfirmed: false,
      sdkError: 'network unavailable',
    });
    expect(mockClearTrackingMatchId).toHaveBeenCalledTimes(1);
    expect(mockFirebaseSignOut).toHaveBeenCalledTimes(1);
  });

  it('reports a non-authentication SDK failure during normal logout', async () => {
    mockFirebaseSignOut.mockRejectedValue(new Error('network unavailable'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    let outcome: Awaited<ReturnType<typeof result.current.signOut>> | undefined;

    await act(async () => {
      outcome = await result.current.signOut();
    });

    expect(outcome?.success).toBe(false);
    expect(outcome?.error).toBe('network unavailable');
    expect(mockFirebaseSignOut).toHaveBeenCalledTimes(1);
  });

  it('does not sign out when cleanup fails for a non-authentication reason', async () => {
    mockCleanupDriverTracking.mockRejectedValue(new Error('network unavailable'));
    const { result } = renderHook(() => useAuth(), { wrapper });
    let outcome: Awaited<ReturnType<typeof result.current.signOut>> | undefined;

    await act(async () => {
      outcome = await result.current.signOut();
    });

    expect(outcome?.success).toBe(false);
    expect(mockFirebaseSignOut).not.toHaveBeenCalled();
  });
});
