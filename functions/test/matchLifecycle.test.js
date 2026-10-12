const { createMatchLifecycleRepository, deterministicMatchId } = require('../src/matchLifecycle');

const clone = (value) => {
  if (Array.isArray(value)) return value.map(clone);
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, clone(nested)]));
  }
  return value;
};

const createFirestore = () => {
  const documents = new Map();
  let transactionQueue = Promise.resolve();

  const makeDocument = (path) => ({
    path,
    id: path.split('/').pop(),
    collection: (name) => makeCollection(`${path}/${name}`),
  });
  const makeCollection = (path) => ({
    doc: (id) => makeDocument(`${path}/${id}`),
    where(field, operator, value) {
      return {
        queryPath: path,
        field,
        operator,
        value,
        limit(count) {
          return { ...this, maxResults: count };
        },
      };
    },
  });

  const firestore = {
    collection: makeCollection,
    seed(path, data) {
      documents.set(path, clone(data));
    },
    read(path) {
      return clone(documents.get(path));
    },
    runTransaction(callback) {
      const operation = transactionQueue.then(async () => {
        const writes = [];
        const transaction = {
          async get(reference) {
            if (reference.queryPath) {
              const prefix = `${reference.queryPath}/`;
              const docs = [...documents.entries()]
                .filter(
                  ([path, data]) =>
                    path.startsWith(prefix) &&
                    !path.slice(prefix.length).includes('/') &&
                    (reference.operator !== '==' || data?.[reference.field] === reference.value)
                )
                .slice(0, reference.maxResults || Infinity)
                .map(([path, data]) => ({
                  id: path.split('/').pop(),
                  data: () => clone(data),
                }));
              return { empty: docs.length === 0, docs, size: docs.length };
            }
            const data = documents.get(reference.path);
            return {
              exists: data !== undefined,
              data: () => clone(data),
              get: (field) => data?.[field],
            };
          },
          create(reference, data) {
            writes.push({ type: 'create', path: reference.path, data: clone(data) });
          },
          update(reference, data) {
            writes.push({ type: 'update', path: reference.path, data: clone(data) });
          },
          delete(reference) {
            writes.push({ type: 'delete', path: reference.path });
          },
        };

        const result = await callback(transaction);
        for (const write of writes) {
          if (write.type === 'create') {
            if (documents.has(write.path)) throw new Error('Document already exists');
            documents.set(write.path, write.data);
          } else if (write.type === 'update') {
            if (!documents.has(write.path)) throw new Error('Document does not exist');
            const updated = { ...documents.get(write.path) };
            for (const [key, value] of Object.entries(write.data)) {
              if (value?._methodName === 'delete') delete updated[key];
              else updated[key] = value;
            }
            documents.set(write.path, updated);
          } else {
            documents.delete(write.path);
          }
        }
        return result;
      });
      transactionQueue = operation.catch(() => undefined);
      return operation;
    },
  };

  return firestore;
};

const seedBase = (firestore, { reservedSeats = 0, availableSeats = 4, totalSeats = 4 } = {}) => {
  firestore.seed('users/parent-1', { role: 'parent', displayName: 'Parent', whatsapp: '111' });
  firestore.seed('users/driver-1', { role: 'driver', approved: true });
  firestore.seed('vacancies/vacancy-1', {
    driverId: 'driver-1',
    driverName: 'Driver',
    driverPhone: '222',
    status: 'active',
    zone: 'Zona Norte',
    schedule: 'Mañana',
    totalSeats,
    availableSeats,
    reservedSeats,
  });
};

const requestData = {
  school: 'Colegio Uno',
  zone: 'Zona Norte',
  schedule: 'Mañana',
  childrenCount: 2,
  ages: '8',
  specialNeeds: '',
  driverId: 'attacker-controlled-value',
};

describe('match lifecycle repository', () => {
  test('creates a pending match using the vacancy driver and does not reserve capacity', async () => {
    const firestore = createFirestore();
    seedBase(firestore);
    const repository = createMatchLifecycleRepository({ firestore });

    const result = await repository.createOrAddMatch({
      actorUid: 'parent-1',
      requestId: 'request-1',
      vacancyId: 'vacancy-1',
      requestData,
    });

    const matchId = deterministicMatchId('request-1', 'vacancy-1');
    expect(result).toEqual({
      requestId: 'request-1',
      matchId,
      status: 'pending',
      idempotent: false,
    });
    expect(firestore.read(`matches/${matchId}`)).toMatchObject({
      driverId: 'driver-1',
      status: 'pending',
      capacityReservationStatus: 'unreserved',
      reservedSeats: 0,
    });
    expect(firestore.read('requests/request-1')).toMatchObject({
      parentId: 'parent-1',
      status: 'active',
      activeMatchId: null,
    });
    expect(firestore.read('vacancies/vacancy-1')).toMatchObject({
      availableSeats: 4,
      reservedSeats: 0,
    });
  });

  test('acceptance reserves capacity and repeated acceptance is idempotent', async () => {
    const firestore = createFirestore();
    seedBase(firestore);
    const repository = createMatchLifecycleRepository({ firestore });
    const { matchId } = await repository.createOrAddMatch({
      actorUid: 'parent-1',
      requestId: 'request-1',
      vacancyId: 'vacancy-1',
      requestData,
    });

    await expect(repository.acceptMatch({ actorUid: 'driver-1', matchId })).resolves.toEqual({
      status: 'active',
      idempotent: false,
    });
    await expect(repository.acceptMatch({ actorUid: 'driver-1', matchId })).resolves.toEqual({
      status: 'active',
      idempotent: true,
    });
    expect(firestore.read('requests/request-1').activeMatchId).toBe(matchId);
    expect(firestore.read('vacancies/vacancy-1')).toMatchObject({
      availableSeats: 2,
      reservedSeats: 2,
    });
    await expect(
      repository.createOrAddMatch({
        actorUid: 'parent-1',
        requestId: 'request-1',
        vacancyId: 'vacancy-1',
        requestData,
      })
    ).resolves.toMatchObject({ idempotent: true, status: 'active' });
  });

  test('rejects acceptMatch when driver profile has approved: false', async () => {
    const firestore = createFirestore();
    firestore.seed('users/parent-1', { role: 'parent', displayName: 'Parent', whatsapp: '111' });
    firestore.seed('users/driver-1', { role: 'driver', approved: false });
    firestore.seed('vacancies/vacancy-1', {
      driverId: 'driver-1',
      driverName: 'Driver',
      driverPhone: '222',
      status: 'active',
      zone: 'Zona Norte',
      schedule: 'Mañana',
      totalSeats: 4,
      availableSeats: 4,
      reservedSeats: 0,
    });
    const repository = createMatchLifecycleRepository({ firestore });
    const { matchId } = await repository.createOrAddMatch({
      actorUid: 'parent-1',
      requestId: 'request-1',
      vacancyId: 'vacancy-1',
      requestData,
    });

    await expect(repository.acceptMatch({ actorUid: 'driver-1', matchId })).rejects.toMatchObject({
      code: 'permission-denied',
    });
    expect(firestore.read(`matches/${matchId}`).status).toBe('pending');
    expect(firestore.read('vacancies/vacancy-1')).toMatchObject({
      availableSeats: 4,
      reservedSeats: 0,
    });
  });

  test('rejects acceptMatch when driver profile lacks approved field', async () => {
    const firestore = createFirestore();
    firestore.seed('users/parent-1', { role: 'parent', displayName: 'Parent', whatsapp: '111' });
    firestore.seed('users/driver-1', { role: 'driver' });
    firestore.seed('vacancies/vacancy-1', {
      driverId: 'driver-1',
      driverName: 'Driver',
      driverPhone: '222',
      status: 'active',
      zone: 'Zona Norte',
      schedule: 'Mañana',
      totalSeats: 4,
      availableSeats: 4,
      reservedSeats: 0,
    });
    const repository = createMatchLifecycleRepository({ firestore });
    const { matchId } = await repository.createOrAddMatch({
      actorUid: 'parent-1',
      requestId: 'request-1',
      vacancyId: 'vacancy-1',
      requestData,
    });

    await expect(repository.acceptMatch({ actorUid: 'driver-1', matchId })).rejects.toMatchObject({
      code: 'permission-denied',
    });
    expect(firestore.read(`matches/${matchId}`).status).toBe('pending');
    expect(firestore.read('vacancies/vacancy-1')).toMatchObject({
      availableSeats: 4,
      reservedSeats: 0,
    });
  });

  test('accepts acceptMatch when driver profile has approved: true', async () => {
    const firestore = createFirestore();
    firestore.seed('users/parent-1', { role: 'parent', displayName: 'Parent', whatsapp: '111' });
    firestore.seed('users/driver-1', { role: 'driver', approved: true });
    firestore.seed('vacancies/vacancy-1', {
      driverId: 'driver-1',
      driverName: 'Driver',
      driverPhone: '222',
      status: 'active',
      zone: 'Zona Norte',
      schedule: 'Mañana',
      totalSeats: 4,
      availableSeats: 4,
      reservedSeats: 0,
    });
    const repository = createMatchLifecycleRepository({ firestore });
    const { matchId } = await repository.createOrAddMatch({
      actorUid: 'parent-1',
      requestId: 'request-1',
      vacancyId: 'vacancy-1',
      requestData,
    });

    await expect(repository.acceptMatch({ actorUid: 'driver-1', matchId })).resolves.toEqual({
      status: 'active',
      idempotent: false,
    });
    expect(firestore.read('requests/request-1').activeMatchId).toBe(matchId);
    expect(firestore.read('vacancies/vacancy-1')).toMatchObject({
      availableSeats: 2,
      reservedSeats: 2,
    });
  });

  test.each([
    ['cancelMatch', 'parent-1', 'cancelled'],
    ['cancelMatch', 'driver-1', 'cancelled'],
    ['completeMatch', 'driver-1', 'completed'],
  ])(
    '%s by an authorized participant releases capacity once',
    async (operation, actorUid, status) => {
      const firestore = createFirestore();
      seedBase(firestore);
      const repository = createMatchLifecycleRepository({ firestore });
      const { matchId } = await repository.createOrAddMatch({
        actorUid: 'parent-1',
        requestId: 'request-1',
        vacancyId: 'vacancy-1',
        requestData,
      });
      await repository.acceptMatch({ actorUid: 'driver-1', matchId });
      firestore.seed(`matches/${matchId}/tracking/current`, { latitude: 1, longitude: 2 });

      const transition =
        operation === 'completeMatch' ? repository.completeMatch : repository.cancelMatch;
      await transition.call(repository, { actorUid, matchId });
      await transition.call(repository, { actorUid, matchId });

      expect(firestore.read(`matches/${matchId}`).status).toBe(status);
      expect(firestore.read(`matches/${matchId}`).capacityReservationStatus).toBe('released');
      expect(firestore.read('vacancies/vacancy-1')).toMatchObject({
        availableSeats: 4,
        reservedSeats: 0,
      });
      expect(firestore.read(`matches/${matchId}/tracking/current`)).toBeUndefined();
    }
  );

  test('rejects a third party, parent completion, and terminal reversal', async () => {
    const firestore = createFirestore();
    seedBase(firestore);
    firestore.seed('users/outsider', { role: 'parent' });
    firestore.seed('users/other-driver', { role: 'driver' });
    const repository = createMatchLifecycleRepository({ firestore });
    const { matchId } = await repository.createOrAddMatch({
      actorUid: 'parent-1',
      requestId: 'request-1',
      vacancyId: 'vacancy-1',
      requestData,
    });
    await repository.acceptMatch({ actorUid: 'driver-1', matchId });

    await expect(
      repository.acceptMatch({ actorUid: 'other-driver', matchId })
    ).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(repository.cancelMatch({ actorUid: 'outsider', matchId })).rejects.toMatchObject({
      code: 'permission-denied',
    });
    await expect(repository.completeMatch({ actorUid: 'parent-1', matchId })).rejects.toMatchObject(
      {
        code: 'permission-denied',
      }
    );
    await repository.cancelMatch({ actorUid: 'parent-1', matchId });
    await expect(repository.completeMatch({ actorUid: 'driver-1', matchId })).rejects.toMatchObject(
      {
        code: 'failed-precondition',
      }
    );
  });

  test('cancels a pending match without releasing unreserved capacity', async () => {
    const firestore = createFirestore();
    seedBase(firestore);
    const repository = createMatchLifecycleRepository({ firestore });
    const { matchId } = await repository.createOrAddMatch({
      actorUid: 'parent-1',
      requestId: 'request-1',
      vacancyId: 'vacancy-1',
      requestData,
    });

    await repository.cancelMatch({ actorUid: 'driver-1', matchId });
    expect(firestore.read(`matches/${matchId}`)).toMatchObject({
      status: 'cancelled',
      capacityReservationStatus: 'unreserved',
    });
    expect(firestore.read('vacancies/vacancy-1')).toMatchObject({
      availableSeats: 4,
      reservedSeats: 0,
    });
  });

  test('serializes acceptances for a request so only one match becomes active', async () => {
    const firestore = createFirestore();
    seedBase(firestore);
    const repository = createMatchLifecycleRepository({ firestore });
    const first = await repository.createOrAddMatch({
      actorUid: 'parent-1',
      requestId: 'request-1',
      vacancyId: 'vacancy-1',
      requestData,
    });
    const second = await repository
      .createOrAddMatch({
        actorUid: 'parent-1',
        requestId: 'request-1',
        vacancyId: 'vacancy-2',
        requestData: undefined,
      })
      .catch((error) => error);

    expect(second).toMatchObject({ code: 'not-found' });
    const secondMatchId = deterministicMatchId('request-1', 'vacancy-2');
    firestore.seed('vacancies/vacancy-2', {
      ...firestore.read('vacancies/vacancy-1'),
    });
    await repository.createOrAddMatch({
      actorUid: 'parent-1',
      requestId: 'request-1',
      vacancyId: 'vacancy-2',
    });

    const results = await Promise.allSettled([
      repository.acceptMatch({ actorUid: 'driver-1', matchId: first.matchId }),
      repository.acceptMatch({ actorUid: 'driver-1', matchId: secondMatchId }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(firestore.read('requests/request-1').activeMatchId).toBe(first.matchId);
  });

  test('closed requests reject acceptance and cannot receive another pending match', async () => {
    const firestore = createFirestore();
    seedBase(firestore);
    const repository = createMatchLifecycleRepository({ firestore });
    const { matchId } = await repository.createOrAddMatch({
      actorUid: 'parent-1',
      requestId: 'request-1',
      vacancyId: 'vacancy-1',
      requestData,
    });

    await repository.closeRequest({ actorUid: 'parent-1', requestId: 'request-1' });
    await expect(repository.acceptMatch({ actorUid: 'driver-1', matchId })).rejects.toMatchObject({
      code: 'failed-precondition',
    });
    firestore.seed('vacancies/vacancy-2', {
      ...firestore.read('vacancies/vacancy-1'),
    });
    await expect(
      repository.createOrAddMatch({
        actorUid: 'parent-1',
        requestId: 'request-1',
        vacancyId: 'vacancy-2',
      })
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  test('deletes owned requests without matches and is idempotent on retry', async () => {
    const firestore = createFirestore();
    seedBase(firestore);
    firestore.seed('requests/request-1', { parentId: 'parent-1', status: 'active' });
    const repository = createMatchLifecycleRepository({ firestore });
    await repository.deleteRequests({ actorUid: 'parent-1', requestIds: ['request-1'] });
    await expect(
      repository.deleteRequests({ actorUid: 'parent-1', requestIds: ['request-1'] })
    ).resolves.toMatchObject({ deletedCount: 0 });
    expect(firestore.read('requests/request-1')).toBeUndefined();
  });

  test('refuses a request ID with an orphaned associated match', async () => {
    const firestore = createFirestore();
    seedBase(firestore);
    firestore.seed('matches/orphaned-match', { requestId: 'request-1', status: 'completed' });
    const repository = createMatchLifecycleRepository({ firestore });

    await expect(
      repository.deleteRequests({ actorUid: 'parent-1', requestIds: ['request-1'] })
    ).rejects.toMatchObject({
      code: 'failed-precondition',
      reason: 'request-has-matches',
    });
    expect(firestore.read('matches/orphaned-match')).toBeDefined();
  });

  test.each(['pending', 'active', 'completed', 'cancelled'])(
    'refuses to delete a request with a %s match',
    async (status) => {
      const firestore = createFirestore();
      seedBase(firestore);
      firestore.seed('requests/request-1', {
        parentId: 'parent-1',
        status: 'active',
        childrenCount: 2,
      });
      firestore.seed('matches/match-1', { requestId: 'request-1', status });
      const repository = createMatchLifecycleRepository({ firestore });

      await expect(
        repository.deleteRequests({ actorUid: 'parent-1', requestIds: ['request-1'] })
      ).rejects.toMatchObject({
        code: 'failed-precondition',
        reason: 'request-has-matches',
      });
      expect(firestore.read('requests/request-1')).toBeDefined();
    }
  );

  test('rejects deleting another parent request', async () => {
    const firestore = createFirestore();
    seedBase(firestore);
    firestore.seed('requests/other-request', { parentId: 'another-parent', status: 'active' });
    const repository = createMatchLifecycleRepository({ firestore });

    await expect(
      repository.deleteRequests({ actorUid: 'parent-1', requestIds: ['other-request'] })
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(firestore.read('requests/other-request')).toBeDefined();
  });

  test('requires parent authorization even when the request list is empty', async () => {
    const firestore = createFirestore();
    seedBase(firestore);
    const repository = createMatchLifecycleRepository({ firestore });

    await expect(
      repository.deleteRequests({ actorUid: 'missing-user', requestIds: [] })
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  test('serializes request deletion against adding a match', async () => {
    const firestore = createFirestore();
    seedBase(firestore);
    firestore.seed('requests/request-1', {
      parentId: 'parent-1',
      status: 'active',
      activeMatchId: null,
      school: 'Colegio Uno',
      zone: 'Zona Norte',
      schedule: 'Mañana',
      childrenCount: 2,
      ages: '',
      specialNeeds: '',
    });
    const repository = createMatchLifecycleRepository({ firestore });
    const results = await Promise.allSettled([
      repository.deleteRequests({ actorUid: 'parent-1', requestIds: ['request-1'] }),
      repository.createOrAddMatch({
        actorUid: 'parent-1',
        requestId: 'request-1',
        vacancyId: 'vacancy-1',
      }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const requestExists = firestore.read('requests/request-1') !== undefined;
    const matchExists =
      firestore.read(`matches/${deterministicMatchId('request-1', 'vacancy-1')}`) !== undefined;
    expect(requestExists || !matchExists).toBe(true);
  });

  test('capacity edits preserve reservations and reject totals below reserved seats', async () => {
    const firestore = createFirestore();
    seedBase(firestore);
    const repository = createMatchLifecycleRepository({ firestore });
    const { matchId } = await repository.createOrAddMatch({
      actorUid: 'parent-1',
      requestId: 'request-1',
      vacancyId: 'vacancy-1',
      requestData,
    });
    await repository.acceptMatch({ actorUid: 'driver-1', matchId });

    await expect(
      repository.updateVacancyCapacity({
        actorUid: 'driver-1',
        vacancyId: 'vacancy-1',
        totalSeats: 1,
      })
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(
      repository.updateVacancyCapacity({
        actorUid: 'driver-1',
        vacancyId: 'vacancy-1',
        totalSeats: 3,
      })
    ).resolves.toMatchObject({ totalSeats: 3, availableSeats: 1, reservedSeats: 2 });
  });

  test('rejects updateVacancyCapacity when driver profile has approved: false', async () => {
    const firestore = createFirestore();
    firestore.seed('users/driver-1', { role: 'driver', approved: false });
    firestore.seed('vacancies/vacancy-1', {
      driverId: 'driver-1',
      driverName: 'Driver',
      driverPhone: '222',
      status: 'active',
      zone: 'Zona Norte',
      schedule: 'Mañana',
      totalSeats: 4,
      availableSeats: 2,
      reservedSeats: 2,
    });
    const repository = createMatchLifecycleRepository({ firestore });

    await expect(
      repository.updateVacancyCapacity({
        actorUid: 'driver-1',
        vacancyId: 'vacancy-1',
        totalSeats: 5,
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(firestore.read('vacancies/vacancy-1')).toMatchObject({
      totalSeats: 4,
      availableSeats: 2,
      reservedSeats: 2,
    });
  });

  test('rejects updateVacancyCapacity when driver profile lacks approved field', async () => {
    const firestore = createFirestore();
    firestore.seed('users/driver-1', { role: 'driver' });
    firestore.seed('vacancies/vacancy-1', {
      driverId: 'driver-1',
      driverName: 'Driver',
      driverPhone: '222',
      status: 'active',
      zone: 'Zona Norte',
      schedule: 'Mañana',
      totalSeats: 4,
      availableSeats: 2,
      reservedSeats: 2,
    });
    const repository = createMatchLifecycleRepository({ firestore });

    await expect(
      repository.updateVacancyCapacity({
        actorUid: 'driver-1',
        vacancyId: 'vacancy-1',
        totalSeats: 5,
      })
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(firestore.read('vacancies/vacancy-1')).toMatchObject({
      totalSeats: 4,
      availableSeats: 2,
      reservedSeats: 2,
    });
  });

  test('accepts updateVacancyCapacity when driver profile has approved: true', async () => {
    const firestore = createFirestore();
    firestore.seed('users/driver-1', { role: 'driver', approved: true });
    firestore.seed('vacancies/vacancy-1', {
      driverId: 'driver-1',
      driverName: 'Driver',
      driverPhone: '222',
      status: 'active',
      zone: 'Zona Norte',
      schedule: 'Mañana',
      totalSeats: 4,
      availableSeats: 2,
      reservedSeats: 2,
    });
    const repository = createMatchLifecycleRepository({ firestore });

    await expect(
      repository.updateVacancyCapacity({
        actorUid: 'driver-1',
        vacancyId: 'vacancy-1',
        totalSeats: 5,
      })
    ).resolves.toMatchObject({ totalSeats: 5, availableSeats: 3, reservedSeats: 2 });
    expect(firestore.read('vacancies/vacancy-1')).toMatchObject({
      totalSeats: 5,
      availableSeats: 3,
      reservedSeats: 2,
    });
  });

  test('rejects acceptance when current available capacity is insufficient', async () => {
    const firestore = createFirestore();
    seedBase(firestore);
    const repository = createMatchLifecycleRepository({ firestore });
    const { matchId } = await repository.createOrAddMatch({
      actorUid: 'parent-1',
      requestId: 'request-1',
      vacancyId: 'vacancy-1',
      requestData,
    });
    firestore.seed('vacancies/vacancy-1', {
      ...firestore.read('vacancies/vacancy-1'),
      availableSeats: 1,
      reservedSeats: 3,
    });

    await expect(repository.acceptMatch({ actorUid: 'driver-1', matchId })).rejects.toMatchObject({
      code: 'resource-exhausted',
    });
    expect(firestore.read(`matches/${matchId}`).status).toBe('pending');
    expect(firestore.read('requests/request-1').activeMatchId).toBe(null);
    expect(firestore.read('vacancies/vacancy-1')).toMatchObject({
      totalSeats: 4,
      availableSeats: 1,
      reservedSeats: 3,
    });
  });

  test('fails closed for a legacy vacancy until explicit initialization', async () => {
    const firestore = createFirestore();
    seedBase(firestore);
    const vacancy = firestore.read('vacancies/vacancy-1');
    delete vacancy.reservedSeats;
    firestore.seed('vacancies/vacancy-1', vacancy);
    const repository = createMatchLifecycleRepository({ firestore });

    await expect(
      repository.createOrAddMatch({
        actorUid: 'parent-1',
        requestId: 'request-1',
        vacancyId: 'vacancy-1',
        requestData,
      })
    ).rejects.toMatchObject({ code: 'failed-precondition' });

    await repository.initializeVacancyCapacity({ actorUid: 'driver-1', vacancyId: 'vacancy-1' });
    await expect(
      repository.createOrAddMatch({
        actorUid: 'parent-1',
        requestId: 'request-1',
        vacancyId: 'vacancy-1',
        requestData,
      })
    ).resolves.toMatchObject({ status: 'pending' });
  });

  test('rejects initializeVacancyCapacity when driver profile has approved: false', async () => {
    const firestore = createFirestore();
    firestore.seed('users/driver-1', { role: 'driver', approved: false });
    firestore.seed('vacancies/vacancy-1', {
      driverId: 'driver-1',
      driverName: 'Driver',
      driverPhone: '222',
      status: 'active',
      zone: 'Zona Norte',
      schedule: 'Mañana',
      totalSeats: 4,
      availableSeats: 4,
    });
    const repository = createMatchLifecycleRepository({ firestore });

    await expect(
      repository.initializeVacancyCapacity({ actorUid: 'driver-1', vacancyId: 'vacancy-1' })
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(firestore.read('vacancies/vacancy-1')).toMatchObject({
      totalSeats: 4,
      availableSeats: 4,
    });
    expect(firestore.read('vacancies/vacancy-1').reservedSeats).toBeUndefined();
  });

  test('rejects initializeVacancyCapacity when driver profile lacks approved field', async () => {
    const firestore = createFirestore();
    firestore.seed('users/driver-1', { role: 'driver' });
    firestore.seed('vacancies/vacancy-1', {
      driverId: 'driver-1',
      driverName: 'Driver',
      driverPhone: '222',
      status: 'active',
      zone: 'Zona Norte',
      schedule: 'Mañana',
      totalSeats: 4,
      availableSeats: 4,
    });
    const repository = createMatchLifecycleRepository({ firestore });

    await expect(
      repository.initializeVacancyCapacity({ actorUid: 'driver-1', vacancyId: 'vacancy-1' })
    ).rejects.toMatchObject({ code: 'permission-denied' });
    expect(firestore.read('vacancies/vacancy-1')).toMatchObject({
      totalSeats: 4,
      availableSeats: 4,
    });
    expect(firestore.read('vacancies/vacancy-1').reservedSeats).toBeUndefined();
  });

  test('accepts initializeVacancyCapacity when driver profile has approved: true', async () => {
    const firestore = createFirestore();
    firestore.seed('users/driver-1', { role: 'driver', approved: true });
    firestore.seed('vacancies/vacancy-1', {
      driverId: 'driver-1',
      driverName: 'Driver',
      driverPhone: '222',
      status: 'active',
      zone: 'Zona Norte',
      schedule: 'Mañana',
      totalSeats: 4,
      availableSeats: 4,
    });
    const repository = createMatchLifecycleRepository({ firestore });

    await expect(
      repository.initializeVacancyCapacity({ actorUid: 'driver-1', vacancyId: 'vacancy-1' })
    ).resolves.toMatchObject({ status: 'initialized' });
  });

  test('does not partially reserve a disabled vacancy or one without enough seats', async () => {
    const firestore = createFirestore();
    seedBase(firestore, { totalSeats: 1, availableSeats: 1 });
    const repository = createMatchLifecycleRepository({ firestore });
    const { matchId } = await repository.createOrAddMatch({
      actorUid: 'parent-1',
      requestId: 'request-1',
      vacancyId: 'vacancy-1',
      requestData: { ...requestData, childrenCount: 1 },
    });
    const vacancy = firestore.read('vacancies/vacancy-1');
    vacancy.status = 'inactive';
    firestore.seed('vacancies/vacancy-1', vacancy);

    await expect(repository.acceptMatch({ actorUid: 'driver-1', matchId })).rejects.toMatchObject({
      code: 'failed-precondition',
    });
    expect(firestore.read(`matches/${matchId}`).status).toBe('pending');
    expect(firestore.read('vacancies/vacancy-1')).toMatchObject({
      availableSeats: 1,
      reservedSeats: 0,
    });
  });
});
