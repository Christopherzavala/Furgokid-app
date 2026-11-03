import { isAuthenticationUnavailableError } from './authError';

/**
 * Close the React-visible authentication session and ask the Firebase SDK to
 * revoke its local credentials.
 *
 * The two operations intentionally have separate outcomes: the app must leave
 * the authenticated stack even when the identity was already deleted, while
 * callers can still tell whether the SDK confirmed the sign-out.
 */
export const closeLocalAuthSession = async ({
  signOut,
  clearSession,
  allowAnySdkFailure = false,
}) => {
  // React state is the source of truth for this app's navigation. Clear it
  // before awaiting the SDK so a slow or failed sign-out cannot trap the user
  // in the authenticated stack.
  clearSession();

  let sdkError = null;
  try {
    await signOut();
  } catch (error) {
    sdkError = error;
  }

  const sdkFailureIsAcceptable =
    !sdkError || allowAnySdkFailure || isAuthenticationUnavailableError(sdkError);

  return {
    success: sdkFailureIsAcceptable,
    sdkSignOutConfirmed: !sdkError,
    sdkError: sdkError?.message,
  };
};

export default closeLocalAuthSession;
