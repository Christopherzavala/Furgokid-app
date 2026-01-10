/**
 * Unit Tests for Firebase Cloud Functions
 *
 * Testing:
 * - notifyDriversNewRequest
 * - notifyParentsNewVacancy
 * - sendWelcomeEmail
 * - testNotification
 */

const test = require('firebase-functions-test')();
const admin = require('firebase-admin');

// Mock data
const mockRequest = {
  parentId: 'parent123',
  parentName: 'María García',
  zone: 'Norte',
  school: 'Colegio San José',
  schedule: 'Entrada',
  childrenCount: 2,
  status: 'active',
};

const mockVacancy = {
  driverId: 'driver456',
  driverName: 'Juan Pérez',
  zone: 'Sur',
  schedule: 'Salida',
  availableSeats: 3,
  schools: ['Liceo Central', 'Colegio Santa María'],
  status: 'active',
};

const mockDriverUsers = [
  {
    id: 'driver1',
    data: () => ({
      uid: 'driver1',
      role: 'driver',
      zone: 'Norte',
      pushToken: 'ExponentPushToken[AAAA]',
      displayName: 'Driver 1',
    }),
  },
  {
    id: 'driver2',
    data: () => ({
      uid: 'driver2',
      role: 'driver',
      zone: 'Norte',
      pushToken: 'ExponentPushToken[BBBB]',
      displayName: 'Driver 2',
    }),
  },
];

const mockParentRequests = [
  {
    id: 'request1',
    data: () => ({
      parentId: 'parent1',
      zone: 'Sur',
      schedule: 'Salida',
      status: 'active',
      school: 'Liceo Central',
    }),
  },
  {
    id: 'request2',
    data: () => ({
      parentId: 'parent2',
      zone: 'Sur',
      schedule: 'Ambas',
      status: 'active',
      school: 'Colegio Santa María',
    }),
  },
];

describe('Cloud Functions Unit Tests', () => {
  let myFunctions;
  let adminInitStub;

  beforeAll(() => {
    // Mock admin.initializeApp
    adminInitStub = jest.spyOn(admin, 'initializeApp');

    // Load functions
    myFunctions = require('../index');
  });

  afterAll(() => {
    test.cleanup();
    adminInitStub.mockRestore();
  });

  describe('notifyDriversNewRequest', () => {
    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();

      // Mock fetch for Expo Push API
      global.fetch = jest.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ data: [{ status: 'ok', id: 'notification-id-123' }] }),
        })
      );
    });

    test('should find drivers in same zone and send notifications', async () => {
      // Mock Firestore query
      const mockSnapshot = {
        empty: false,
        size: 2,
        forEach: (callback) => mockDriverUsers.forEach(callback),
      };

      const mockGet = jest.fn(() => Promise.resolve(mockSnapshot));
      const mockWhere = jest.fn(() => ({ where: mockWhere, get: mockGet }));
      const mockCollection = jest.fn(() => ({ where: mockWhere }));

      // Mock admin.firestore
      jest.spyOn(admin, 'firestore').mockReturnValue({
        collection: mockCollection,
      });

      // Mock Firestore FieldValue
      admin.firestore.FieldValue = {
        serverTimestamp: jest.fn(() => new Date()),
      };

      // Create mock snapshot
      const snap = test.firestore.makeDocumentSnapshot(mockRequest, 'requests/request123');
      const context = { params: { requestId: 'request123' } };

      // Call function
      await myFunctions.notifyDriversNewRequest(snap, context);

      // Verify Firestore query
      expect(mockCollection).toHaveBeenCalledWith('users');
      expect(mockWhere).toHaveBeenCalledWith('role', '==', 'driver');
      expect(mockWhere).toHaveBeenCalledWith('zone', '==', 'Norte');

      // Verify Expo Push API call
      expect(global.fetch).toHaveBeenCalledWith(
        'https://exp.host/--/api/v2/push/send',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );

      // Verify notification payload
      const fetchCall = global.fetch.mock.calls[0];
      const payload = JSON.parse(fetchCall[1].body);
      expect(payload).toHaveLength(2); // 2 drivers with push tokens
      expect(payload[0]).toMatchObject({
        to: 'ExponentPushToken[AAAA]',
        title: '🚌 Nueva solicitud en tu zona',
        body: expect.stringContaining('María García'),
        data: {
          type: 'new_request',
          requestId: 'request123',
          zone: 'Norte',
        },
      });
    });

    test('should handle no drivers in zone gracefully', async () => {
      // Mock empty snapshot
      const mockSnapshot = {
        empty: true,
        size: 0,
        forEach: jest.fn(),
      };

      const mockGet = jest.fn(() => Promise.resolve(mockSnapshot));
      const mockWhere = jest.fn(() => ({ where: mockWhere, get: mockGet }));
      const mockCollection = jest.fn(() => ({ where: mockWhere }));

      jest.spyOn(admin, 'firestore').mockReturnValue({
        collection: mockCollection,
      });

      const snap = test.firestore.makeDocumentSnapshot(mockRequest, 'requests/request123');
      const context = { params: { requestId: 'request123' } };

      // Should not throw
      await expect(myFunctions.notifyDriversNewRequest(snap, context)).resolves.toBe(null);

      // Should not call Expo API
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('should handle errors and log to notification_errors', async () => {
      // Mock Firestore to throw error
      jest.spyOn(admin, 'firestore').mockImplementation(() => {
        throw new Error('Firestore connection failed');
      });

      const snap = test.firestore.makeDocumentSnapshot(mockRequest, 'requests/request123');
      const context = { params: { requestId: 'request123' } };

      // Should not throw (graceful degradation)
      await expect(myFunctions.notifyDriversNewRequest(snap, context)).resolves.toBe(null);
    });
  });

  describe('notifyParentsNewVacancy', () => {
    beforeEach(() => {
      jest.clearAllMocks();

      global.fetch = jest.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ data: [{ status: 'ok' }] }),
        })
      );
    });

    test('should find parents with matching schedule and send notifications', async () => {
      // Mock Firestore queries
      const mockRequestsSnapshot = {
        empty: false,
        size: 2,
        docs: mockParentRequests,
      };

      const mockParentDoc = {
        data: () => ({
          uid: 'parent1',
          pushToken: 'ExponentPushToken[CCCC]',
          displayName: 'Parent 1',
        }),
      };

      let queryCallCount = 0;
      const mockGet = jest.fn(() => {
        queryCallCount++;
        if (queryCallCount === 1) {
          return Promise.resolve(mockRequestsSnapshot); // First call: requests
        } else {
          return Promise.resolve(mockParentDoc); // Subsequent calls: parent docs
        }
      });

      const mockDoc = jest.fn(() => ({ get: mockGet }));
      const mockWhere = jest.fn(() => ({ where: mockWhere, get: mockGet }));
      const mockCollection = jest.fn(() => ({ where: mockWhere }));

      jest.spyOn(admin, 'firestore').mockReturnValue({
        collection: mockCollection,
        doc: mockDoc,
      });

      admin.firestore.FieldValue = {
        serverTimestamp: jest.fn(() => new Date()),
      };

      const snap = test.firestore.makeDocumentSnapshot(mockVacancy, 'vacancies/vacancy456');
      const context = { params: { vacancyId: 'vacancy456' } };

      await myFunctions.notifyParentsNewVacancy(snap, context);

      // Verify requests query
      expect(mockCollection).toHaveBeenCalledWith('requests');
      expect(mockWhere).toHaveBeenCalledWith('zone', '==', 'Sur');
      expect(mockWhere).toHaveBeenCalledWith('status', '==', 'active');

      // Verify Expo API called
      expect(global.fetch).toHaveBeenCalled();
    });

    test('should filter by schedule compatibility', async () => {
      // Test that 'Entrada' vacancy doesn't notify 'Salida' parents
      const entradaVacancy = {
        ...mockVacancy,
        schedule: 'Entrada',
      };

      const salidaRequest = {
        ...mockParentRequests[0],
        data: () => ({
          ...mockParentRequests[0].data(),
          schedule: 'Salida', // Incompatible
        }),
      };

      const mockRequestsSnapshot = {
        empty: false,
        size: 1,
        docs: [salidaRequest],
      };

      const mockGet = jest.fn(() => Promise.resolve(mockRequestsSnapshot));
      const mockWhere = jest.fn(() => ({ where: mockWhere, get: mockGet }));
      const mockCollection = jest.fn(() => ({ where: mockWhere }));

      jest.spyOn(admin, 'firestore').mockReturnValue({
        collection: mockCollection,
      });

      const snap = test.firestore.makeDocumentSnapshot(entradaVacancy, 'vacancies/vacancy456');
      const context = { params: { vacancyId: 'vacancy456' } };

      await myFunctions.notifyParentsNewVacancy(snap, context);

      // Should not send notifications (schedule mismatch)
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('testNotification', () => {
    test('should send test notification successfully', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ data: [{ status: 'ok', id: 'test-id' }] }),
        })
      );

      const req = {
        method: 'POST',
        body: {
          pushToken: 'ExponentPushToken[TEST]',
          message: 'Test message',
        },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
        json: jest.fn(),
      };

      await myFunctions.testNotification(req, res);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://exp.host/--/api/v2/push/send',
        expect.objectContaining({
          method: 'POST',
        })
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    test('should reject non-POST requests', async () => {
      const req = { method: 'GET' };
      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await myFunctions.testNotification(req, res);

      expect(res.status).toHaveBeenCalledWith(405);
      expect(res.send).toHaveBeenCalledWith('Method Not Allowed');
    });

    test('should reject requests without pushToken', async () => {
      const req = {
        method: 'POST',
        body: { message: 'Test' },
      };

      const res = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await myFunctions.testNotification(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith('Missing pushToken');
    });
  });
});
