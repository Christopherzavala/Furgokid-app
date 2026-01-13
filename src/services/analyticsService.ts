/**
 * AnalyticsService - Sistema de Analytics Híbrido para React Native
 *
 * Características:
 * - Almacenamiento local de eventos (AsyncStorage)
 * - Batch upload cuando hay conexión
 * - Fallback graceful si no hay conexión
 * - Métricas de AdMob detalladas
 * - User segmentation
 * - Performance tracking
 *
 * En producción se puede conectar a:
 * - Firebase Analytics (via @react-native-firebase/analytics)
 * - Amplitude
 * - Mixpanel
 * - Custom backend
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import secureStorage from '../utils/secureStorage';

const ANALYTICS_QUEUE_KEY = '@furgokid_analytics_queue';
const ANALYTICS_USER_KEY = '@furgokid_analytics_user';
const MAX_QUEUE_SIZE = 500;
const BATCH_SIZE = 50;

interface AnalyticsEvent {
  name: string;
  params: Record<string, unknown>;
  timestamp: number;
  sessionId: string;
}

interface UserProperties {
  userId?: string;
  role?: string;
  isPremium?: boolean;
  segment?: string;
  firstSeen?: number;
  lastSeen?: number;
  sessionCount?: number;
}

class AnalyticsService {
  private enabled = false;
  private sessionId: string;
  private sessionStartTime: number;
  private userProperties: UserProperties = {};
  private eventQueue: AnalyticsEvent[] = [];
  private initialized = false;
  private isProcessing = false;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = Date.now();
    this.initialize();
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load user properties
      const userJson = await secureStorage.getItem(ANALYTICS_USER_KEY);
      if (userJson) {
        this.userProperties = JSON.parse(userJson);
      }

      // Update session count
      this.userProperties.sessionCount = (this.userProperties.sessionCount || 0) + 1;
      this.userProperties.lastSeen = Date.now();

      if (!this.userProperties.firstSeen) {
        this.userProperties.firstSeen = Date.now();
      }

      await this.saveUserProperties();

      // Load pending events
      const queueJson = await secureStorage.getItem(ANALYTICS_QUEUE_KEY);
      if (queueJson) {
        this.eventQueue = JSON.parse(queueJson);
      }

      this.initialized = true;
      console.log(
        `[Analytics] Initialized - Session: ${this.sessionId}, Queue: ${this.eventQueue.length} events`
      );

      // Process any pending events
      this.processQueue();
    } catch (error) {
      console.warn('[Analytics] Init error:', error);
      this.initialized = true;
    }
  }

  private async saveUserProperties(): Promise<void> {
    try {
      await secureStorage.setObject(ANALYTICS_USER_KEY, this.userProperties);
    } catch {
      // Silently fail
    }
  }

  private async saveQueue(): Promise<void> {
    try {
      // Limit queue size
      if (this.eventQueue.length > MAX_QUEUE_SIZE) {
        this.eventQueue = this.eventQueue.slice(-MAX_QUEUE_SIZE);
      }
      await secureStorage.setObject(ANALYTICS_QUEUE_KEY, this.eventQueue);
    } catch {
      // Silently fail
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = Boolean(enabled);
  }

  private async logEvent(name: string, params: Record<string, unknown> = {}): Promise<void> {
    if (!this.enabled) return;

    const event: AnalyticsEvent = {
      name,
      params: {
        ...params,
        ...this.userProperties,
        sessionDuration: Math.round((Date.now() - this.sessionStartTime) / 1000),
      },
      timestamp: Date.now(),
      sessionId: this.sessionId,
    };

    this.eventQueue.push(event);

    if (__DEV__) {
      console.log(`[Analytics] ${name}`, params);
    }

    await this.saveQueue();

    // Auto-process queue periodically
    if (this.eventQueue.length >= BATCH_SIZE) {
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) return;

    this.isProcessing = true;

    try {
      // In production, send to your analytics backend here
      // For now, we just log and clear old events (> 7 days)
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const oldCount = this.eventQueue.filter((e) => e.timestamp < weekAgo).length;

      if (oldCount > 0) {
        this.eventQueue = this.eventQueue.filter((e) => e.timestamp >= weekAgo);
        await this.saveQueue();
        console.log(`[Analytics] Cleaned ${oldCount} old events`);
      }

      // TODO: Send batch to backend
      // await this.sendBatch(this.eventQueue.slice(0, BATCH_SIZE));
    } catch (error) {
      console.warn('[Analytics] Process error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC CUSTOM EVENT TRACKING
  // ═══════════════════════════════════════════════════════════════

  /**
   * Track a custom event with arbitrary parameters
   * Use this for events not covered by specific tracking methods
   */
  async trackCustomEvent(eventName: string, params: Record<string, unknown> = {}): Promise<void> {
    await this.logEvent(eventName, params);
  }

  // ═══════════════════════════════════════════════════════════════
  // USER IDENTIFICATION
  // ═══════════════════════════════════════════════════════════════

  async setUserId(userId: string): Promise<void> {
    this.userProperties.userId = userId;
    await this.saveUserProperties();
    await this.logEvent('user_identified', { userId });
  }

  async setUserProperty(key: string, value: string): Promise<void> {
    (this.userProperties as Record<string, unknown>)[key] = value;
    await this.saveUserProperties();
  }

  async trackUserRole(role: string): Promise<void> {
    this.userProperties.role = role;
    await this.saveUserProperties();
    await this.logEvent('user_role_set', { role });
  }

  async trackUserSegment(isPremium: boolean): Promise<void> {
    this.userProperties.isPremium = isPremium;
    this.userProperties.segment = isPremium ? 'premium' : 'free';
    await this.saveUserProperties();
    await this.logEvent('user_segment', { isPremium, segment: this.userProperties.segment });
  }

  // ═══════════════════════════════════════════════════════════════
  // SESSION & SCREEN TRACKING
  // ═══════════════════════════════════════════════════════════════

  async trackSessionStart(): Promise<void> {
    await this.logEvent('session_start', {
      sessionNumber: this.userProperties.sessionCount,
    });
  }

  async trackScreenView(screenName: string): Promise<void> {
    await this.logEvent('screen_view', { screen_name: screenName });
  }

  async trackScreenTime(screenName: string, timeInSeconds: number): Promise<void> {
    await this.logEvent('screen_time', {
      screen_name: screenName,
      time_seconds: timeInSeconds,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // AUTHENTICATION EVENTS
  // ═══════════════════════════════════════════════════════════════

  async trackSignUp(role: 'parent' | 'driver'): Promise<void> {
    await this.logEvent('sign_up', { method: 'email', role });
  }

  async trackLogin(role: 'parent' | 'driver'): Promise<void> {
    await this.logEvent('login', { method: 'email', role });
  }

  // ═══════════════════════════════════════════════════════════════
  // ADMOB & MONETIZATION TRACKING
  // ═══════════════════════════════════════════════════════════════

  async trackAdImpression(
    adType: 'banner' | 'interstitial' | 'rewarded',
    screenName: string
  ): Promise<void> {
    await this.logEvent('ad_impression', {
      ad_type: adType,
      screen_name: screenName,
    });
  }

  async trackAdClick(adType: string, adUnitId: string, screenName: string): Promise<void> {
    await this.logEvent('ad_click', {
      ad_type: adType,
      ad_unit_id: adUnitId,
      screen_name: screenName,
    });
  }

  async trackAdLoadAttempt(
    adType: 'banner' | 'interstitial' | 'rewarded',
    placement: string
  ): Promise<void> {
    await this.logEvent('ad_load_attempt', {
      ad_type: adType,
      placement,
    });
  }

  async trackAdLoaded(
    adType: 'banner' | 'interstitial' | 'rewarded',
    placement: string
  ): Promise<void> {
    await this.logEvent('ad_loaded', {
      ad_type: adType,
      placement,
    });
  }

  async trackAdLoadFailed(
    adType: 'banner' | 'interstitial' | 'rewarded',
    placement: string,
    errorMessage?: string
  ): Promise<void> {
    await this.logEvent('ad_load_failed', {
      ad_type: adType,
      placement,
      error: errorMessage,
    });
  }

  async trackAdShowAttempt(
    adType: 'banner' | 'interstitial' | 'rewarded',
    placement: string
  ): Promise<void> {
    await this.logEvent('ad_show_attempt', {
      ad_type: adType,
      placement,
    });
  }

  async trackAdShown(
    adType: 'banner' | 'interstitial' | 'rewarded',
    placement: string
  ): Promise<void> {
    await this.logEvent('ad_shown', {
      ad_type: adType,
      placement,
    });
  }

  async trackAdShowFailed(
    adType: 'banner' | 'interstitial' | 'rewarded',
    placement: string,
    errorMessage?: string
  ): Promise<void> {
    await this.logEvent('ad_show_failed', {
      ad_type: adType,
      placement,
      error: errorMessage,
    });
  }

  async trackAdPaid(
    adType: 'banner' | 'interstitial' | 'rewarded',
    placement: string,
    valueMicros: number,
    currencyCode: string,
    precision?: string | number
  ): Promise<void> {
    const valueUSD = valueMicros / 1_000_000;
    await this.logEvent('ad_paid', {
      ad_type: adType,
      placement,
      value_micros: valueMicros,
      value_usd: valueUSD,
      currency: currencyCode,
      precision,
    });
  }

  async trackRewardEarned(rewardType: string, rewardValue: number): Promise<void> {
    await this.logEvent('reward_earned', {
      reward_type: rewardType,
      reward_value: rewardValue,
    });
  }

  async trackAdRevenue(amount: number, adType: string, currency = 'USD'): Promise<void> {
    await this.logEvent('ad_revenue', {
      value: amount,
      ad_type: adType,
      currency,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // BUSINESS EVENTS
  // ═══════════════════════════════════════════════════════════════

  async trackSearchAttempt(role: string, zone: string, schedule: string): Promise<void> {
    await this.logEvent('search_attempt', { role, zone, schedule });
  }

  async trackSearchResults(
    role: string,
    zone: string,
    schedule: string,
    resultCount: number
  ): Promise<void> {
    await this.logEvent('search_results', {
      role,
      zone,
      schedule,
      result_count: resultCount,
    });
  }

  async trackParentRequest(school: string, zone: string, schedule: string): Promise<void> {
    await this.logEvent('parent_request_created', { school, zone, schedule });
  }

  async trackDriverVacancy(school: string, zone: string, seats: number): Promise<void> {
    await this.logEvent('driver_vacancy_created', { school, zone, seats });
  }

  async trackContactInitiated(role: 'parent' | 'driver', targetUserId: string): Promise<void> {
    await this.logEvent('contact_initiated', {
      initiator_role: role,
      target_user_id: targetUserId,
    });
  }

  async trackReturnAfterContact(role: string, elapsedMs: number): Promise<void> {
    await this.logEvent('return_after_contact', {
      role,
      elapsed_seconds: Math.round(elapsedMs / 1000),
    });
  }

  async trackPostContactAd(
    placement: string,
    props: { adsDisabled: boolean; loaded: boolean; shown: boolean }
  ): Promise<void> {
    await this.logEvent('post_contact_ad', {
      placement,
      ...props,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // ERROR & PERFORMANCE TRACKING
  // ═══════════════════════════════════════════════════════════════

  async trackAppError(
    message: string,
    details?: {
      name?: string;
      stack?: string;
      componentStack?: string;
      fatal?: boolean;
      tag?: string;
      action?: string;
    }
  ): Promise<void> {
    await this.logEvent('app_error', {
      error_message: message,
      error_name: details?.name,
      is_fatal: details?.fatal || false,
      tag: details?.tag,
      action: details?.action,
      // Don't log full stack in production events
      has_stack: Boolean(details?.stack),
    });
  }

  async trackPerformance(
    name: string,
    durationMs: number,
    props?: {
      screen?: string;
      role?: string;
      resultCount?: number;
      ok?: boolean;
    }
  ): Promise<void> {
    await this.logEvent('performance', {
      metric_name: name,
      duration_ms: durationMs,
      ...props,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // PREMIUM & SUBSCRIPTION EVENTS
  // ═══════════════════════════════════════════════════════════════

  async trackPremiumViewed(): Promise<void> {
    await this.logEvent('premium_viewed');
  }

  async trackPremiumPurchaseStarted(plan: string, price: number): Promise<void> {
    await this.logEvent('premium_purchase_started', { plan, price });
  }

  async trackPremiumPurchaseCompleted(plan: string, price: number): Promise<void> {
    await this.logEvent('purchase', {
      item_name: `premium_${plan}`,
      value: price,
      currency: 'USD',
    });
  }

  async trackPremiumCancelled(plan: string): Promise<void> {
    await this.logEvent('premium_cancelled', { plan });
  }

  // ═══════════════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════════════

  async getAnalyticsSummary(): Promise<{
    totalEvents: number;
    sessionCount: number;
    userId?: string;
    segment?: string;
  }> {
    return {
      totalEvents: this.eventQueue.length,
      sessionCount: this.userProperties.sessionCount || 0,
      userId: this.userProperties.userId,
      segment: this.userProperties.segment,
    };
  }

  async clearAnalytics(): Promise<void> {
    this.eventQueue = [];
    await AsyncStorage.removeItem(ANALYTICS_QUEUE_KEY);
    console.log('[Analytics] Queue cleared');
  }

  async exportEvents(): Promise<AnalyticsEvent[]> {
    return [...this.eventQueue];
  }
}

export default new AnalyticsService();
