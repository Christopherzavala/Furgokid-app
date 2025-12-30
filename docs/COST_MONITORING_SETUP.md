# Firebase Cost Monitoring Setup

## Overview

Monitoring Firebase costs is critical to prevent unexpected bills. This guide covers setting up budget alerts and quota monitoring.

## 1. Firebase Budget Alerts

### Setup in Firebase Console

1. **Navigate to Project Settings**

   ```
   Firebase Console → Your Project → Project Settings → Usage and Billing
   ```

2. **Set Budget Alerts**

   - Click "Set budget alerts"
   - Set monthly budget: **$50** (adjust based on your needs)
   - Add alert thresholds:
     - 50% of budget ($25)
     - 75% of budget ($37.50)
     - 90% of budget ($45)
     - 100% of budget ($50)

3. **Add Email Recipients**
   - Add your email address
   - Add team emails for critical alerts

### Recommended Budget Breakdown

| Service          | Monthly Budget | Alert Threshold |
| ---------------- | -------------- | --------------- |
| Firestore        | $20            | 80% ($16)       |
| Firebase Storage | $5             | 80% ($4)        |
| Firebase Auth    | Free tier      | N/A             |
| Cloud Functions  | $10            | 80% ($8)        |
| Firebase Hosting | $5             | 80% ($4)        |
| Google Maps API  | $10            | 80% ($8)        |
| **TOTAL**        | **$50**        | **$40**         |

## 2. Firestore Quota Monitoring

### Key Quotas to Monitor

```javascript
// Daily Quotas (Free Tier)
const FIRESTORE_QUOTAS = {
  reads: 50000, // 50K reads/day
  writes: 20000, // 20K writes/day
  deletes: 20000, // 20K deletes/day
  storage: 1024, // 1GB storage
};

// Per-second limits
const FIRESTORE_RATE_LIMITS = {
  writes_per_second: 1, // Max 1 write/sec per document
  deletes_per_second: 1, // Max 1 delete/sec per document
};
```

### Cloud Function for Quota Monitoring

Create `functions/monitorQuotas.js`:

\`\`\`javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.monitorFirestoreQuotas = functions.pubsub
.schedule('every 1 hours')
.onRun(async (context) => {
const db = admin.firestore();

    // Get usage stats (requires Firebase Admin SDK)
    const stats = await db.collection('_usage').doc('firestore').get();
    const usage = stats.data();

    const quotas = {
      reads: { limit: 50000, used: usage.reads || 0 },
      writes: { limit: 20000, used: usage.writes || 0 },
      storage: { limit: 1024, used: usage.storage || 0 },
    };

    // Check if approaching limits (80%)
    Object.keys(quotas).forEach(metric => {
      const { limit, used } = quotas[metric];
      const percentage = (used / limit) * 100;

      if (percentage > 80) {
        console.warn(\`⚠️  \${metric} quota at \${percentage.toFixed(1)}%\`);
        // Send alert email or push notification
        sendAlert(\`Firestore \${metric} quota warning\`, {
          metric,
          used,
          limit,
          percentage
        });
      }
    });

    return null;

});

function sendAlert(title, data) {
// Implement email/SMS alert
// Use SendGrid, Twilio, or Firebase Cloud Messaging
console.log(\`ALERT: \${title}\`, data);
}
\`\`\`

## 3. Google Maps API Monitoring

### Setup Quota Alerts

1. **Google Cloud Console**

   ```
   https://console.cloud.google.com/apis/dashboard
   ```

2. **Set Quotas**

   - Select "Maps JavaScript API"
   - Click "Quotas"
   - Set daily quota: **10,000 requests/day** (free tier: 28,000/month)

3. **Enable Billing Alerts**
   - Set budget: **$10/month**
   - Alert at: 50%, 80%, 100%

### Request Optimization

```javascript
// Client-side rate limiting
const MAPS_RATE_LIMIT = {
  requests_per_minute: 300, // Adjust based on your quota
  daily_quota: 10000,
};

// Track usage
let mapsRequestCount = 0;
let lastReset = Date.now();

function trackMapsRequest() {
  const now = Date.now();

  // Reset counter every day
  if (now - lastReset > 86400000) {
    mapsRequestCount = 0;
    lastReset = now;
  }

  mapsRequestCount++;

  if (mapsRequestCount > MAPS_RATE_LIMIT.daily_quota * 0.9) {
    console.warn('⚠️  Approaching Maps API daily quota');
  }
}
```

## 4. AdMob Revenue Tracking

### Setup AdMob API

```bash
# Install AdMob API client
npm install @google-cloud/admob
```

### Revenue Monitoring Script

Create `scripts/admob-revenue-check.js`:

\`\`\`javascript
const { AdMobApiClient } = require('@google-cloud/admob');

async function checkAdMobRevenue() {
const client = new AdMobApiClient({
credentials: require('../admob-service-account.json')
});

const publisherId = 'pub-6159996738450051';
const today = new Date().toISOString().split('T')[0];

const report = await client.generateNetworkReport({
parent: \`accounts/\${publisherId}\`,
reportSpec: {
dateRange: {
startDate: { year: 2025, month: 1, day: 1 },
endDate: { year: 2025, month: 12, day: 31 }
},
dimensions: ['DATE', 'AD_UNIT'],
metrics: ['ESTIMATED_EARNINGS', 'IMPRESSIONS', 'CLICKS'],
}
});

console.log('AdMob Revenue Report:', report);

// Alert if revenue drops significantly
const avgDailyRevenue = calculateAverage(report);
if (todayRevenue < avgDailyRevenue \* 0.5) {
sendAlert('AdMob revenue drop detected');
}
}
\`\`\`

## 5. Cost Dashboard (Recommended)

### Option A: Google Cloud Monitoring

1. **Create Custom Dashboard**

   ```
   Google Cloud Console → Monitoring → Dashboards → Create Dashboard
   ```

2. **Add Charts**
   - Firebase Firestore: Reads/Writes
   - Firebase Storage: Bandwidth
   - Cloud Functions: Invocations
   - Maps API: Requests

### Option B: Third-Party Tools

- **Datadog**: Real-time cost monitoring
- **CloudHealth**: Multi-cloud cost optimization
- **Grafana**: Self-hosted dashboards

## 6. Automated Cost Alerts

### Email Alerts Template

\`\`\`javascript
// functions/costAlerts.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
service: 'gmail',
auth: {
user: process.env.ALERT_EMAIL,
pass: process.env.ALERT_PASSWORD,
},
});

async function sendCostAlert(service, amount, threshold) {
await transporter.sendMail({
from: 'alerts@furgokid.app',
to: 'admin@furgokid.app',
subject: \`⚠️ Cost Alert: \${service}\`,
html: \`
<h2>Cost Alert</h2>
<p><strong>Service:</strong> \${service}</p>
<p><strong>Current Cost:</strong> $\${amount}</p>
<p><strong>Threshold:</strong> $\${threshold}</p>
<p><strong>Action Required:</strong> Review usage and optimize if needed.</p>
\`
});
}
\`\`\`

## 7. Checklist

### Immediate Setup (5 min)

- [ ] Set Firebase budget alert ($50/month)
- [ ] Add email recipients for alerts
- [ ] Enable Google Cloud Billing alerts

### Short-term (1 hour)

- [ ] Deploy quota monitoring Cloud Function
- [ ] Set up Maps API quota limits
- [ ] Configure AdMob API access

### Long-term (ongoing)

- [ ] Review cost reports weekly
- [ ] Optimize high-usage endpoints
- [ ] Implement client-side rate limiting
- [ ] Monitor revenue vs. costs ratio

## 8. Cost Optimization Tips

### Firestore

- Use offline persistence (reduces reads)
- Batch writes when possible
- Index only necessary fields
- Delete old/unused data

### Storage

- Compress images before upload
- Use CDN for static assets
- Delete temporary files

### Cloud Functions

- Use minimum memory allocation
- Set max instances limit
- Implement caching

### Maps API

- Cache map tiles locally
- Use static maps for non-interactive views
- Limit zoom levels

## 9. Emergency Cost Reduction

If costs spike unexpectedly:

1. **Immediate Actions**

   ```bash
   # Disable expensive features
   - Pause background location tracking
   - Disable real-time updates
   - Switch to cached data
   ```

2. **Identify Source**

   ```
   Google Cloud Console → Billing → Reports
   Filter by: Service, Time Range
   ```

3. **Mitigation**
   - Rate limit abusive users
   - Deploy hotfix with optimizations
   - Contact Firebase support if suspected billing error

## 10. Monitoring Dashboard URLs

**Bookmark these:**

- Firebase Console: https://console.firebase.google.com
- Google Cloud Billing: https://console.cloud.google.com/billing
- AdMob Dashboard: https://apps.admob.com
- Maps API Quotas: https://console.cloud.google.com/apis/api/maps-backend.googleapis.com/quotas

---

**Last Updated**: December 30, 2025  
**Next Review**: Monthly cost review
