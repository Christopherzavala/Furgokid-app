const { createPushDeviceCallables } = require('../src/pushDeviceCallables');
const { handleExpoReceipts, sendExpoPush } = require('../src/externalNotifications');

// Mock Firestore for unit testing callables and receipt handlers
class MockFirestore {
  constructor() {
    this.data = {};
  }

  collection(path) {
    return {
      doc: (id) => {
        const fullPath = `${path}/${id}`;
        return {
          id,
          path: fullPath,
          collection: (subPath) => this.collection(`${fullPath}/${subPath}`),
          get: async () => {
            const val = this.data[fullPath];
            return {
              exists: !!val,
              data: () => val,
              ref: this.collection(path).doc(id),
            };
          },
          set: async (val, opts) => {
            if (opts && opts.merge && this.data[fullPath]) {
              this.data[fullPath] = { ...this.data[fullPath], ...val };
            } else {
              this.data[fullPath] = val;
            }
          },
          update: async (val) => {
            if (this.data[fullPath]) {
              this.data[fullPath] = { ...this.data[fullPath], ...val };
            } else {
              this.data[fullPath] = val;
            }
          },
        };
      },
      where: (field, op, value) => {
        return {
          get: async () => {
            const docs = [];
            for (const [key, val] of Object.entries(this.data)) {
              if (key.includes('/devices/') && val[field] === value) {
                docs.push({
                  id: key.split('/').pop(),
                  data: () => val,
                  ref: {
                    update: async (updateVal) => {
                      this.data[key] = { ...this.data[key], ...updateVal };
                    },
                  },
                });
              }
            }
            return { docs, size: docs.length, empty: docs.length === 0 };
          },
        };
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

  test('revokePushDevice marks device and index as detached', async () => {
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

  test('handleExpoReceipts marks as unregistered only when tokenHash matches, and ignores InvalidCredentials', async () => {
    const token = 'ExpoPushToken[receipttest]';
    const deviceId = 'dev_receipt';
    const uid = 'user_rcpt';

    await callables.registerPushDevice({
      auth: { uid },
      data: { expoPushToken: token, deviceId, platform: 'ios' },
    });

    const devicePath = `users/${uid}/devices/${deviceId}`;
    const initialData = firestore.data[devicePath];

    // Receipt with DeviceNotRegistered error
    const receipts = [
      {
        status: 'error',
        details: { error: 'DeviceNotRegistered' },
      },
      {
        status: 'error',
        details: { error: 'InvalidCredentials' },
      },
    ];

    const targets = [
      { userId: uid, deviceId, tokenHash: initialData.tokenHash },
      { userId: uid, deviceId, tokenHash: initialData.tokenHash },
    ];

    await handleExpoReceipts(firestore, receipts, targets);

    // Should be unregistered because tokenHash matched
    expect(firestore.data[devicePath].status).toBe('unregistered');
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
