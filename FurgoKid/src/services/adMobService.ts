// AdMob Service - Sistema completo de monetización con anuncios
import mobileAds, {
    MaxAdContentRating,
    BannerAd,
    BannerAdSize,
    TestIds,
    InterstitialAd,
    RewardedAd,
    RewardedAdEventType,
    AdEventType,
} from 'react-native-google-mobile-ads';
import AsyncStorage from '@react-native-async-storage/async-storage';

// -------------------------------------------------
// CONFIGURACIÓN DE AD UNITS (reemplazar con IDs reales)
// -------------------------------------------------
const AD_UNITS = {
    android: {
        banner: __DEV__ ? TestIds.BANNER : 'ca-app-pub-XXXXX/BANNER_ID',
        interstitial: __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-XXXXX/INTERSTITIAL_ID',
        rewarded: __DEV__ ? TestIds.REWARDED : 'ca-app-pub-XXXXX/REWARDED_ID',
    },
    ios: {
        banner: __DEV__ ? TestIds.BANNER : 'ca-app-pub-XXXXX/BANNER_ID_IOS',
        interstitial: __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-XXXXX/INTERSTITIAL_ID_IOS',
        rewarded: __DEV__ ? TestIds.REWARDED : 'ca-app-pub-XXXXX/REWARDED_ID_IOS',
    },
};

// -------------------------------------------------
// CONFIGURACIÓN DE FRECUENCIA DE ANUNCIOS
// -------------------------------------------------
const FREQUENCY_CONFIG = {
    interstitial: {
        minTimeBetweenAds: 5 * 60 * 1000, // 5 minutos
        maxAdsPerDay: 10,
        actionsBeforeAd: 3, // mostrar cada 3 acciones de usuario
    },
    rewarded: {
        maxPerDay: 5,
    },
};

// -------------------------------------------------
// CLAVES DE ALMACENAMIENTO (AsyncStorage)
// -------------------------------------------------
const STORAGE_KEYS = {
    lastInterstitialTime: '@admob_last_interstitial',
    interstitialCount: '@admob_interstitial_count',
    actionsCount: '@admob_actions_count',
    rewardedCount: '@admob_rewarded_count',
    lastResetDate: '@admob_last_reset',
};

// -------------------------------------------------
// INICIALIZACIÓN DE SDK
// -------------------------------------------------
export const initializeAdMob = async (): Promise<boolean> => {
    try {
        await mobileAds().initialize();
        await mobileAds().setRequestConfiguration({
            maxAdContentRating: MaxAdContentRating.G, // contenido apto para niños
            tagForChildDirectedTreatment: true, // COPPA compliance
            tagForUnderAgeOfConsent: true, // GDPR compliance
        });
        console.log('✅ AdMob initialized');
        await resetDailyCounters();
        return true;
    } catch (e) {
        console.error('❌ Error initializing AdMob:', e);
        return false;
    }
};

// -------------------------------------------------
// HELPERS DE STORAGE
// -------------------------------------------------
const resetDailyCounters = async (): Promise<void> => {
    const today = new Date().toDateString();
    const last = await AsyncStorage.getItem(STORAGE_KEYS.lastResetDate);
    if (last !== today) {
        await AsyncStorage.multiSet([
            [STORAGE_KEYS.interstitialCount, '0'],
            [STORAGE_KEYS.rewardedCount, '0'],
            [STORAGE_KEYS.actionsCount, '0'],
            [STORAGE_KEYS.lastResetDate, today],
        ]);
    }
};

const incrementCounter = async (key: string): Promise<number> => {
    const cur = await AsyncStorage.getItem(key);
    const next = (parseInt(cur || '0') + 1).toString();
    await AsyncStorage.setItem(key, next);
    return parseInt(next);
};

const getCounter = async (key: string): Promise<number> => {
    const val = await AsyncStorage.getItem(key);
    return parseInt(val || '0');
};

// -------------------------------------------------
// BANNER ADS
// -------------------------------------------------
export const getBannerAdUnitId = (platform: 'android' | 'ios' = 'android'): string =>
    AD_UNITS[platform].banner;

// -------------------------------------------------
// INTERSTITIAL ADS
// -------------------------------------------------
let interstitialAd: InterstitialAd | null = null;
let isInterstitialLoaded = false;

export const loadInterstitialAd = (platform: 'android' | 'ios' = 'android'): void => {
    const adUnitId = AD_UNITS[platform].interstitial;
    interstitialAd = InterstitialAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: false,
    });
    interstitialAd.addAdEventListener(AdEventType.LOADED, () => {
        isInterstitialLoaded = true;
        console.log('✅ Interstitial loaded');
    });
    interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
        isInterstitialLoaded = false;
        loadInterstitialAd(platform); // preload next
    });
    interstitialAd.load();
};

export const canShowInterstitial = async (): Promise<boolean> => {
    if (!isInterstitialLoaded || !interstitialAd) return false;
    const daily = await getCounter(STORAGE_KEYS.interstitialCount);
    if (daily >= FREQUENCY_CONFIG.interstitial.maxAdsPerDay) return false;
    const last = await AsyncStorage.getItem(STORAGE_KEYS.lastInterstitialTime);
    if (last && Date.now() - parseInt(last) < FREQUENCY_CONFIG.interstitial.minTimeBetweenAds)
        return false;
    const actions = await getCounter(STORAGE_KEYS.actionsCount);
    if (actions < FREQUENCY_CONFIG.interstitial.actionsBeforeAd) return false;
    return true;
};

export const showInterstitialAd = async (): Promise<boolean> => {
    if (!(await canShowInterstitial())) return false;
    try {
        await interstitialAd?.show();
        await AsyncStorage.setItem(STORAGE_KEYS.lastInterstitialTime, Date.now().toString());
        await incrementCounter(STORAGE_KEYS.interstitialCount);
        await AsyncStorage.setItem(STORAGE_KEYS.actionsCount, '0'); // reset actions
        console.log('✅ Interstitial shown');
        return true;
    } catch (e) {
        console.error('❌ Error showing interstitial:', e);
        return false;
    }
};

// -------------------------------------------------
// REWARDED ADS
// -------------------------------------------------
let rewardedAd: RewardedAd | null = null;
let isRewardedLoaded = false;

export const loadRewardedAd = (platform: 'android' | 'ios' = 'android'): void => {
    const adUnitId = AD_UNITS[platform].rewarded;
    rewardedAd = RewardedAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: false,
    });
    rewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
        isRewardedLoaded = true;
        console.log('✅ Rewarded loaded');
    });
    rewardedAd.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
        console.log('🎁 Reward earned:', reward);
    });
    rewardedAd.load();
};

export const canShowRewardedAd = async (): Promise<boolean> => {
    if (!isRewardedLoaded || !rewardedAd) return false;
    const daily = await getCounter(STORAGE_KEYS.rewardedCount);
    if (daily >= FREQUENCY_CONFIG.rewarded.maxPerDay) return false;
    return true;
};

export const showRewardedAd = async (
    onRewarded: (reward: { type: string; amount: number }) => void
): Promise<boolean> => {
    if (!(await canShowRewardedAd())) return false;
    return new Promise((resolve) => {
        const earned = rewardedAd?.addAdEventListener(
            RewardedAdEventType.EARNED_REWARD,
            (reward) => {
                onRewarded(reward);
                incrementCounter(STORAGE_KEYS.rewardedCount);
                earned?.();
                resolve(true);
            }
        );
        const closed = rewardedAd?.addAdEventListener(AdEventType.CLOSED, () => {
            isRewardedLoaded = false;
            loadRewardedAd(); // preload next
            closed?.();
            resolve(false);
        });
        rewardedAd?.show();
    });
};

// -------------------------------------------------
// TRACK USER ACTION (increment & possibly show interstitial)
// -------------------------------------------------
export const trackUserAction = async (): Promise<number> => {
    const count = await incrementCounter(STORAGE_KEYS.actionsCount);
    if (count >= FREQUENCY_CONFIG.interstitial.actionsBeforeAd) {
        if (await canShowInterstitial()) {
            await showInterstitialAd();
        }
    }
    return count;
};

// -------------------------------------------------
// ANALYTICS
// -------------------------------------------------
export const getAdStats = async () => {
    const [interstitial, rewarded, actions] = await Promise.all([
        getCounter(STORAGE_KEYS.interstitialCount),
        getCounter(STORAGE_KEYS.rewardedCount),
        getCounter(STORAGE_KEYS.actionsCount),
    ]);
    return {
        interstitial: {
            shown: interstitial,
            limit: FREQUENCY_CONFIG.interstitial.maxAdsPerDay,
            remaining: FREQUENCY_CONFIG.interstitial.maxAdsPerDay - interstitial,
        },
        rewarded: {
            shown: rewarded,
            limit: FREQUENCY_CONFIG.rewarded.maxPerDay,
            remaining: FREQUENCY_CONFIG.rewarded.maxPerDay - rewarded,
        },
        actions: {
            count: actions,
            needed: FREQUENCY_CONFIG.interstitial.actionsBeforeAd,
        },
    };
};

// -------------------------------------------------
// ESTIMACIÓN DE INGRESOS (CPM estimado)
// -------------------------------------------------
export const estimateAdRevenue = async () => {
    const stats = await getAdStats();
    const CPM = { banner: 0.5, interstitial: 3.0, rewarded: 5.0 };
    const daily = {
        banner: (1000 * 10 * CPM.banner) / 1000, // 10 impresiones por usuario
        interstitial: (stats.interstitial.shown * CPM.interstitial) / 1000,
        rewarded: (stats.rewarded.shown * CPM.rewarded) / 1000,
    };
    const total = daily.banner + daily.interstitial + daily.rewarded;
    return { daily: total, monthly: total * 30, yearly: total * 365, breakdown: daily };
};

export default {
    initializeAdMob,
    getBannerAdUnitId,
    loadInterstitialAd,
    showInterstitialAd,
    canShowInterstitial,
    trackUserAction,
    loadRewardedAd,
    showRewardedAd,
    canShowRewardedAd,
    getAdStats,
    estimateAdRevenue,
};
