const mockHttpsCallable = jest.fn();
const mockDoc = jest.fn((db, collection, path) => ({ collection, path }));
const mockOnSnapshot = jest.fn((docRef, onNext) => {
  onNext({ exists: () => true, id: 'state-1', data: () => ({ state: 'EXPECTED' }) });
  return jest.fn();
});

jest.mock('firebase/functions', () => ({
  httpsCallable: (functions, name) => {
    mockHttpsCallable.mockImplementation(async (data) => ({
      data: { success: true, pin: '4829', absenceId: 'abs-1', name, data },
    }));
    return mockHttpsCallable;
  },
}));

jest.mock('firebase/firestore', () => ({
  doc: (...args) => mockDoc(...args),
  onSnapshot: (...args) => mockOnSnapshot(...args),
}));

jest.mock('../../config/firebase', () => ({
  auth: { currentUser: { uid: 'user-1' } },
  db: {},
  functions: {},
}));

import {
  mapCustodyError,
  reportStudentAbsence,
  requestHandoverOtp,
  subscribeToPassengerState,
  transitionPassengerState,
  verifyStudentHandover,
} from '../custodyService';

describe('custodyService unit tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('mapCustodyError maps unauthenticated correctly', () => {
    const error = { code: 'unauthenticated', message: 'Auth required' };
    expect(mapCustodyError(error)).toContain('Sesión expirada');
  });

  test('mapCustodyError maps locked permission-denied correctly', () => {
    const error = { code: 'permission-denied', message: 'locked out due to brute force' };
    expect(mapCustodyError(error)).toContain('bloqueado temporalmente');
  });

  test('mapCustodyError maps deadline-exceeded correctly', () => {
    const error = { code: 'deadline-exceeded', message: 'expired' };
    expect(mapCustodyError(error)).toContain('código OTP ha expirado');
  });

  test('transitionPassengerState calls updatePassengerState callable', async () => {
    const res = await transitionPassengerState({
      matchId: 'match-1',
      passengerId: 'pass-1',
      newState: 'BOARDING_CONFIRMED',
    });
    expect(res.name).toBe('updatePassengerState');
    expect(res.data).toEqual(
      expect.objectContaining({
        matchId: 'match-1',
        passengerId: 'pass-1',
        newState: 'BOARDING_CONFIRMED',
      })
    );
  });

  test('requestHandoverOtp calls generateHandoverOtp callable', async () => {
    const res = await requestHandoverOtp({ matchId: 'match-1', passengerId: 'pass-1' });
    expect(res.name).toBe('generateHandoverOtp');
    expect(res.data).toEqual(
      expect.objectContaining({
        matchId: 'match-1',
        passengerId: 'pass-1',
      })
    );
  });

  test('verifyStudentHandover calls confirmStudentHandover callable', async () => {
    const res = await verifyStudentHandover({
      matchId: 'match-1',
      passengerId: 'pass-1',
      pin: '4829',
    });
    expect(res.name).toBe('confirmStudentHandover');
    expect(res.data).toEqual(
      expect.objectContaining({
        matchId: 'match-1',
        passengerId: 'pass-1',
        pin: '4829',
      })
    );
  });

  test('reportStudentAbsence calls reportAbsenceCallable', async () => {
    const res = await reportStudentAbsence({
      matchId: 'match-1',
      passengerId: 'pass-1',
      date: '2026-11-24',
    });
    expect(res.name).toBe('reportAbsenceCallable');
    expect(res.data).toEqual(
      expect.objectContaining({
        matchId: 'match-1',
        passengerId: 'pass-1',
        date: '2026-11-24',
      })
    );
  });

  test('subscribeToPassengerState subscribes to correct firestore doc path', () => {
    const onUpdate = jest.fn();
    const onError = jest.fn();
    const unsubscribe = subscribeToPassengerState('match-1', 'pass-1', onUpdate, onError);

    expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'passengerStates', 'match-1_pass-1');
    expect(mockOnSnapshot).toHaveBeenCalled();
    expect(onUpdate).toHaveBeenCalledWith({
      id: 'state-1',
      state: 'EXPECTED',
    });
    expect(typeof unsubscribe).toBe('function');
  });
});
