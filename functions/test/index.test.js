/**
 * Unit Tests for Firebase Cloud Functions
 *
 * Testing:
 * - notifyDriversNewRequest
 * - notifyParentsNewVacancy
 * - sendWelcomeEmail
 * - testNotification
 */

const admin = require('firebase-admin');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const createFirestoreEvent = (data, params) => ({
  data: { data: () => data },
  params,
});

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
  const originalGuardValue = process.env.CI_DISABLE_EXTERNAL_NOTIFICATIONS;

  beforeAll(() => {
    // Mock admin.initializeApp
    adminInitStub = jest.spyOn(admin, 'initializeApp');

    // Load functions
    myFunctions = require('../index');
  });

  afterAll(() => {
    adminInitStub.mockRestore();
  });

  beforeEach(() => {
    process.env.CI_DISABLE_EXTERNAL_NOTIFICATIONS = 'false';
  });

  afterEach(() => {
    if (originalGuardValue === undefined) {
      delete process.env.CI_DISABLE_EXTERNAL_NOTIFICATIONS;
    } else {
      process.env.CI_DISABLE_EXTERNAL_NOTIFICATIONS = originalGuardValue;
    }
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

    test('notifies only the driver assigned to the pending match', async () => {
      const assignedDriver = {
        exists: true,
        get: (field) => (field === 'role' ? 'driver' : undefined),
        data: () => ({
          role: 'driver',
          pushToken: 'ExponentPushToken[AAAA]',
        }),
      };
      const notificationLogAdd = jest.fn(() => Promise.resolve());
      const mockCollection = jest.fn((collectionName) => {
        if (collectionName === 'users') {
          return {
            doc: jest.fn(() => ({ get: jest.fn(() => Promise.resolve(assignedDriver)) })),
          };
        }
        return { add: notificationLogAdd };
      });

      // Mock admin.firestore
      jest.spyOn(admin, 'firestore').mockReturnValue({
        collection: mockCollection,
      });

      // Mock Firestore FieldValue
      admin.firestore.FieldValue = {
        serverTimestamp: jest.fn(() => new Date()),
      };

      // Create mock snapshot
      const event = createFirestoreEvent(
        {
          ...mockRequest,
          driverId: 'driver456',
          requestId: 'request123',
          status: 'pending',
        },
        { matchId: 'match123' }
      );

      // Call function
      await myFunctions.notifyDriversNewRequest.run(event);

      // Verify the assigned driver is resolved directly, not by zone-wide fan-out.
      expect(mockCollection).toHaveBeenCalledWith('users');
      expect(mockCollection).toHaveBeenCalledWith('notification_logs');

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
      expect(payload).toHaveLength(1);
      expect(payload[0]).toMatchObject({
        to: 'ExponentPushToken[AAAA]',
        title: '🚌 Nueva solicitud asignada',
        body: expect.stringContaining('María García'),
        data: {
          type: 'new_request',
          requestId: 'request123',
          matchId: 'match123',
          zone: 'Norte',
        },
      });
    });

    test('does not send a notification if the assigned driver has no push token', async () => {
      const assignedDriver = {
        exists: true,
        get: (field) => (field === 'role' ? 'driver' : undefined),
        data: () => ({ role: 'driver' }),
      };
      const mockCollection = jest.fn(() => ({
        doc: jest.fn(() => ({ get: jest.fn(() => Promise.resolve(assignedDriver)) })),
      }));

      jest.spyOn(admin, 'firestore').mockReturnValue({
        collection: mockCollection,
      });

      const event = createFirestoreEvent(
        { ...mockRequest, driverId: 'driver456', status: 'pending' },
        { matchId: 'match123' }
      );

      // Should not throw
      await expect(myFunctions.notifyDriversNewRequest.run(event)).resolves.toBe(null);

      // Should not call Expo API
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('should handle errors and log to notification_errors', async () => {
      const errorLogAdd = jest.fn(() => Promise.resolve());
      const mockCollection = jest.fn((collectionName) => {
        if (collectionName === 'users') {
          return {
            doc: jest.fn(() => ({
              get: jest.fn(() => Promise.reject(new Error('Firestore connection failed'))),
            })),
          };
        }
        return { add: errorLogAdd };
      });
      jest.spyOn(admin, 'firestore').mockReturnValue({ collection: mockCollection });
      admin.firestore.FieldValue = {
        serverTimestamp: jest.fn(() => new Date()),
      };

      const event = createFirestoreEvent(
        { ...mockRequest, driverId: 'driver456', status: 'pending' },
        { matchId: 'match123' }
      );

      // Should not throw (graceful degradation)
      await expect(myFunctions.notifyDriversNewRequest.run(event)).resolves.toBe(null);
      expect(mockCollection).toHaveBeenCalledWith('notification_errors');
      expect(errorLogAdd).toHaveBeenCalled();
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
      const mockCollection = jest.fn(() => ({
        where: mockWhere,
        doc: mockDoc,
        add: jest.fn(() => Promise.resolve()),
      }));

      jest.spyOn(admin, 'firestore').mockReturnValue({
        collection: mockCollection,
        doc: mockDoc,
      });

      admin.firestore.FieldValue = {
        serverTimestamp: jest.fn(() => new Date()),
      };

      const event = createFirestoreEvent(mockVacancy, { vacancyId: 'vacancy456' });

      await myFunctions.notifyParentsNewVacancy.run(event);

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

      const event = createFirestoreEvent(entradaVacancy, { vacancyId: 'vacancy456' });

      await myFunctions.notifyParentsNewVacancy.run(event);

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

  describe('CI external notification guard', () => {
    let originalAttemptFile;
    let originalFetch;
    let markerDirectory;
    let attemptFile;

    beforeEach(() => {
      originalAttemptFile = process.env.CI_EXTERNAL_NOTIFICATION_ATTEMPT_FILE;
      originalFetch = global.fetch;
      markerDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'furgokid-notification-guard-'));
      attemptFile = path.join(markerDirectory, 'attempts.txt');
      process.env.CI_EXTERNAL_NOTIFICATION_ATTEMPT_FILE = attemptFile;
      process.env.CI_DISABLE_EXTERNAL_NOTIFICATIONS = 'true';
      global.fetch = jest.fn();
    });

    afterEach(() => {
      if (originalAttemptFile === undefined) {
        delete process.env.CI_EXTERNAL_NOTIFICATION_ATTEMPT_FILE;
      } else {
        process.env.CI_EXTERNAL_NOTIFICATION_ATTEMPT_FILE = originalAttemptFile;
      }
      global.fetch = originalFetch;
      fs.rmSync(markerDirectory, { recursive: true, force: true });
    });

    test('notifyDriversNewRequest blocks Expo Push and records the attempt', async () => {
      const driver = {
        exists: true,
        get: (field) => (field === 'role' ? 'driver' : undefined),
        data: () => ({ role: 'driver', pushToken: 'ExponentPushToken[CI]' }),
      };
      const errorLogAdd = jest.fn();
      jest.spyOn(admin, 'firestore').mockReturnValue({
        collection: jest.fn((name) => {
          if (name === 'users') {
            return { doc: () => ({ get: async () => driver }) };
          }
          return { add: errorLogAdd };
        }),
      });

      await expect(
        myFunctions.notifyDriversNewRequest.run(
          createFirestoreEvent(
            { ...mockRequest, driverId: 'driver456', status: 'pending' },
            { matchId: 'match-ci-guard' }
          )
        )
      ).rejects.toMatchObject({ code: 'CI_EXTERNAL_NOTIFICATION_BLOCKED' });

      expect(global.fetch).not.toHaveBeenCalled();
      expect(errorLogAdd).not.toHaveBeenCalled();
      expect(fs.readFileSync(attemptFile, 'utf8')).toBe('CI_EXTERNAL_NOTIFICATION_BLOCKED\n');
    });

    test('notifyParentsNewVacancy blocks Expo Push and records the attempt', async () => {
      const requestsSnapshot = { empty: false, docs: [mockParentRequests[0]] };
      const parentSnapshot = {
        data: () => ({ pushToken: 'ExponentPushToken[CI]' }),
      };
      const mockGet = jest
        .fn()
        .mockResolvedValueOnce(requestsSnapshot)
        .mockResolvedValue(parentSnapshot);
      const mockWhere = jest.fn(() => ({ where: mockWhere, get: mockGet }));
      const errorLogAdd = jest.fn();
      jest.spyOn(admin, 'firestore').mockReturnValue({
        collection: jest.fn((name) =>
          name === 'requests'
            ? { where: mockWhere }
            : { doc: () => ({ get: mockGet }), add: errorLogAdd }
        ),
      });

      await expect(
        myFunctions.notifyParentsNewVacancy.run(
          createFirestoreEvent(mockVacancy, { vacancyId: 'vacancy-ci-guard' })
        )
      ).rejects.toMatchObject({ code: 'CI_EXTERNAL_NOTIFICATION_BLOCKED' });

      expect(global.fetch).not.toHaveBeenCalled();
      expect(errorLogAdd).not.toHaveBeenCalled();
      expect(fs.readFileSync(attemptFile, 'utf8')).toBe('CI_EXTERNAL_NOTIFICATION_BLOCKED\n');
    });

    test('testNotification reports a blocked Expo Push attempt without calling fetch', async () => {
      const response = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      await myFunctions.testNotification(
        {
          method: 'POST',
          body: { pushToken: 'ExponentPushToken[CI]', message: 'CI guard test' },
        },
        response
      );

      expect(global.fetch).not.toHaveBeenCalled();
      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'CI_EXTERNAL_NOTIFICATION_BLOCKED',
        })
      );
      expect(fs.readFileSync(attemptFile, 'utf8')).toBe('CI_EXTERNAL_NOTIFICATION_BLOCKED\n');
    });
  });
});
