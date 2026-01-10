/**
 * Mock Data for Testing
 *
 * Datos de prueba realistas para testing de Cloud Functions
 */

module.exports = {
  // ==========================================
  // Mock Users
  // ==========================================
  mockUsers: {
    parent1: {
      uid: 'parent-001',
      email: 'maria.garcia@example.com',
      displayName: 'María García',
      role: 'parent',
      zone: 'Norte',
      phone: '+1234567890',
      address: 'Calle Principal 123, Zona Norte',
      childrenCount: 2,
      schools: ['Colegio San José', 'Liceo Central'],
      pushToken: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
      platform: 'android',
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-10'),
    },

    parent2: {
      uid: 'parent-002',
      email: 'juan.martinez@example.com',
      displayName: 'Juan Martínez',
      role: 'parent',
      zone: 'Sur',
      phone: '+1234567891',
      address: 'Avenida Sur 456',
      childrenCount: 1,
      schools: ['Colegio Santa María'],
      pushToken: 'ExponentPushToken[yyyyyyyyyyyyyyyyyyyyyy]',
      platform: 'ios',
      createdAt: new Date('2025-01-02'),
      updatedAt: new Date('2025-01-10'),
    },

    driver1: {
      uid: 'driver-001',
      email: 'carlos.rodriguez@example.com',
      displayName: 'Carlos Rodríguez',
      role: 'driver',
      zone: 'Norte',
      phone: '+1234567892',
      vehiclePlate: 'ABC-123',
      vehicleModel: 'Toyota Hiace 2020',
      vehicleColor: 'Blanco',
      licenseNumber: 'LIC-123456',
      licenseExpiry: '2026-12-31',
      pushToken: 'ExponentPushToken[zzzzzzzzzzzzzzzzzzzzzz]',
      platform: 'android',
      verified: true,
      rating: 4.8,
      totalTrips: 45,
      createdAt: new Date('2024-12-01'),
      updatedAt: new Date('2025-01-10'),
    },

    driver2: {
      uid: 'driver-002',
      email: 'ana.lopez@example.com',
      displayName: 'Ana López',
      role: 'driver',
      zone: 'Sur',
      phone: '+1234567893',
      vehiclePlate: 'XYZ-789',
      vehicleModel: 'Nissan Urvan 2019',
      vehicleColor: 'Gris',
      licenseNumber: 'LIC-789012',
      licenseExpiry: '2027-06-30',
      pushToken: 'ExponentPushToken[wwwwwwwwwwwwwwwwwwwwww]',
      platform: 'ios',
      verified: true,
      rating: 4.9,
      totalTrips: 78,
      createdAt: new Date('2024-11-15'),
      updatedAt: new Date('2025-01-09'),
    },
  },

  // ==========================================
  // Mock Requests (Parent → Driver)
  // ==========================================
  mockRequests: {
    request1: {
      id: 'request-001',
      parentId: 'parent-001',
      parentName: 'María García',
      zone: 'Norte',
      school: 'Colegio San José',
      schedule: 'Entrada',
      childrenCount: 2,
      address: 'Calle Principal 123',
      notes: 'Preferencia por vehículo con aire acondicionado',
      status: 'active',
      createdAt: new Date('2025-01-10T08:00:00'),
      updatedAt: new Date('2025-01-10T08:00:00'),
    },

    request2: {
      id: 'request-002',
      parentId: 'parent-002',
      parentName: 'Juan Martínez',
      zone: 'Sur',
      school: 'Colegio Santa María',
      schedule: 'Salida',
      childrenCount: 1,
      address: 'Avenida Sur 456',
      notes: '',
      status: 'active',
      createdAt: new Date('2025-01-10T09:00:00'),
      updatedAt: new Date('2025-01-10T09:00:00'),
    },

    request3: {
      id: 'request-003',
      parentId: 'parent-001',
      parentName: 'María García',
      zone: 'Norte',
      school: 'Liceo Central',
      schedule: 'Ambas',
      childrenCount: 1,
      address: 'Calle Principal 123',
      notes: 'Flexible con horarios',
      status: 'active',
      createdAt: new Date('2025-01-09T10:00:00'),
      updatedAt: new Date('2025-01-09T10:00:00'),
    },
  },

  // ==========================================
  // Mock Vacancies (Driver → Parent)
  // ==========================================
  mockVacancies: {
    vacancy1: {
      id: 'vacancy-001',
      driverId: 'driver-001',
      driverName: 'Carlos Rodríguez',
      zone: 'Norte',
      schedule: 'Entrada',
      availableSeats: 3,
      schools: ['Colegio San José', 'Liceo Central', 'Escuela Primaria Norte'],
      vehicleModel: 'Toyota Hiace 2020',
      vehiclePlate: 'ABC-123',
      pricePerMonth: 120,
      notes: 'Incluye seguro. Vehículo con aire acondicionado.',
      status: 'active',
      createdAt: new Date('2025-01-10T07:30:00'),
      updatedAt: new Date('2025-01-10T07:30:00'),
    },

    vacancy2: {
      id: 'vacancy-002',
      driverId: 'driver-002',
      driverName: 'Ana López',
      zone: 'Sur',
      schedule: 'Salida',
      availableSeats: 2,
      schools: ['Colegio Santa María', 'Instituto del Sur'],
      vehicleModel: 'Nissan Urvan 2019',
      vehiclePlate: 'XYZ-789',
      pricePerMonth: 100,
      notes: 'Conductora experimentada. 5 años de experiencia.',
      status: 'active',
      createdAt: new Date('2025-01-10T08:15:00'),
      updatedAt: new Date('2025-01-10T08:15:00'),
    },

    vacancy3: {
      id: 'vacancy-003',
      driverId: 'driver-001',
      driverName: 'Carlos Rodríguez',
      zone: 'Norte',
      schedule: 'Ambas',
      availableSeats: 4,
      schools: ['Colegio San José', 'Liceo Central'],
      vehicleModel: 'Toyota Hiace 2020',
      vehiclePlate: 'ABC-123',
      pricePerMonth: 200,
      notes: 'Servicio completo (entrada y salida). Descuento por hermanos.',
      status: 'active',
      createdAt: new Date('2025-01-09T07:00:00'),
      updatedAt: new Date('2025-01-09T07:00:00'),
    },
  },

  // ==========================================
  // Mock Notification Logs
  // ==========================================
  mockNotificationLogs: {
    log1: {
      id: 'log-001',
      type: 'new_request',
      requestId: 'request-001',
      driversNotified: 3,
      success: true,
      duration: 234,
      timestamp: new Date('2025-01-10T08:00:05'),
    },

    log2: {
      id: 'log-002',
      type: 'new_vacancy',
      vacancyId: 'vacancy-001',
      parentsNotified: 2,
      success: true,
      duration: 187,
      timestamp: new Date('2025-01-10T07:30:05'),
    },
  },

  // ==========================================
  // Mock Notification Errors
  // ==========================================
  mockNotificationErrors: {
    error1: {
      id: 'error-001',
      type: 'new_request',
      requestId: 'request-002',
      error: 'Expo Push API rate limit exceeded',
      stack: 'Error: Rate limit exceeded\n    at fetch...',
      timestamp: new Date('2025-01-09T12:00:00'),
    },
  },

  // ==========================================
  // Mock Expo Push Responses
  // ==========================================
  mockExpoPushResponses: {
    success: {
      data: [
        {
          status: 'ok',
          id: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX',
        },
      ],
    },

    error: {
      data: [
        {
          status: 'error',
          message: 'Invalid push token',
          details: {
            error: 'DeviceNotRegistered',
          },
        },
      ],
    },

    multipleSuccess: {
      data: [
        { status: 'ok', id: 'notification-1' },
        { status: 'ok', id: 'notification-2' },
        { status: 'ok', id: 'notification-3' },
      ],
    },
  },

  // ==========================================
  // Helper Functions
  // ==========================================
  generateMockRequest: (overrides = {}) => {
    return {
      parentId: 'parent-001',
      parentName: 'Test Parent',
      zone: 'Norte',
      school: 'Test School',
      schedule: 'Entrada',
      childrenCount: 2,
      address: 'Test Address 123',
      notes: '',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  },

  generateMockVacancy: (overrides = {}) => {
    return {
      driverId: 'driver-001',
      driverName: 'Test Driver',
      zone: 'Norte',
      schedule: 'Entrada',
      availableSeats: 3,
      schools: ['Test School 1', 'Test School 2'],
      vehicleModel: 'Test Vehicle',
      vehiclePlate: 'TEST-123',
      pricePerMonth: 100,
      notes: '',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  },

  generateMockUser: (role = 'parent', overrides = {}) => {
    const base = {
      uid: `${role}-test-${Date.now()}`,
      email: `test.${role}@example.com`,
      displayName: `Test ${role}`,
      role,
      zone: 'Norte',
      phone: '+1234567890',
      pushToken: 'ExponentPushToken[test]',
      platform: 'android',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (role === 'parent') {
      return {
        ...base,
        childrenCount: 2,
        schools: ['Test School'],
        address: 'Test Address',
        ...overrides,
      };
    } else {
      return {
        ...base,
        vehiclePlate: 'TEST-123',
        vehicleModel: 'Test Vehicle',
        vehicleColor: 'White',
        licenseNumber: 'LIC-TEST',
        licenseExpiry: '2026-12-31',
        verified: true,
        rating: 5.0,
        totalTrips: 0,
        ...overrides,
      };
    }
  },
};
