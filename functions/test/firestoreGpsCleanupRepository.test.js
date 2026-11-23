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
        data: () => (data ? { ...data } : null),
        get: (field) => data?.[field],
      };
    },
    async delete() {
      documents.delete(path);
    },
    collection(name) {
      return makeCollection(`${path}/${name}`);
    },
  });

  const makeCollection = (path) => ({
    path,
    doc(id) {
      return makeRef(`${path}/${id}`);
    },
    where(field, op, value) {
      const filters = [[field, op, value]];
      let selectedFields = null;
      let orderedBy = null;
      let startAfterId = null;
      let limitCount = 500;

      const builder = {
        where(sF, sOp, sVal) {
          filters.push([sF, sOp, sVal]);
          return builder;
        },
        select(...fields) {
          selectedFields = fields;
          return builder;
        },
        orderBy(field) {
          orderedBy = field;
          return builder;
        },
        startAfter(docId) {
          startAfterId = docId;
          return builder;
        },
        limit(count) {
          limitCount = count;
          return builder;
        },
        async get() {
          const docs = [];
          for (const [docPath, data] of documents.entries()) {
            if (!docPath.startsWith(`${path}/`) || docPath.slice(path.length + 1).includes('/')) {
              continue;
            }
            const docId = docPath.split('/').pop();
            if (startAfterId !== null && docId <= startAfterId) {
              continue;
            }

            const matches = filters.every(([f, op, expected]) => {
              if (op === '==') return data[f] === expected;
              if (op === 'in') return Array.isArray(expected) && expected.includes(data[f]);
              return true;
            });

            if (matches) {
              docs.push({
                id: docId,
                ref: makeRef(docPath),
                data: () => ({ ...data }),
                get: (field) => data?.[field],
              });
            }
          }

          if (orderedBy === FieldPath.documentId()) {
            docs.sort((a, b) => a.id.localeCompare(b.id));
          }

          const limited = docs.slice(0, limitCount);
          return { docs: limited, empty: limited.length === 0 };
        },
      };
      return builder;
    },
  });

  return {
    _documents: documents,
    collection: makeCollection,
    async runTransaction(callback) {
      const transaction = {
        async get(ref) {
          const path = ref.path || ref;
          const data = documents.get(path);
          return {
            exists: data !== undefined,
            data: () => (data ? { ...data } : null),
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
  test('constructor throws TypeError if firestore instance is invalid', () => {
    expect(() => createFirestoreGpsCleanupRepository({ firestore: null })).toThrow(TypeError);
  });

  test('listActiveMatchesByDriver validates inputs', async () => {
    const db = makeMockFirestore();
    const repo = createFirestoreGpsCleanupRepository({ firestore: db });

    await expect(
      repo.listActiveMatchesByDriver({ driverId: 'bad/id', pageSize: 10 })
    ).rejects.toThrow(TypeError);
    await expect(
      repo.listActiveMatchesByDriver({ driverId: 'driver-1', pageSize: 0 })
    ).rejects.toThrow(RangeError);
    await expect(
      repo.listActiveMatchesByDriver({ driverId: 'driver-1', pageSize: 10, pageToken: 'bad/id' })
    ).rejects.toThrow(TypeError);
  });

  test('listActiveMatchesByDriver lists matches successfully with pagination', async () => {
    const db = makeMockFirestore({
      'matches/match-1': { driverId: 'driver-1', status: 'active' },
      'matches/match-2': { driverId: 'driver-1', status: 'active' },
      'matches/match-3': { driverId: 'driver-1', status: 'completed' },
    });
    const repo = createFirestoreGpsCleanupRepository({ firestore: db });

    const res = await repo.listActiveMatchesByDriver({ driverId: 'driver-1', pageSize: 10 });
    expect(res.matches).toHaveLength(2);
    expect(res.nextPageToken).toBeNull();
  });

  test('listMatchesByDriver lists all matches by driver', async () => {
    const db = makeMockFirestore({
      'matches/match-1': { driverId: 'driver-1', status: 'active' },
      'matches/match-2': { driverId: 'driver-1', status: 'completed' },
    });
    const repo = createFirestoreGpsCleanupRepository({ firestore: db });

    const res = await repo.listMatchesByDriver({ driverId: 'driver-1', pageSize: 10 });
    expect(res.matches).toHaveLength(2);
  });

  test('deleteMatchCurrentTracking handles missing match, denied owner, missing tracking, and deletion', async () => {
    const db = makeMockFirestore({
      'matches/match-1': { driverId: 'driver-1', parentId: 'parent-1' },
      'matches/match-2': { driverId: 'driver-1', parentId: 'parent-1' },
      'matches/match-2/tracking/current': { latitude: -33, longitude: -70 },
      'matches/match-3': { driverId: 'driver-1', parentId: 'parent-1' },
      'matches/match-3/tracking/current': { latitude: -33, longitude: -70 },
    });
    const repo = createFirestoreGpsCleanupRepository({ firestore: db });

    // Match missing
    const r1 = await repo.deleteMatchCurrentTracking('match-missing', {
      field: 'driverId',
      uid: 'driver-1',
    });
    expect(r1).toBe('match-missing');

    // Denied owner
    const r2 = await repo.deleteMatchCurrentTracking('match-1', {
      field: 'driverId',
      uid: 'driver-other',
    });
    expect(r2).toBe('denied');

    // Missing tracking
    const r3 = await repo.deleteMatchCurrentTracking('match-1', {
      field: 'driverId',
      uid: 'driver-1',
    });
    expect(r3).toBe('missing');

    // Deleted successfully
    const r4 = await repo.deleteMatchCurrentTracking('match-2', {
      field: 'driverId',
      uid: 'driver-1',
    });
    expect(r4).toBe('deleted');
    expect(db._documents.has('matches/match-2/tracking/current')).toBe(false);

    // Parent owner deletion
    const r5 = await repo.deleteMatchCurrentTracking('match-3', {
      field: 'parentId',
      uid: 'parent-1',
    });
    expect(r5).toBe('deleted');
  });

  test('deleteDriverCurrentTrackingIfActiveMatch handles missing match, skipped, missing tracking, and deletion', async () => {
    const db = makeMockFirestore({
      'matches/match-1': { driverId: 'driver-other', status: 'active' },
      'matches/match-2': { driverId: 'driver-1', status: 'completed' },
      'matches/match-3': { driverId: 'driver-1', status: 'active' },
      'matches/match-3/tracking/current': { latitude: -33, longitude: -70 },
    });
    const repo = createFirestoreGpsCleanupRepository({ firestore: db });

    expect(await repo.deleteDriverCurrentTrackingIfActiveMatch('match-missing', 'driver-1')).toBe(
      'match-missing'
    );
    expect(await repo.deleteDriverCurrentTrackingIfActiveMatch('match-1', 'driver-1')).toBe(
      'skipped'
    );
    expect(await repo.deleteDriverCurrentTrackingIfActiveMatch('match-2', 'driver-1')).toBe(
      'skipped'
    );
    expect(await repo.deleteDriverCurrentTrackingIfActiveMatch('match-3', 'driver-1')).toBe(
      'deleted'
    );
    expect(db._documents.has('matches/match-3/tracking/current')).toBe(false);
  });

  test('deleteMatchCurrentTrackingIfTerminal handles missing match, skipped, and deletion', async () => {
    const db = makeMockFirestore({
      'matches/match-1': { status: 'active' },
      'matches/match-2': { status: 'completed' },
      'matches/match-2/tracking/current': { latitude: -33, longitude: -70 },
    });
    const repo = createFirestoreGpsCleanupRepository({ firestore: db });

    expect(await repo.deleteMatchCurrentTrackingIfTerminal('match-missing')).toBe('match-missing');
    expect(await repo.deleteMatchCurrentTrackingIfTerminal('match-1')).toBe('skipped');
    expect(await repo.deleteMatchCurrentTrackingIfTerminal('match-2')).toBe('deleted');
  });

  test('deleteDriverCurrentTrackingIfAssigned handles missing match, denied, missing tracking, and deletion', async () => {
    const db = makeMockFirestore({
      'matches/match-1': { driverId: 'driver-other' },
      'matches/match-2': { driverId: 'driver-1' },
      'matches/match-2/tracking/current': { latitude: -33, longitude: -70 },
    });
    const repo = createFirestoreGpsCleanupRepository({ firestore: db });

    expect(await repo.deleteDriverCurrentTrackingIfAssigned('match-missing', 'driver-1')).toBe(
      'match-missing'
    );
    expect(await repo.deleteDriverCurrentTrackingIfAssigned('match-1', 'driver-1')).toBe('denied');
    expect(await repo.deleteDriverCurrentTrackingIfAssigned('match-2', 'driver-1')).toBe('deleted');
  });

  test('deleteCurrentTrackingByMatchId handles missing and deletion', async () => {
    const db = makeMockFirestore({
      'matches/match-1/tracking/current': { latitude: -33, longitude: -70 },
    });
    const repo = createFirestoreGpsCleanupRepository({ firestore: db });

    expect(await repo.deleteCurrentTrackingByMatchId('match-missing')).toBe('missing');
    expect(await repo.deleteCurrentTrackingByMatchId('match-1')).toBe('deleted');
  });

  test('deleteStaleCurrentTracking validates inputs and deletes stale active tracking points', async () => {
    const now = Date.now();
    const staleTime = new Date(now - 20 * 60 * 1000); // 20 mins ago
    const freshTime = new Date(now - 2 * 60 * 1000); // 2 mins ago

    const db = makeMockFirestore({
      'matches/match-stale': { status: 'active' },
      'matches/match-stale/tracking/current': { updatedAt: { toDate: () => staleTime } },
      'matches/match-fresh': { status: 'active' },
      'matches/match-fresh/tracking/current': { updatedAt: { toDate: () => freshTime } },
    });
    const repo = createFirestoreGpsCleanupRepository({ firestore: db });

    await expect(repo.deleteStaleCurrentTracking({ now: 'bad' })).rejects.toThrow(TypeError);

    const result = await repo.deleteStaleCurrentTracking({ now, staleAfterMs: 10 * 60 * 1000 });
    expect(result.deletedCount).toBe(1);
    expect(db._documents.has('matches/match-stale/tracking/current')).toBe(false);
    expect(db._documents.has('matches/match-fresh/tracking/current')).toBe(true);
  });
});
