const { createPushDeviceCallables } = require('../src/pushDeviceCallables');
const {
  handleExpoReceipts,
  sendExpoPush,
  pollExpoReceiptsHandler,
  cleanupInactiveDevicesHandler,
} = require('../src/externalNotifications');

// Mock Firestore for unit testing callables, receipt handlers, and cleanup with pagination support
class MockFirestore {
  constructor() {
    this.data = {};
  }

  collection(path) {
    const self = this;
    return {
      doc: (id) => {
        const fullPath = `${path}/${id}`;
        return {
          id,
          path: fullPath,
          collection: (subPath) => self.collection(`${fullPath}/${subPath}`),
          get: async () => {
            const val = self.data[fullPath];
            return {
              exists: !!val,
              data: () => val,
              ref: self.collection(path).doc(id),
            };
          },
          set: async (val, opts) => {
            if (opts && opts.merge && self.data[fullPath]) {
              self.data[fullPath] = { ...self.data[fullPath], ...val };
            } else {
              self.data[fullPath] = val;
            }
          },
          update: async (val) => {
            if (self.data[fullPath]) {
              self.data[fullPath] = { ...self.data[fullPath], ...val };
            } else {
              self.data[fullPath] = val;
            }
          },
          delete: async () => {
            delete self.data[fullPath];
          },
        };
      },
      where: (field, op, value) => {
        const createQueryObj = (accumulatedFilters) => ({
          where: (f2, op2, val2) => {
            return createQueryObj([...accumulatedFilters, { field: f2, op: op2, val: val2 }]);
          },
          limit: (lim) => ({
            get: async () => {
              const docs = [];
              for (const [key, val] of Object.entries(self.data)) {
                if (!key.startsWith(path + '/')) continue;
                let matches = true;
                for (const filter of accumulatedFilters) {
                  const docVal = val ? val[filter.field] : undefined;
                  if (filter.op === '==' && docVal !== filter.val) matches = false;
                  if (
                    filter.op === 'in' &&
                    (!Array.isArray(filter.val) || !filter.val.includes(docVal))
                  )
                    matches = false;
                  if (filter.op === '<=' && !(docVal <= filter.val)) matches = false;
                }
                if (matches) {
                  docs.push({
                    id: key.split('/').pop(),
                    data: () => val,
                    ref: {
                      update: async (uVal) => {
                        self.data[key] = { ...self.data[key], ...uVal };
                      },
                      delete: async () => {
                        delete self.data[key];
                      },
                    },
                  });
                }
              }
              const slicedDocs = docs.slice(0, lim);
              return { docs: slicedDocs, size: slicedDocs.length, empty: slicedDocs.length === 0 };
            },
          }),
          get: async () => {
            const docs = [];
            for (const [key, val] of Object.entries(self.data)) {
              if (!key.startsWith(path + '/')) continue;
              let matches = true;
              for (const filter of accumulatedFilters) {
                const docVal = val ? val[filter.field] : undefined;
                if (filter.op === '==' && docVal !== filter.val) matches = false;
                if (
                  filter.op === 'in' &&
                  (!Array.isArray(filter.val) || !filter.val.includes(docVal))
                )
                  matches = false;
                if (filter.op === '<=' && !(docVal <= filter.val)) matches = false;
              }
              if (matches) {
                docs.push({
                  id: key.split('/').pop(),
                  data: () => val,
                  ref: {
                    update: async (uVal) => {
                      self.data[key] = { ...self.data[key], ...uVal };
                    },
                    delete: async () => {
                      delete self.data[key];
                    },
                  },
                });
              }
            }
            return { docs, size: docs.length, empty: docs.length === 0 };
          },
        });

        return createQueryObj([{ field, op, val: value }]);
      },
    };
  }

  collectionGroup(groupName) {
    const self = this;
    const createQueryObj = (accumulatedFilters) => ({
      where: (f2, op2, val2) => {
        return createQueryObj([...accumulatedFilters, { field: f2, op: op2, val: val2 }]);
      },
      limit: (lim) => ({
        get: async () => {
          const docs = [];
          for (const [key, val] of Object.entries(self.data)) {
            if (!key.includes(`/${groupName}/`)) continue;
            let matches = true;
            for (const filter of accumulatedFilters) {
              const docVal = val ? val[filter.field] : undefined;
              if (filter.op === '==' && docVal !== filter.val) matches = false;
              if (
                filter.op === 'in' &&
                (!Array.isArray(filter.val) || !filter.val.includes(docVal))
              )
                matches = false;
              if (filter.op === '<=' && !(docVal <= filter.val)) matches = false;
            }
            if (matches) {
              docs.push({
                id: key.split('/').pop(),
                data: () => val,
                ref: {
                  delete: async () => {
                    delete self.data[key];
                  },
                },
              });
            }
          }
          const slicedDocs = docs.slice(0, lim);
          return { docs: slicedDocs, size: slicedDocs.length, empty: slicedDocs.length === 0 };
        },
      }),
    });

    return createQueryObj([]);
  }

  batch() {
    const ops = [];
    return {
      delete: (docRef) => {
        ops.push(() => docRef.delete());
      },
      commit: async () => {
        for (const op of ops) {
          await op();
        }
      },
    };
  }

  async runTransaction(updateFunction) {
    const transaction = {
      get: async (docRef) => docRef.get(),
      set: async (docRef, val, opts) => docRef.set(val, opts),
      update: async (docRef, val) => docRef.update(val),
    };
    return updateFunction(transaction);
  }
}

describe('Push Device Lifecycle & Notifications', () => {
  let firestore;
  let callables;
  let logger;

  beforeEach(() => {
    firestore = new MockFirestore();
    logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    callables = createPushDeviceCallables({ firestore, logger });
  });

  afterEach(() => {
    delete process.env.CI_DISABLE_EXTERNAL_NOTIFICATIONS;
  });

  test('registerPushDevice saves device and index, and detaches previous owner if token changes account', async () => {
    const token = 'ExpoPushToken[abc123xyz]';
    const deviceId1 = 'device_user1';
    const deviceId2 = 'device_user2';

    // 1. User 1 registers token
    const res1 = await callables.registerPushDevice({
      auth: { uid: 'user1' },
      data: { expoPushToken: token, deviceId: deviceId1, platform: 'ios' },
    });
    expect(res1.success).toBe(true);

    const devicePath1 = 'users/user1/devices/device_user1';
    expect(firestore.data[devicePath1].status).toBe('active');

    // 2. User 2 registers the exact same token (cross-account transfer/reuse)
    const res2 = await callables.registerPushDevice({
      auth: { uid: 'user2' },
      data: { expoPushToken: token, deviceId: deviceId2, platform: 'android' },
    });
    expect(res2.success).toBe(true);

    // User 1 device should now be detached
    expect(firestore.data[devicePath1].status).toBe('detached');
    // User 2 device should be active
    const devicePath2 = 'users/user2/devices/device_user2';
    expect(firestore.data[devicePath2].status).toBe('active');
  });

  test('registerPushDevice detaches old device ID when same user re-registers same token on new device ID', async () => {
    const token = 'ExpoPushToken[same_user_new_device]';
    const oldDeviceId = 'old_device_1';
    const newDeviceId = 'new_device_2';
    const uid = 'user_same';

    // 1. Initial registration
    await callables.registerPushDevice({
      auth: { uid },
      data: { expoPushToken: token, deviceId: oldDeviceId, platform: 'android' },
    });
    expect(firestore.data[`users/${uid}/devices/${oldDeviceId}`].status).toBe('active');

    // 2. Re-registration on new device ID
    await callables.registerPushDevice({
      auth: { uid },
      data: { expoPushToken: token, deviceId: newDeviceId, platform: 'android' },
    });

    // Old device must be marked detached to prevent duplicate notification dispatches
    expect(firestore.data[`users/${uid}/devices/${oldDeviceId}`].status).toBe('detached');
    expect(firestore.data[`users/${uid}/devices/${newDeviceId}`].status).toBe('active');
  });

  test('revokePushDevice marks device and index as detached cleanly inside transaction', async () => {
    const token = 'ExpoPushToken[revoketest]';
    const deviceId = 'dev_revoke';

    await callables.registerPushDevice({
      auth: { uid: 'user_rev' },
      data: { expoPushToken: token, deviceId, platform: 'ios' },
    });

    const res = await callables.revokePushDevice({
      auth: { uid: 'user_rev' },
      data: { deviceId },
    });
    expect(res.success).toBe(true);

    const devicePath = 'users/user_rev/devices/dev_revoke';
    expect(firestore.data[devicePath].status).toBe('detached');
  });

  test('revokePushDevice skips revocation if concurrent registration updated tokenHash', async () => {
    const token1 = 'ExpoPushToken[token1]';
    const deviceId = 'dev_conc';
    const uid = 'user_conc';

    await callables.registerPushDevice({
      auth: { uid },
      data: { expoPushToken: token1, deviceId, platform: 'ios' },
    });

    const devicePath = `users/${uid}/devices/${deviceId}`;

    // Intercept transaction to simulate concurrent token update
    const originalRunTx = firestore.runTransaction.bind(firestore);
    firestore.runTransaction = async (fn) => {
      // Mutate state concurrently before transaction body runs
      firestore.data[devicePath].tokenHash = 'new_hash_from_concurrent_register';
      return originalRunTx(fn);
    };

    const res = await callables.revokePushDevice({
      auth: { uid },
      data: { deviceId },
    });
    expect(res.success).toBe(true);

    // Device should remain active (not detached) because token changed concurrently
    expect(firestore.data[devicePath].status).toBe('active');
  });

  test('pollExpoReceiptsHandler respects CI_DISABLE_EXTERNAL_NOTIFICATIONS guard', async () => {
    process.env.CI_DISABLE_EXTERNAL_NOTIFICATIONS = 'true';
    global.fetch = jest.fn();

    const res = await pollExpoReceiptsHandler({ firestore, logger });
    expect(res).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('pollExpoReceiptsHandler fetches receipts and updates unregistered devices when guard disabled', async () => {
    process.env.CI_DISABLE_EXTERNAL_NOTIFICATIONS = 'false';
    const uid = 'user_poll';
    const deviceId = 'dev_poll';
    const token = 'ExpoPushToken[poll_test]';

    await callables.registerPushDevice({
      auth: { uid },
      data: { expoPushToken: token, deviceId, platform: 'android' },
    });

    const devicePath = `users/${uid}/devices/${deviceId}`;
    const initialData = firestore.data[devicePath];

    // Seed notification log
    firestore.data['notification_logs/log_123'] = {
      pendingReceipts: true,
      ticketMap: {
        ticket_123: { userId: uid, deviceId, tokenHash: initialData.tokenHash },
      },
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          ticket_123: {
            status: 'error',
            details: { error: 'DeviceNotRegistered' },
          },
        },
      }),
    });

    const res = await pollExpoReceiptsHandler({ firestore, logger });
    expect(res.polledLogs).toBe(1);
    expect(firestore.data[devicePath].status).toBe('unregistered');
  });

  test('cleanupInactiveDevicesHandler removes records older than 30 days with pagination', async () => {
    const oldDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);

    // Seed 405 stale devices to trigger pagination
    for (let i = 0; i < 405; i++) {
      firestore.data[`users/u_pag/devices/d_${i}`] = {
        status: 'detached',
        updatedAt: oldDate,
      };
    }

    const res = await cleanupInactiveDevicesHandler({ firestore, logger });
    expect(res.deletedCount).toBe(405);

    // Verify all deleted
    const remaining = Object.keys(firestore.data).filter((k) => k.includes('/devices/'));
    expect(remaining.length).toBe(0);
  });

  test('sendExpoPush retries on HTTP 429', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        status: 429,
        headers: { get: () => '1' },
      })
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({ data: [{ status: 'ok' }] }),
      });

    global.fetch = fetchMock;

    const res = await sendExpoPush({
      payload: [{ to: 'token', title: 'test' }],
      headers: { 'Content-Type': 'application/json' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toBe(200);
  });
});
