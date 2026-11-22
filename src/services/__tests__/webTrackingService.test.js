const mockHttpsCallable = jest.fn();

jest.mock('firebase/functions', () => ({
  httpsCallable: (functions, name) => {
    mockHttpsCallable.mockImplementation(async (data) => ({
      data: {
        success: true,
        shareToken: 'token-123',
        shareUrl: 'https://example.com/tracking.html?token=token-123',
        name,
        data,
      },
    }));
    return mockHttpsCallable;
  },
}));

jest.mock('../../config/firebase', () => ({
  auth: { currentUser: { uid: 'user-1' } },
  functions: {},
}));

import {
  buildWhatsAppShareUrl,
  createTrackingShareLink,
  fetchSharedTrackingSnapshot,
  revokeTrackingShareLink,
} from '../webTrackingService';

describe('webTrackingService unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('buildWhatsAppShareUrl generates correct wa.me link with encoded text', () => {
    const url = buildWhatsAppShareUrl({
      shareUrl: 'https://example.com/tracking.html?token=abc',
      schoolOrZone: 'Colegio San Pedro',
      status: 'En Vivo',
    });
    expect(url).toContain('https://wa.me/?text=');
    expect(url).toContain('Colegio%20San%20Pedro');
    expect(url).toContain('https%3A%2F%2Fexample.com%2Ftracking.html%3Ftoken%3Dabc');
  });

  test('createTrackingShareLink calls createTrackingShareLink callable', async () => {
    const res = await createTrackingShareLink({ matchId: 'match-1', expiresInHours: 24 });
    expect(res.name).toBe('createTrackingShareLink');
    expect(res.data).toEqual({ matchId: 'match-1', expiresInHours: 24, label: undefined });
  });

  test('revokeTrackingShareLink calls revokeTrackingShareLink callable', async () => {
    const res = await revokeTrackingShareLink({ shareToken: 'token-123' });
    expect(res.name).toBe('revokeTrackingShareLink');
    expect(res.data).toEqual({ shareToken: 'token-123' });
  });

  test('fetchSharedTrackingSnapshot calls getSharedTrackingSnapshot callable', async () => {
    const res = await fetchSharedTrackingSnapshot('token-123');
    expect(res.name).toBe('getSharedTrackingSnapshot');
  });
});
