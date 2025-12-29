import Constants, { ExecutionEnvironment } from 'expo-constants';

// Detecta si estamos en Expo Go (no soporta módulos nativos compilados)
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let analyticsModule: any = null;

// Solo intenta importar Firebase Analytics en builds nativos (no en Expo Go)
if (!isExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    analyticsModule = require('@react-native-firebase/analytics').default;
  } catch (error) {
    console.warn('[Analytics] Firebase Analytics no disponible:', error);
  }
}

/**
 * Servicio centralizado para tracking de eventos de negocio y monetización.
 * Prioridad: MVP, estabilidad y base para crecimiento.
 *
 * Nota: En Expo Go, los métodos son no-ops (no hacen nada).
 * En builds nativos, trackean eventos a Firebase Analytics.
 */
class AnalyticsService {
  private initialized = !isExpoGo && !!analyticsModule;

  private async logEventSafe(eventName: string, params: Record<string, any>): Promise<void> {
    if (!this.initialized || !analyticsModule) return;
    try {
      await analyticsModule.logEvent(eventName, {
        ...params,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.warn(`[Analytics] Error logging ${eventName}:`, error);
    }
  }

  /**
   * Asocia el userId a los eventos para análisis de cohortes y retención.
   */
  async setUserId(userId: string): Promise<void> {
    if (!this.initialized) {
      console.log('[Analytics] No-op (Expo Go o Firebase no disponible)');
      return;
    }
    try {
      if (userId && analyticsModule) {
        await analyticsModule.setUserId(userId);
        console.log('[Analytics] setUserId:', userId);
      }
    } catch (error) {
      console.warn('[Analytics] Error setting userId:', error);
    }
  }

  async trackSessionStart(): Promise<void> {
    await this.logEventSafe('session_start', {});
  }

  async trackScreenView(screenName: string): Promise<void> {
    if (!screenName) return;
    await this.logEventSafe('screen_view', {
      screen_name: screenName,
    });
  }

  async setUserProperty(key: string, value: string): Promise<void> {
    if (!this.initialized || !analyticsModule) return;
    if (!key) return;
    try {
      await analyticsModule.setUserProperty(key, value);
    } catch (error) {
      console.warn('[Analytics] Error setting user property:', error);
    }
  }

  async trackUserRole(role: string): Promise<void> {
    if (!role) return;
    await this.setUserProperty('user_role', String(role));
  }

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
    if (!message) return;
    await this.logEventSafe('app_error', {
      message: String(message),
      name: details?.name ? String(details.name) : undefined,
      tag: details?.tag ? String(details.tag) : undefined,
      action: details?.action ? String(details.action) : undefined,
      fatal: details?.fatal ? 'true' : 'false',
      stack: details?.stack ? String(details.stack).slice(0, 1000) : undefined,
      component_stack: details?.componentStack
        ? String(details.componentStack).slice(0, 1000)
        : undefined,
    });
  }

  // -----------------
  // Health (perf)
  // -----------------
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
    if (!name) return;
    const duration = Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : undefined;
    await this.logEventSafe('perf', {
      name,
      duration_ms: duration,
      screen: props?.screen,
      role: props?.role,
      ok: typeof props?.ok === 'boolean' ? (props.ok ? 'true' : 'false') : undefined,
      result_count:
        typeof props?.resultCount === 'number' && Number.isFinite(props.resultCount)
          ? props.resultCount
          : undefined,
    });
  }

  /**
   * Trackea impresión de anuncio.
   */
  async trackAdImpression(
    adType: 'banner' | 'interstitial' | 'rewarded',
    screenName: string
  ): Promise<void> {
    if (!adType || !screenName) return;
    await this.logEventSafe('ad_impression', {
      ad_type: adType,
      placement: screenName,
    });
  }

  /**
   * Trackea clic en anuncio.
   */
  async trackAdClick(adType: string, adUnitId: string, screenName: string): Promise<void> {
    if (!adType || !adUnitId || !screenName) return;
    await this.logEventSafe('ad_click', {
      ad_type: adType,
      ad_unit: adUnitId,
      placement: screenName,
    });
  }

  /**
   * Trackea recompensa ganada por usuario.
   */
  async trackRewardEarned(rewardType: string, rewardValue: number): Promise<void> {
    if (!rewardType || rewardValue == null) return;
    await this.logEventSafe('reward_earned', {
      reward_type: rewardType,
      reward_value: rewardValue,
    });
  }

  /**
   * Trackea revenue generado por anuncios.
   */
  async trackAdRevenue(amount: number, adType: string, currency: string = 'USD'): Promise<void> {
    if (!amount || !adType) return;
    await this.logEventSafe('ad_revenue', {
      value: amount,
      currency: currency,
      ad_type: adType,
    });
  }

  async trackAdLoadAttempt(adType: 'banner' | 'interstitial' | 'rewarded', placement: string) {
    if (!adType || !placement) return;
    await this.logEventSafe('ad_load_attempt', {
      ad_type: adType,
      placement,
    });
  }

  async trackAdLoaded(adType: 'banner' | 'interstitial' | 'rewarded', placement: string) {
    if (!adType || !placement) return;
    await this.logEventSafe('ad_loaded', {
      ad_type: adType,
      placement,
    });
  }

  async trackAdLoadFailed(
    adType: 'banner' | 'interstitial' | 'rewarded',
    placement: string,
    errorMessage?: string
  ) {
    if (!adType || !placement) return;
    await this.logEventSafe('ad_load_failed', {
      ad_type: adType,
      placement,
      error_message: errorMessage || 'unknown',
    });
  }

  async trackAdShowAttempt(adType: 'banner' | 'interstitial' | 'rewarded', placement: string) {
    if (!adType || !placement) return;
    await this.logEventSafe('ad_show_attempt', {
      ad_type: adType,
      placement,
    });
  }

  async trackAdShown(adType: 'banner' | 'interstitial' | 'rewarded', placement: string) {
    if (!adType || !placement) return;
    await this.logEventSafe('ad_shown', {
      ad_type: adType,
      placement,
    });
  }

  async trackAdShowFailed(
    adType: 'banner' | 'interstitial' | 'rewarded',
    placement: string,
    errorMessage?: string
  ) {
    if (!adType || !placement) return;
    await this.logEventSafe('ad_show_failed', {
      ad_type: adType,
      placement,
      error_message: errorMessage || 'unknown',
    });
  }

  async trackAdPaid(
    adType: 'banner' | 'interstitial' | 'rewarded',
    placement: string,
    valueMicros: number,
    currencyCode: string,
    precision?: string | number
  ) {
    if (!adType || !placement || !valueMicros || !currencyCode) return;
    const value = valueMicros / 1_000_000;
    await this.logEventSafe('ad_revenue', {
      ad_type: adType,
      placement,
      value,
      value_micros: valueMicros,
      currency: currencyCode,
      precision: precision ?? 'unknown',
    });
  }

  // -----------------
  // Funnel (growth)
  // -----------------
  async trackSearchAttempt(role: string, zone: string, schedule: string): Promise<void> {
    await this.logEventSafe('search_attempt', {
      role: role || 'unknown',
      zone: zone || 'unknown',
      schedule: schedule || 'unknown',
    });
  }

  async trackSearchResults(
    role: string,
    zone: string,
    schedule: string,
    resultCount: number
  ): Promise<void> {
    await this.logEventSafe('search_results', {
      role: role || 'unknown',
      zone: zone || 'unknown',
      schedule: schedule || 'unknown',
      result_count: Number.isFinite(resultCount) ? resultCount : 0,
      empty: resultCount > 0 ? 'false' : 'true',
    });
  }

  async trackReturnAfterContact(role: string, elapsedMs: number): Promise<void> {
    await this.logEventSafe('return_after_contact', {
      role: role || 'unknown',
      elapsed_ms: Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : undefined,
    });
  }

  async trackPostContactAd(
    placement: string,
    props: {
      adsDisabled: boolean;
      loaded: boolean;
      shown: boolean;
    }
  ): Promise<void> {
    await this.logEventSafe('post_contact_ad', {
      placement: placement || 'unknown',
      ads_disabled: props.adsDisabled ? 'true' : 'false',
      loaded: props.loaded ? 'true' : 'false',
      shown: props.shown ? 'true' : 'false',
    });
  }

  /**
   * Trackea tiempo de pantalla por usuario.
   */
  async trackScreenTime(screenName: string, timeInSeconds: number): Promise<void> {
    if (!screenName || timeInSeconds == null) return;
    await this.logEventSafe('screen_time', {
      screen_name: screenName,
      screen_duration_seconds: timeInSeconds,
    });
  }

  /**
   * Trackea segmento de usuario (premium/no premium).
   */
  async trackUserSegment(isPremium: boolean): Promise<void> {
    if (!this.initialized) return;
    try {
      await analyticsModule.setUserProperty('is_premium', isPremium ? 'true' : 'false');
    } catch (error) {
      console.warn('[Analytics] Error setting user property:', error);
    }
  }

  /**
   * Trackea publicación de necesidad por padre.
   */
  async trackParentRequest(school: string, zone: string, schedule: string): Promise<void> {
    await this.logEventSafe('parent_request', {
      school,
      zone,
      schedule,
    });
  }

  /**
   * Trackea publicación de cupo por conductor.
   */
  async trackDriverVacancy(school: string, zone: string, seats: number): Promise<void> {
    await this.logEventSafe('driver_vacancy', {
      school,
      zone,
      seats,
    });
  }

  /**
   * Trackea contacto realizado (WhatsApp).
   */
  async trackContactInitiated(role: 'parent' | 'driver', targetUserId: string): Promise<void> {
    await this.logEventSafe('contact_initiated', {
      role,
      target_user_id: targetUserId,
    });
  }

  /**
   * Trackea registro exitoso.
   */
  async trackSignUp(role: 'parent' | 'driver'): Promise<void> {
    await this.logEventSafe('sign_up', {
      role,
    });
  }

  /**
   * Trackea login exitoso.
   */
  async trackLogin(role: 'parent' | 'driver'): Promise<void> {
    await this.logEventSafe('login', {
      role,
    });
  }
}

export default new AnalyticsService();
