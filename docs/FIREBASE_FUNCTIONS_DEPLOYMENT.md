# 🚀 Firebase Functions - Deployment Guide

**Análisis Big Tech: Zero-Downtime Backend Implementation**

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Local Testing](#local-testing)
4. [Deployment Process](#deployment-process)
5. [Monitoring & Rollback](#monitoring--rollback)
6. [Cost Analysis](#cost-analysis)

---

## 🏗️ Architecture Overview

### **Current Architecture (Pre-Functions)**

```
┌─────────────────┐
│  React Native   │
│   Expo App      │
└────────┬────────┘
         │
         │ Firebase SDK
         │
    ┌────▼─────┐
    │ Firebase │
    │ Services │
    │  - Auth  │
    │  - Store │
    │  - Logs  │
    └──────────┘
```

### **New Architecture (With Functions)**

```
┌─────────────────┐
│  React Native   │
│   Expo App      │
└────────┬────────┘
         │
         │ Firebase SDK
         │
    ┌────▼─────┐          ┌────────────────┐
    │ Firebase │◄────────►│ Cloud Functions│
    │ Services │  triggers│  - onCreate    │
    │  - Auth  │          │  - Expo Push   │
    │  - Store │          │  - Analytics   │
    │  - Logs  │          └────────────────┘
    └──────────┘
```

### **Integration Points**

1. **ParentRequestScreen.js:62** → `requests/{requestId}` → `notifyDriversNewRequest`
2. **DriverVacancyScreen.js:90** → `vacancies/{vacancyId}` → `notifyParentsNewVacancy`

---

## ✅ Pre-Deployment Checklist

### **1. Dependencies Installation**

```powershell
# Navigate to functions directory
cd functions

# Install dependencies
npm install

# Verify package.json
cat package.json
```

**Expected Output:**

```json
{
  "dependencies": {
    "firebase-admin": "^11.8.0",
    "firebase-functions": "^4.3.1"
  }
}
```

### **2. Environment Variables (Optional v1.1)**

```powershell
# For future SendGrid integration
firebase functions:config:set sendgrid.key="YOUR_KEY"
```

### **3. Firebase Project Validation**

```powershell
# Check current project
firebase use

# Should output: furgokid (current)
```

### **4. Firestore Rules Update (Security)**

Add read access for notification logs:

```javascript
// firestore.rules
match /notification_logs/{logId} {
  allow read: if request.auth != null;
  allow write: if false; // Only Functions can write
}

match /notification_errors/{errorId} {
  allow read: if request.auth != null;
  allow write: if false;
}
```

Deploy rules:

```powershell
firebase deploy --only firestore:rules
```

---

## 🧪 Local Testing

### **Phase 1: Install Emulators**

```powershell
# Install Firebase emulators (one-time)
npm install -g firebase-tools

# Initialize emulators
firebase init emulators
```

**Select:**

- ✅ Firestore Emulator
- ✅ Functions Emulator
- ✅ Authentication Emulator

**Ports:**

- Firestore: 8080
- Functions: 5001
- Auth: 9099

### **Phase 2: Start Emulators**

```powershell
# From project root
firebase emulators:start

# Expected output:
# ┌─────────────┬────────────────┬─────────────────────────────────┐
# │ Emulator    │ Host:Port      │ View in Emulator Suite          │
# ├─────────────┼────────────────┼─────────────────────────────────┤
# │ Functions   │ localhost:5001 │ http://localhost:4000/functions │
# │ Firestore   │ localhost:8080 │ http://localhost:4000/firestore │
# └─────────────┴────────────────┴─────────────────────────────────┘
```

### **Phase 3: Test onCreate Triggers**

**Test 1: New Request Notification**

```javascript
// In Emulator UI (http://localhost:4000/firestore)
// Add document to `requests` collection:
{
  "parentId": "test-parent-123",
  "parentName": "María García",
  "zone": "Norte",
  "school": "Colegio San José",
  "schedule": "Entrada",
  "childrenCount": 2,
  "status": "active"
}
```

**Expected Console Output:**

```
🚨 NEW REQUEST: <requestId> | Parent: María García | Zone: Norte
   Found 3 drivers in Norte
   Prepared 2 notifications
   ✅ Notifications sent in 234ms
```

**Test 2: New Vacancy Notification**

```javascript
// Add document to `vacancies` collection:
{
  "driverId": "test-driver-456",
  "driverName": "Juan Pérez",
  "zone": "Norte",
  "schedule": "Entrada",
  "availableSeats": 3,
  "schools": ["Colegio San José", "Liceo Central"],
  "status": "active"
}
```

**Expected Console Output:**

```
🚐 NEW VACANCY: <vacancyId> | Driver: Juan Pérez | Zone: Norte
   Found 5 requests in Norte
   Prepared 3 notifications (schedule match)
   ✅ Notifications sent in 187ms
```

### **Phase 4: Test HTTP Endpoint**

```powershell
# Test notification endpoint
curl -X POST http://localhost:5001/furgokid/us-central1/testNotification `
  -H "Content-Type: application/json" `
  -d '{"pushToken":"ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]","message":"Test from emulator"}'
```

**Expected Response:**

```json
{
  "success": true,
  "result": {
    "data": [
      {
        "status": "ok",
        "id": "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
      }
    ]
  }
}
```

---

## 🚀 Deployment Process

### **Phase 1: Pre-Deployment Validation**

```powershell
# Run linter
cd functions
npm run lint

# Expected: No errors
```

### **Phase 2: Deploy Functions**

```powershell
# From project root
firebase deploy --only functions

# Expected output:
# ✔  functions[notifyDriversNewRequest(us-central1)] Successful create operation.
# ✔  functions[notifyParentsNewVacancy(us-central1)] Successful create operation.
# ✔  functions[sendWelcomeEmail(us-central1)] Successful create operation.
# ✔  functions[testNotification(us-central1)] Successful update operation.
#
# ✔  Deploy complete!
```

**Deployment Time:** ~2-3 minutes

### **Phase 3: Verify Deployment**

```powershell
# List deployed functions
firebase functions:list

# Expected output:
# notifyDriversNewRequest(us-central1)
# notifyParentsNewVacancy(us-central1)
# sendWelcomeEmail(us-central1)
# testNotification(us-central1)
```

### **Phase 4: Production Test**

1. **Open Firebase Console** → Functions → Logs
2. **Create test request** in production app
3. **Verify logs** show trigger execution
4. **Check push notification** received on device

**Expected Log Entry:**

```
🚨 NEW REQUEST: abc123 | Parent: Test User | Zone: Norte
   Found 2 drivers in Norte
   Prepared 2 notifications
   ✅ Notifications sent in 456ms
```

---

## 📊 Monitoring & Rollback

### **Real-Time Monitoring**

**1. Firebase Console Logs**

```
Firebase Console → Functions → Logs
Filter: "NEW REQUEST" or "NEW VACANCY"
```

**2. Notification Success Logs**

```javascript
// Query notification_logs collection
db.collection('notification_logs').orderBy('timestamp', 'desc').limit(10).get();
```

**Expected Data:**

```json
{
  "type": "new_request",
  "requestId": "abc123",
  "driversNotified": 3,
  "success": true,
  "duration": 234,
  "timestamp": "2025-01-15T10:30:00Z"
}
```

**3. Error Logs**

```javascript
// Query notification_errors collection
db.collection('notification_errors').orderBy('timestamp', 'desc').limit(10).get();
```

### **KPIs to Monitor**

| Metric                      | Target | Alert If |
| --------------------------- | ------ | -------- |
| Notification Delivery Rate  | >90%   | <85%     |
| Average Latency             | <1s    | >3s      |
| Error Rate                  | <1%    | >5%      |
| Cost per 1000 notifications | <$0.10 | >$0.20   |

### **Rollback Strategy**

**Scenario 1: Functions causing errors**

```powershell
# Disable specific function
firebase functions:delete notifyDriversNewRequest --force

# App continues working (graceful degradation)
# Users just don't get push notifications
```

**Scenario 2: Complete rollback**

```powershell
# Delete all functions
firebase functions:delete notifyDriversNewRequest --force
firebase functions:delete notifyParentsNewVacancy --force
firebase functions:delete sendWelcomeEmail --force
firebase functions:delete testNotification --force
```

**Recovery Time:** <2 minutes

**Impact:** Zero (app continues working without push notifications)

---

## 💰 Cost Analysis

### **Pricing Model (Firebase Functions)**

- **Invocations:** $0.40 per million
- **Compute Time (GB-sec):** $0.0000025 per GB-sec
- **Networking (Egress):** $0.12 per GB

### **FurgoKid Estimates (1000 users)**

**Assumptions:**

- 50 requests/day
- 50 vacancies/day
- 3 notifications per trigger (average)
- 500ms execution time per function

**Monthly Calculations:**

| Resource          | Usage                | Cost             |
| ----------------- | -------------------- | ---------------- |
| Invocations       | 100 x 30 = 3,000     | $0.0012          |
| Compute Time      | 3,000 x 0.5s x 256MB | $0.096           |
| Egress (Expo API) | 3,000 x 1KB          | $0.0003          |
| **TOTAL**         |                      | **~$0.10/month** |

### **Scaling (10,000 users)**

- 500 requests/day + 500 vacancies/day
- 30,000 invocations/month
- **Estimated cost: ~$1.00/month**

### **Free Tier Coverage**

Firebase Free Tier includes:

- 2 million invocations/month ✅
- 400,000 GB-sec compute time ✅
- 5GB egress/month ✅

**Conclusion:** FurgoKid stays within free tier until ~100,000 daily active users

---

## 🔐 Security Considerations

### **1. Function Authorization**

```javascript
// Only authenticated users can trigger notifications
// (onCreate triggers run server-side, no auth needed)
```

### **2. Push Token Validation**

```javascript
// Validate Expo push token format
const isValidPushToken = (token) => {
  return token && token.startsWith('ExponentPushToken[');
};
```

### **3. Rate Limiting (v1.1)**

```javascript
// Prevent notification spam
// TODO: Add Firestore-based rate limiting
```

---

## 📚 Troubleshooting

### **Problem 1: Function not triggering**

**Symptoms:** No logs in Firebase Console after creating request/vacancy

**Solution:**

```powershell
# Check function deployment
firebase functions:list

# Check Firestore security rules allow writes
firebase firestore:rules get

# Verify onCreate trigger path matches collection name
# functions/index.js:
# .document('requests/{requestId}')  # Must match exactly
```

### **Problem 2: Push notifications not received**

**Symptoms:** Logs show "Prepared 0 notifications"

**Solution:**

```javascript
// Check pushToken exists in user profile
db.collection('users').doc(userId).get()

// Verify pushToken format
// Should be: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]

// Test with HTTP endpoint
curl -X POST <function-url>/testNotification \
  -d '{"pushToken":"<token>","message":"test"}'
```

### **Problem 3: High latency (>3s)**

**Symptoms:** Slow notification delivery

**Solution:**

```javascript
// Optimize Firestore queries
// Add composite index for zone + role
// Firebase Console → Firestore → Indexes

// Index: users
// Fields: zone (Ascending), role (Ascending)
```

---

## 🎯 Next Steps (v1.1)

1. **Email notifications** via SendGrid
2. **Rate limiting** to prevent spam
3. **Rich notifications** with images
4. **Notification preferences** (in-app toggle)
5. **A/B testing** for message effectiveness

---

## 📞 Support

**Firebase Console:** https://console.firebase.google.com/project/furgokid
**Functions Dashboard:** Firebase Console → Functions
**Logs:** Firebase Console → Functions → Logs
**Cost Tracking:** Firebase Console → Usage and billing

---

**Deployed by:** GitHub Copilot (Big Tech Analysis)  
**Date:** 2025-01-15  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
