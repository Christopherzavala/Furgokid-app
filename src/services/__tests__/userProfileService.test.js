const mockDoc = jest.fn(() => ({ path: 'users/test-user' }));
const mockGetDoc = jest.fn();
const mockHttpsCallable = jest.fn();

jest.mock('firebase/firestore', () => ({
  doc: (...args) => mockDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
}));

jest.mock('firebase/functions', () => ({
  httpsCallable: (...args) => mockHttpsCallable(...args),
}));

jest.mock('../../config/firebase', () => ({
  db: { name: 'db' },
  functions: { name: 'functions' },
}));

import { ensureUserProfile, waitForUserProfile } from '../userProfileService';

describe('user profile service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('waits until the trusted profile is readable', async () => {
    mockGetDoc
      .mockResolvedValueOnce({ exists: () => false })
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ role: 'parent' }) });

    await expect(
      waitForUserProfile('test-user', { timeoutMs: 100, pollIntervalMs: 1 })
    ).resolves.toEqual({ role: 'parent' });
    expect(mockGetDoc).toHaveBeenCalledTimes(2);
  });

  test('uses the authenticated recovery callable before reading again', async () => {
    const callable = jest.fn().mockResolvedValue({ data: { created: true } });
    mockHttpsCallable.mockReturnValue(callable);
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ role: 'parent' }) });

    await expect(ensureUserProfile('test-user')).resolves.toEqual({ role: 'parent' });
    expect(mockHttpsCallable).toHaveBeenCalledWith({ name: 'functions' }, 'ensureUserProfile');
    expect(callable).toHaveBeenCalledTimes(1);
  });
});
