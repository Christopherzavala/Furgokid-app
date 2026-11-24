'use strict';

const { FieldPath } = require('firebase-admin/firestore');
const { createFirestoreGpsCleanupRepository } = require('../src/firestoreGpsCleanupRepository');

const makeMockFirestore = (initialData = {}) => {
  const documents = new Map(Object.entries(initialData));

  const makeRef = (path) => ({
    path,
    id: path.split('/').pop(),
    async get() {
      const data = documents.get(path);
      return {
        exists: data !== undefined,
        id: path.split('/').pop(),
        data: () => data,
        get: (field) => data?.[field],
      };
    },
    async delete() {
      documents.delete(path);
    },
    collection(subName) {
      return makeCollection(`${path}/${subName}`);
    },
  });

  const makeCollection = (path) => {
    const createQuery = (
      filters = [],
      orderedBy = null,
      startAfterDocId = null,
      limitCount = 500,
      selectedFields = null
    ) => ({
      where(sF, sOp, sVal) {
        return createQuery(
          [...filters, [sF, sOp, sVal]],
          orderedBy,
          startAfterDocId,
          limitCount,
          selectedFields
        );
      },
      orderBy(field) {
        return createQuery(filters, field, startAfterDocId, limitCount, selectedFields);
      },
      select() {
        return createQuery(filters, orderedBy, startAfterDocId, limitCount, true);
      },
      startAfter(docId) {
        return createQuery(filters, orderedBy, docId, limitCount, selectedFields);
      },
      limit(count) {
        return createQuery(filters, orderedBy, startAfterDocId, count, selectedFields);
      },
      async get() {
        const docs = [];
        for (const [docPath, data] of documents.entries()) {
          if (!docPath.startsWith(`${path}/`) || docPath.slice(path.length + 1).includes('/')) {
            continue;
          }
          const docId = docPath.split('/').pop();
          const matches = filters.every(([f, op, expected]) => {
            if (op === '==') return data[f] === expected;
            return true;
          });
          if (matches) {
            docs.push({
              id: docId,
              ref: makeRef(docPath),
              data: () => data,
              get: (field) => data?.[field],
            });
          }
        }

        if (orderedBy) {
          docs.sort((a, b) => a.id.localeCompare(b.id));
        }

        let finalDocs = docs;
        if (startAfterDocId) {
          const index = docs.findIndex((d) => d.id === startAfterDocId);
          if (index !== -1) {
            finalDocs = docs.slice(index + 1);
          }
        }

        const limited = finalDocs.slice(0, limitCount);
        return { docs: limited, empty: limited.length === 0 };
      },
    });

    return {
      path,
      doc(id) {
        const resolvedId = id || `auto_${Math.random()}`;
        return makeRef(`${path}/${resolvedId}`);
      },
      where(field, op, value) {
        return createQuery([[field, op, value]]);
      },
      orderBy(field) {
        return createQuery([], field);
      },
    };
  };

  return {
    _documents: documents,
    collection(name) {
      return makeCollection(name);
    },
    async runTransaction(callback) {
      const transaction = {
        async get(ref) {
          const path = ref.path || ref;
          const data = documents.get(path);
          return {
            exists: data !== undefined,
            id: path.split('/').pop(),
            data: () => data,
            get: (field) => data?.[field],
          };
        },
        delete(ref) {
          const path = ref.path || ref;
          documents.delete(path);
        },
      };
      return callback(transaction);
    },
  };
};

describe('firestoreGpsCleanupRepository Unit Tests', () => {
  test('constructor validates firestore instance', () => {
    expect(() => createFirestoreGpsCleanupRepository({ firestore: null })).toThrow(TypeError);
    expect(() => createFirestoreGpsCleanupRepository({ firestore: {} })).toThrow(TypeError);
  });

  test('listActiveMatchesByDriver and listMatchesByDriver validate inputs and paginate', async () => {
    const firestore = makeMockFirestore({
      'matches/m1': { driverId: 'driver-1', status: 'active' },
      'matches/m2': { driverId: 'driver-1', status: 'completed' },
      'matches/m3': { driverId: 'driver-1', status: 'active' },
    });
    const repo = createFirestoreGpsCleanupRepository({ firestore });

    await expect(
      repo.listActiveMatchesByDriver({ driverId: '../bad', pageSize: 10 })
    ).rejects.toThrow(TypeError);
    await expect(
      repo.listActiveMatchesByDriver({ driverId: 'driver-1', pageSize: 0 })
    ).rejects.toThrow(RangeError);
    await expect(
      repo.listActiveMatchesByDriver({ driverId: 'driver-1', pageToken: '../bad', pageSize: 10 })
    ).rejects.toThrow(TypeError);

    const activePage = await repo.listActiveMatchesByDriver({ driverId: 'driver-1', pageSize: 10 });
    expect(activePage.matches.length).toBe(2);

    const allPage = await repo.listMatchesByDriver({ driverId: 'driver-1', pageSize: 10 });
    expect(allPage.matches.length).toBe(3);
  });

  test('deleteMatchCurrentTracking handles missing match, denied owner, missing tracking and successful deletion', async () => {
    const firestore = makeMockFirestore({
      'matches/match-1': { driverId: 'driver-1', status: 'active' },
      'matches/match-1/tracking/current': { latitude: -33.4, longitude: -70.6 },
    });
    const repo = createFirestoreGpsCleanupRepository({ firestore });

    // Invalid arguments
    await expect(
      repo.deleteMatchCurrentTracking('../bad', { field: 'driverId', uid: 'driver-1' })
    ).rejects.toThrow(TypeError);
    await expect(
      repo.deleteMatchCurrentTracking('match-1', { field: 'badField', uid: 'driver-1' })
    ).rejects.toThrow(TypeError);

    // Match missing
    const resMissingMatch = await repo.deleteMatchCurrentTracking('match-missing', {
      field: 'driverId',
      uid: 'driver-1',
    });
    expect(resMissingMatch).toBe('match-missing');

    // Denied owner
    const resDenied = await repo.deleteMatchCurrentTracking('match-1', {
      field: 'driverId',
      uid: 'wrong-driver',
    });
    expect(resDenied).toBe('denied');

    // Tracking missing
    firestore._documents.delete('matches/match-1/tracking/current');
    const resTrackingMissing = await repo.deleteMatchCurrentTracking('match-1', {
      field: 'driverId',
      uid: 'driver-1',
    });
    expect(resTrackingMissing).toBe('missing');

    // Successful deletion
    firestore._documents.set('matches/match-1/tracking/current', {
      latitude: -33.4,
      longitude: -70.6,
    });
    const resDeleted = await repo.deleteMatchCurrentTracking('match-1', {
      field: 'driverId',
      uid: 'driver-1',
    });
    expect(resDeleted).toBe('deleted');
  });

  test('deleteDriverCurrentTrackingIfActiveMatch and deleteMatchCurrentTrackingIfTerminal handle states correctly', async () => {
    const firestore = makeMockFirestore({
      'matches/m-active': { driverId: 'driver-1', status: 'active' },
      'matches/m-active/tracking/current': { latitude: 1 },
      'matches/m-term': { status: 'completed' },
      'matches/m-term/tracking/current': { latitude: 2 },
    });
    const repo = createFirestoreGpsCleanupRepository({ firestore });

    // Active match success
    const resActive = await repo.deleteDriverCurrentTrackingIfActiveMatch('m-active', 'driver-1');
    expect(resActive).toBe('deleted');

    // Skipped if driver or status does not match
    firestore._documents.set('matches/m-active', { driverId: 'driver-2', status: 'active' });
    const resSkipped = await repo.deleteDriverCurrentTrackingIfActiveMatch('m-active', 'driver-1');
    expect(resSkipped).toBe('skipped');

    // Terminal match success
    const resTerm = await repo.deleteMatchCurrentTrackingIfTerminal('m-term');
    expect(resTerm).toBe('deleted');

    // Terminal match skipped if not terminal
    firestore._documents.set('matches/m-term', { status: 'active' });
    const resTermSkipped = await repo.deleteMatchCurrentTrackingIfTerminal('m-term');
    expect(resTermSkipped).toBe('skipped');
  });

  test('deleteDriverCurrentTrackingIfAssigned, deleteCurrentTrackingByMatchId and listActiveMatches work correctly', async () => {
    const firestore = makeMockFirestore({
      'matches/m-assigned': { driverId: 'driver-1' },
      'matches/m-assigned/tracking/current': { latitude: 1 },
      'matches/m-match-missing/tracking/current': { latitude: 1 },
      'matches/m-missing-tracking': { driverId: 'driver-1' },
    });
    const repo = createFirestoreGpsCleanupRepository({ firestore });

    const resAssigned = await repo.deleteDriverCurrentTrackingIfAssigned('m-assigned', 'driver-1');
    expect(resAssigned).toBe('deleted');

    const resAssignedDenied = await repo.deleteDriverCurrentTrackingIfAssigned(
      'm-assigned',
      'driver-other'
    );
    expect(resAssignedDenied).toBe('denied');

    const resAssignedMissing = await repo.deleteDriverCurrentTrackingIfAssigned(
      'm-missing-tracking',
      'driver-1'
    );
    expect(resAssignedMissing).toBe('missing');

    const resAssignedMatchMissing = await repo.deleteDriverCurrentTrackingIfAssigned(
      'm-nonexistent',
      'driver-1'
    );
    expect(resAssignedMatchMissing).toBe('match-missing');

    const resByMatchId = await repo.deleteCurrentTrackingByMatchId('m-match-missing');
    expect(resByMatchId).toBe('deleted');

    const resByMatchIdMissing = await repo.deleteCurrentTrackingByMatchId('m-nonexistent-tracking');
    expect(resByMatchIdMissing).toBe('missing');

    const activeMatches = await repo.listActiveMatches({ pageSize: 10 });
    expect(activeMatches).toBeDefined();

    await expect(repo.listActiveMatches({ pageSize: 0 })).rejects.toThrow(RangeError);
  });

  test('deleteStaleCurrentTracking cleans up stale records', async () => {
    const oldDate = new Date(Date.now() - 30 * 60 * 1000);
    const firestore = makeMockFirestore({
      'matches/m-stale': { status: 'active' },
      'matches/m-stale/tracking/current': { updatedAt: { toDate: () => oldDate } },
    });
    const repo = createFirestoreGpsCleanupRepository({ firestore });

    const res = await repo.deleteStaleCurrentTracking({
      now: Date.now(),
      staleAfterMs: 10 * 60 * 1000,
    });
    expect(res.deletedCount).toBe(1);
  });
});
