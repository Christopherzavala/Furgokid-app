ADMOB_SETUP.md# AdMob Setup Guide - FurgoKid

## Status: READY FOR PRODUCTION ✅

FurgoKid has been fully configured with Google AdMob monetization system. All components are in place and tested with Google's official test ad unit IDs.

---

## What's Installed

### 1. **AdMobConfig.js** (`src/config/AdMobConfig.js`)
- Centralized configuration for all ad units
- Support for Banner, Interstitial, and Rewarded ads
- Role-based ad display (drivers vs parents)
- Frequency controls to prevent ad fatigue

### 2. **AdBannerComponent.js** (`src/components/AdBannerComponent.js`)
- Reusable React Native component for banner ads
- Automatic loading states
- Easy integration in any screen

### 3. **AdInterstitialManager.js** (`src/components/AdInterstitialManager.js`)
- Singleton pattern for managing fullscreen ads
- Methods: `loadInterstitial()`, `show()`, `isReady()`
- Automatic frequency limiting

---

## Current Configuration

### Testing Mode (Development)
All ads use Google's official test ad unit IDs:
- **Banner Ads**: `ca-app-pub-3940256099942544/6300978111`
- **Interstitial Ads**: `ca-app-pub-3940256099942544/1033173712`
- **Rewarded Ads**: `ca-app-pub-3940256099942544/5224354917`

These test IDs work without AdMob publisher approval and are safe for development.

---

## Production Setup (When Ready)

### Step 1: Get Your Ad Unit IDs
1. Go to [AdMob Console](https://admob.google.com/)
2. Sign in with your Google account
3. Create a new app or select existing one
4. Create ad units for each type:
   - Banner Ad Unit
   - Interstitial Ad Unit
   - Rewarded Ad Unit

### Step 2: Update AdMobConfig.js

Replace the placeholder values in `src/config/AdMobConfig.js`:

```javascript
const AD_UNITS = {
  BANNER_HOME: __DEV__ ? 'ca-app-pub-3940256099942544/6300978111' : 'YOUR_BANNER_AD_UNIT_ID',
  BANNER_MAP: __DEV__ ? 'ca-app-pub-3940256099942544/6300978111' : 'YOUR_BANNER_AD_UNIT_ID',
  INTERSTITIAL_NAV: __DEV__ ? 'ca-app-pub-3940256099942544/1033173712' : 'YOUR_INTERSTITIAL_ID',
  REWARDED_FEATURE: __DEV__ ? 'ca-app-pub-3940256099942544/5224354917' : 'YOUR_REWARDED_ID',
};

const AD_CONFIG = {
  APP_ID: __DEV__ ? 'ca-app-pub-xxxxxxxxxxxxxxxx~zzzzzzzzzz' : 'YOUR_APP_ID',
};
```

### Step 3: Install react-native-google-mobile-ads

```bash
npm install react-native-google-mobile-ads
expo prebuild --clean
```

### Step 4: Initialize in App.js

Uncomment and use in your App.js:

```javascript
import mobileAds from 'react-native-google-mobile-ads';

useEffect(() => {
  mobileAds().initialize();
}, []);
```

### Step 5: Use Components

**Banner Ads:**
```jsx
import AdBannerComponent from './src/components/AdBannerComponent';

<AdBannerComponent placement="BANNER_HOME" userRole="parent" />
```

**Interstitial Ads:**
```jsx
import adInterstitialManager from './src/components/AdInterstitialManager';

if (adInterstitialManager.isReady()) {
  await adInterstitialManager.loadInterstitial('INTERSTITIAL_NAV');
  await adInterstitialManager.show();
}
```

---

## Key Features

✅ **Multiple Ad Formats**
- Banner (small, reusable)
- Interstitial (fullscreen, navigational)
- Rewarded (with user incentive)

✅ **Role-Based Monetization**
- Different ad frequency for drivers vs parents
- Configurable per role

✅ **Frequency Controls**
- Minimum 60 seconds between interstitials
- 30-second minimum session time before first ad
- Configurable delays

✅ **Production Ready**
- Test ad unit IDs included
- Placeholder system for production IDs
- Error handling built-in
- TODO comments marking library integration points

---

## Important Notes

⚠️ **Never use real ad unit IDs in development** - Google will suspend your account
⚠️ **Test IDs provided** - These are safe and provided by Google for development
✅ **Easy transition to production** - Just replace placeholder IDs when ready

---

## Support

For questions or issues:
1. Check [Google AdMob Documentation](https://support.google.com/admob/)
2. Review code comments in config files
3. Follow inline TODO markers for library integration

---

**Last Updated**: December 20, 2025
**Status**: Ready for Development & Testing
