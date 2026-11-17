# Firestore Rules security deployment: profile provisioning and child data

This document defines the production dependency for the Firestore Rules in
`firestore.rules`. It applies to the rules-hardening increment only; it does
not deploy anything by itself.

## Security model

- Client SDKs cannot create `/users/{uid}` documents.
- A blocking Firebase Authentication `beforeUserCreated` function provisions
  the initial profile with the Admin SDK. Safe defaults are `role: "parent"`
  and `approved: false`.
- The client cannot add, remove, or change `role` or `approved`.
- A driver becomes an approved driver only through a trusted backend/admin
  operation that validates the request and writes with the Admin SDK.
- A client may remove existing child-data fields for data minimization, but it
  cannot add or modify them. Writes from the Admin SDK and trusted Functions
  bypass Firestore Security Rules.

## Required production components

### 1. Blocking identity trigger

Deploy a Firebase Functions v2 identity trigger based on
`beforeUserCreated` before deploying the new rules. It must:

1. Derive the UID and email/display name from the authenticated identity
   event, never from client-provided profile data.
2. Create `/users/{uid}` with the Admin SDK in a transaction.
3. Set `role: "parent"` and `approved: false` unconditionally.
4. Not overwrite an existing profile.
5. Fail the Auth user creation when provisioning fails, so an Auth account
   cannot be committed without its profile.

The trigger implementation exists in backup commit
`0cc2dcf2e76804f1ff4b98d8b8020ac3931774f4`, but it is intentionally not part
of this Firestore Rules increment. It must be reviewed and integrated in the
next Functions increment.

### 2. Trusted role and approval operation

The production backend must provide an Admin-SDK-only operation to promote a
verified account to `role: "driver"` and to set `approved: true`. No callable,
REST endpoint, or client write may accept these fields directly from the
caller. Authorization, auditability, and any required human approval must be
enforced by that backend operation.

### 3. Application changes

The application must stop creating `/users/{uid}` from the client after Auth
registration. It must instead rely on the blocking identity trigger and load
the server-created profile. The current registration implementation in
`src/context/AuthContext.js` is incompatible with the new rule and must be
changed in the application increment.

The current parent profile screen writes `childrenCount`, `childrenNames`,
`childrenAges`, and `school` directly from the client. Those writes are
intentionally blocked by the privacy containment rule. The application/backend
increment must route this data through a trusted, consent-aware flow before the
new rules are released to production.

Driver selection in the current registration screen cannot be honored by the
safe-default trigger. Registration must provision every account as a parent;
driver access requires the trusted role/approval operation described above.

## Deployment order

Do not deploy the new rules as a standalone Firestore release.

1. Review and deploy the blocking `beforeUserCreated` identity trigger.
2. Deploy the trusted driver approval operation and verify its authorization
   and audit behavior.
3. Release an application/backend version that removes client profile creation
   and moves child-data writes to a trusted consent-aware flow.
4. Verify registration in staging: Auth creation succeeds, exactly one profile
   is provisioned, `role` is `parent`, and `approved` is `false`.
5. Verify that a client cannot create a profile, change `role`, change
   `approved`, or add/modify child-data fields.
6. Deploy `firestore.rules` to production only after steps 1-5 pass.
7. Keep the previous rules release available for rollback and monitor Auth
   creation errors and missing-profile incidents after release.

Deploying the new rules before the identity trigger would cause current client
registration to fail with a Firestore permission error. Deploying the rules
while the old client still writes child data would cause the parent profile
completion flow to fail.

## Validation

Run the Firestore Rules suite against the local emulator:

```bash
npm run test:rules
```

The suite covers unauthorized profile reads/writes, client role and approval
escalation, child-data containment, match ownership, and access to
`matches/{matchId}/tracking/current`.
