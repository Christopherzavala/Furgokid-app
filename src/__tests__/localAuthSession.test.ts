import { closeLocalAuthSession } from '../utils/localAuthSession';

describe('closeLocalAuthSession', () => {
  it('clears the local session and confirms the SDK sign-out', async () => {
    const clearSession = jest.fn();
    const signOut = jest.fn().mockResolvedValue(undefined);

    const result = await closeLocalAuthSession({ signOut, clearSession });

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      success: true,
      sdkSignOutConfirmed: true,
      sdkError: undefined,
    });
  });

  it('reports a non-authentication SDK failure for a normal logout', async () => {
    const clearSession = jest.fn();
    const signOut = jest.fn().mockRejectedValue(new Error('network unavailable'));

    const result = await closeLocalAuthSession({ signOut, clearSession });

    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      success: false,
      sdkSignOutConfirmed: false,
      sdkError: 'network unavailable',
    });
  });

  it('allows any SDK failure when the local closure is mandatory', async () => {
    const clearSession = jest.fn();
    const signOut = jest.fn().mockRejectedValue(new Error('user not found'));

    const result = await closeLocalAuthSession({
      signOut,
      clearSession,
      allowAnySdkFailure: true,
    });

    expect(clearSession).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      success: true,
      sdkSignOutConfirmed: false,
      sdkError: 'user not found',
    });
  });

  it('clears the local session before waiting for the SDK sign-out', async () => {
    const callOrder: string[] = [];
    const clearSession = jest.fn(() => callOrder.push('clear'));
    const signOut = jest.fn(async () => {
      callOrder.push('sign-out');
    });

    await closeLocalAuthSession({ signOut, clearSession });

    expect(callOrder).toEqual(['clear', 'sign-out']);
  });
});
