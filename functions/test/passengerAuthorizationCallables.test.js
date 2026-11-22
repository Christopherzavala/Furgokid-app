const { createPassengerAuthorizationCallables } = require('../src/passengerAuthorizationCallables');
const { HttpsError } = require('firebase-functions/v2/https');

describe('passengerAuthorizationCallables', () => {
  let callables;
  let mockManager;

  beforeEach(() => {
    mockManager = {
      createPassengerWithDeclaration: jest.fn(async (data) => ({ success: true, ...data })),
      updateAuthorizationStatus: jest.fn(async (data) => ({ updated: true, ...data })),
    };
    callables = createPassengerAuthorizationCallables({ manager: mockManager });
  });

  test('onboardPassengerCallable requires authentication', async () => {
    await expect(callables.onboardPassengerCallable({ auth: null, data: {} })).rejects.toThrow(
      HttpsError
    );
  });

  test('onboardPassengerCallable succeeds with valid auth and data', async () => {
    const res = await callables.onboardPassengerCallable({
      auth: { uid: 'parent-1' },
      data: {
        passengerId: 'p1',
        requestId: 'r1',
        passengerAlias: 'Test',
        purpose: 'school',
        privacyNoticeVersion: '1',
        authorizationTextVersion: '1',
        responsibilityDeclared: true,
        privacyNoticeAccepted: true,
      },
    });
    expect(res).toMatchObject({ success: true, adultUid: 'parent-1', passengerId: 'p1' });
  });

  test('updatePassengerAuthorizationStatusCallable requires authentication', async () => {
    await expect(
      callables.updatePassengerAuthorizationStatusCallable({ auth: null, data: {} })
    ).rejects.toThrow(HttpsError);
  });

  test('updatePassengerAuthorizationStatusCallable rejects non-revoked status', async () => {
    await expect(
      callables.updatePassengerAuthorizationStatusCallable({
        auth: { uid: 'parent-1' },
        data: { passengerId: 'p1', authorizationId: 'a1', newStatus: 'active' },
      })
    ).rejects.toThrow(HttpsError);
  });

  test('updatePassengerAuthorizationStatusCallable rejects invalid document IDs', async () => {
    await expect(
      callables.updatePassengerAuthorizationStatusCallable({
        auth: { uid: 'parent-1' },
        data: { passengerId: '.', authorizationId: 'a1', newStatus: 'revoked' },
      })
    ).rejects.toThrow(HttpsError);
  });

  test('updatePassengerAuthorizationStatusCallable succeeds for revocation', async () => {
    const res = await callables.updatePassengerAuthorizationStatusCallable({
      auth: { uid: 'parent-1' },
      data: { passengerId: 'p1', authorizationId: 'a1', newStatus: 'revoked' },
    });
    expect(res).toMatchObject({ updated: true, newStatus: 'revoked', adultUid: 'parent-1' });
  });
});
