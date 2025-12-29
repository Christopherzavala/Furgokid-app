/**
 * Servicio de Analytics - Stub/No-op para React Native
 *
 * Firebase Analytics del JS SDK (firebase/analytics) NO es compatible con React Native,
 * solo funciona en web. Para usar analytics en React Native se necesita:
 * - @react-native-firebase/analytics (requiere configuración nativa)
 *
 * Este servicio actúa como stub - todas las llamadas son no-op (no hacen nada)
 * pero mantienen la misma API para no romper el código existente.
 *
 * TODO: Implementar analytics real cuando se configure el proyecto con
 * @react-native-firebase/analytics o una alternativa como Amplitude/Mixpanel.
 */
class AnalyticsService {
  constructor() {
    console.log('[Analytics] Stub service initialized - no tracking active');
  }

  async setUserId(_userId: string): Promise<void> {
    // No-op
  }

  async trackSessionStart(): Promise<void> {
    // No-op
  }

  async trackScreenView(_screenName: string): Promise<void> {
    // No-op
  }

  async setUserProperty(_key: string, _value: string): Promise<void> {
    // No-op
  }

  async trackUserRole(_role: string): Promise<void> {
    // No-op
  }

  async trackAppError(
    _message: string,
    _details?: {
      name?: string;
      stack?: string;
      componentStack?: string;
      fatal?: boolean;
      tag?: string;
      action?: string;
    }
  ): Promise<void> {
    // No-op
  }

  async trackPerformance(
    _name: string,
    _durationMs: number,
    _props?: {
      screen?: string;
      role?: string;
      resultCount?: number;
      ok?: boolean;
    }
  ): Promise<void> {
    // No-op
  }

  async trackAdImpression(
    _adType: 'banner' | 'interstitial' | 'rewarded',
    _screenName: string
  ): Promise<void> {
    // No-op
  }

  async trackAdClick(_adType: string, _adUnitId: string, _screenName: string): Promise<void> {
    // No-op
  }

  async trackRewardEarned(_rewardType: string, _rewardValue: number): Promise<void> {
    // No-op
  }

  async trackAdRevenue(_amount: number, _adType: string, _currency = 'USD'): Promise<void> {
    // No-op
  }

  async trackAdLoadAttempt(
    _adType: 'banner' | 'interstitial' | 'rewarded',
    _placement: string
  ): Promise<void> {
    // No-op
  }

  async trackAdLoaded(
    _adType: 'banner' | 'interstitial' | 'rewarded',
    _placement: string
  ): Promise<void> {
    // No-op
  }

  async trackAdLoadFailed(
    _adType: 'banner' | 'interstitial' | 'rewarded',
    _placement: string,
    _errorMessage?: string
  ): Promise<void> {
    // No-op
  }

  async trackAdShowAttempt(
    _adType: 'banner' | 'interstitial' | 'rewarded',
    _placement: string
  ): Promise<void> {
    // No-op
  }

  async trackAdShown(
    _adType: 'banner' | 'interstitial' | 'rewarded',
    _placement: string
  ): Promise<void> {
    // No-op
  }

  async trackAdShowFailed(
    _adType: 'banner' | 'interstitial' | 'rewarded',
    _placement: string,
    _errorMessage?: string
  ): Promise<void> {
    // No-op
  }

  async trackAdPaid(
    _adType: 'banner' | 'interstitial' | 'rewarded',
    _placement: string,
    _valueMicros: number,
    _currencyCode: string,
    _precision?: string | number
  ): Promise<void> {
    // No-op
  }

  async trackSearchAttempt(_role: string, _zone: string, _schedule: string): Promise<void> {
    // No-op
  }

  async trackSearchResults(
    _role: string,
    _zone: string,
    _schedule: string,
    _resultCount: number
  ): Promise<void> {
    // No-op
  }

  async trackReturnAfterContact(_role: string, _elapsedMs: number): Promise<void> {
    // No-op
  }

  async trackPostContactAd(
    _placement: string,
    _props: {
      adsDisabled: boolean;
      loaded: boolean;
      shown: boolean;
    }
  ): Promise<void> {
    // No-op
  }

  async trackScreenTime(_screenName: string, _timeInSeconds: number): Promise<void> {
    // No-op
  }

  async trackUserSegment(_isPremium: boolean): Promise<void> {
    // No-op
  }

  async trackParentRequest(_school: string, _zone: string, _schedule: string): Promise<void> {
    // No-op
  }

  async trackDriverVacancy(_school: string, _zone: string, _seats: number): Promise<void> {
    // No-op
  }

  async trackContactInitiated(_role: 'parent' | 'driver', _targetUserId: string): Promise<void> {
    // No-op
  }

  async trackSignUp(_role: 'parent' | 'driver'): Promise<void> {
    // No-op
  }

  async trackLogin(_role: 'parent' | 'driver'): Promise<void> {
    // No-op
  }
}

export default new AnalyticsService();
