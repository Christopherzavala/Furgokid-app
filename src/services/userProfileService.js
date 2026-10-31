import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { db, functions } from '../config/firebase';

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_POLL_INTERVAL_MS = 150;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * Waits until the backend-provisioned profile can be read. The blocking Auth
 * trigger normally commits the profile before the Auth client resolves, but
 * this bounded retry also tolerates transient client-side read failures.
 */
export const waitForUserProfile = async (
  uid,
  { timeoutMs = DEFAULT_TIMEOUT_MS, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS } = {}
) => {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() <= deadline) {
    try {
      const snapshot = await getDoc(doc(db, 'users', uid));
      if (snapshot.exists()) return snapshot.data();
      lastError = null;
    } catch (error) {
      lastError = error;
    }
    await wait(pollIntervalMs);
  }

  if (lastError) {
    throw new Error('The user profile is temporarily unavailable.');
  }
  throw new Error('The user profile could not be provisioned.');
};

/**
 * Recovery path for an authenticated account whose trusted profile is absent.
 * The callable only creates safe defaults for the caller's own UID.
 */
export const ensureUserProfile = async (uid) => {
  const ensureCallable = httpsCallable(functions, 'ensureUserProfile');
  await ensureCallable();
  return waitForUserProfile(uid);
};

export default {
  ensureUserProfile,
  waitForUserProfile,
};
