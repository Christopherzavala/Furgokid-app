# Trusted profile provisioning and driver approval

## Profile provisioning guarantee

`functions/src/userProfileTrigger.js` exports the Firebase Identity
`beforeUserCreated` blocking trigger. A valid Auth signup is committed only after
the backend creates `users/{uid}` with these safe defaults:

- `role: "parent"`
- `approved: false`
- server-generated `createdAt` and `updatedAt`

The document ID is the Auth UID. The trigger does not copy email, display name,
phone numbers, child data, credentials, or tokens into Firestore or logs. The
transaction is idempotent: an existing profile is never overwritten or
duplicated.

In the current mobile signup flow, `displayName` is set with `updateProfile`
after `createUserWithEmailAndPassword` resolves, so it is not available to the
trigger. The implementation therefore does not depend on trigger-time
`displayName`; the mobile client enriches the existing profile in a separate
owner-authorized update.

## Recovery

`ensureUserProfile` is an authenticated callable that can create only the
caller's missing profile with the same safe defaults. It never overwrites an
existing profile. The app reads the profile after signup and falls back to this
callable if the bounded read wait fails. A future UI increment can expose an
explicit retry action for a failed request submission.

## Driver request and approval

- `requestDriverApproval` accepts no client-supplied identity or role. The
  callable derives the UID from the verified Auth token and changes only a
  parent/unapproved profile to `driverRequestStatus: "pending"`.
- `reviewDriverRequest` accepts only `targetUid` and `decision`. It derives the
  reviewer UID from the verified Auth token and requires the reviewer profile to
  have `role: "admin"`.
- The backend rejects self-review, including self-review by an administrator.
- Valid transitions are: pending to approved or rejected, and approved to
  revoked. Repeated identical decisions are idempotent; invalid transitions
  fail closed.
- Firestore rules prevent clients from adding, removing, or changing
  `driverRequestStatus` or `driverRequestUpdatedAt`.

The administrator identity is the existing trusted-backend role
`users/{uid}.role == "admin"`. Clients cannot create `users` documents or
change `role`; only Admin SDK writes and callable backend transactions can
establish that state.

### Administrator bootstrap

Before production use, a trusted operator must assign the first administrator
out of band with Admin SDK or the Firebase console:

```js
await admin.firestore().collection('users').doc(adminUid).update({ role: 'admin' });
```

Requirements for this operation:

1. `adminUid` must be verified by the operator.
2. Run it only from an authenticated Admin SDK environment with tightly scoped
   project access.
3. Never expose an admin-assignment callable to mobile clients.
4. Audit the operator and timestamp for each role assignment.

## Deployment order

1. Deploy the Cloud Functions, including `provisionUserProfile`,
   `ensureUserProfile`, `requestDriverApproval`, and `reviewDriverRequest`.
2. Deploy the Firestore rules that forbid client profile creation and protect
   driver-request state.
3. Bootstrap the first administrator with Admin SDK.
4. Deploy the mobile client containing the bounded wait and recovery flow.
5. Verify one safe profile per new Auth UID and exercise request, approval,
   rejection, revocation, self-review denial, and duplicate-request behavior.

No remote deployment is performed by the implementation commit.

## Local validation

```bash
npm run test:rules
npm --prefix functions test -- --runInBand --coverage=false
npm run type-check
npm run lint
```

The integrated Auth/Firestore/Functions validation uses only a `demo-` project
and local emulator ports:

```bash
firebase emulators:exec --project demo-furgokid-security \
  --only auth,firestore,functions \
  "npm --prefix functions test -- --runInBand --coverage=false test/securityProvisioning.emulator.test.js"
```
