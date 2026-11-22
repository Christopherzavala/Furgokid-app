/**
 * Web Tracking & WhatsApp Shortcut Service (Ola 4 - #7 & #8)
 *
 * Provides temporary live-tracking link generation, token revocation, snapshot fetching,
 * and zero-cost WhatsApp share URL construction via wa.me link shortcuts.
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

export function buildWhatsAppShareUrl({ shareUrl, schoolOrZone, status } = {}) {
  const url = shareUrl || 'https://furgokid-staging.web.app/tracking.html';
  const zone = schoolOrZone || 'Transporte Escolar';
  const currentStatus = status || 'En Ruta';
  const text = `🚌 *FurgoKid - Seguimiento en Vivo*\n\nSigue el recorrido de la furgoneta (${zone} - ${currentStatus}) en tiempo real sin instalar la app:\n\n👉 ${url}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export const createTrackingShareLink = async ({ matchId, expiresInHours = 24, label } = {}) => {
  assertAuthenticated();
  if (!matchId) {
    throw new Error('matchId is required to create a tracking share link.');
  }
  const fn = httpsCallable(functions, 'createTrackingShareLink');
  const result = await fn({ matchId, expiresInHours, label });
  return result.data;
};

export const revokeTrackingShareLink = async ({ shareToken } = {}) => {
  assertAuthenticated();
  if (!shareToken) {
    throw new Error('shareToken is required to revoke a tracking share link.');
  }
  const fn = httpsCallable(functions, 'revokeTrackingShareLink');
  const result = await fn({ shareToken });
  return result.data;
};

export const fetchSharedTrackingSnapshot = async (shareToken) => {
  if (!shareToken) {
    throw new Error('shareToken is required to fetch shared tracking snapshot.');
  }
  const fn = httpsCallable(functions, 'getSharedTrackingSnapshot');
  const result = await fn({ shareToken });
  return result.data;
};
