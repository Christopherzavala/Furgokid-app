/**
 * Admin & Operations Console Service (Ola 2 - #14)
 *
 * Connects frontend AdminOpsScreen to backend operations callables:
 * getOpsDashboardSnapshot, reviewDriverRequest, resolveSosAlert.
 */

import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../config/firebase';

const assertAuthenticated = () => {
  if (!auth.currentUser) {
    const error = new Error('Authentication is required.');
    error.code = 'unauthenticated';
    throw error;
  }
};

export const fetchOpsDashboardSnapshot = async () => {
  assertAuthenticated();
  const getSnapshotFn = httpsCallable(functions, 'getOpsDashboardSnapshot');
  const result = await getSnapshotFn({});
  return result.data;
};

export const reviewDriverApplication = async ({ driverId, decision, reason }) => {
  assertAuthenticated();
  if (!driverId || !decision) {
    throw new Error('driverId and decision are required.');
  }
  const reviewFn = httpsCallable(functions, 'reviewDriverRequest');
  const result = await reviewFn({ targetUid: driverId, decision, reason });
  return result.data;
};

export const resolveEmergencyIncident = async ({ incidentId, resolutionNotes }) => {
  assertAuthenticated();
  if (!incidentId) {
    throw new Error('incidentId is required.');
  }
  const resolveFn = httpsCallable(functions, 'resolveSosAlert');
  const result = await resolveFn({ incidentId, resolutionNotes });
  return result.data;
};
