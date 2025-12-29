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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async setUserId(_userId: string): Promise<void> {
    // No-op
  }

  async trackSessionStart(): Promise<void> {
    // No-op
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async trackScreenView(_screenName: string): Promise<void> {
    // No-op
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async setUserProperty(_key: string, _value: string): Promise<void> {
    // No-op
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async trackUserRole(_role: string): Promise<void> {
    // No-op
  }

  async trackAppError(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _message: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _name: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _durationMs: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _adType: 'banner' | 'interstitial' | 'rewarded',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _screenName: string
  ): Promise<void> {
    // No-op
  }

  async trackAdClick(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _adType: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _adUnitId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _screenName: string
  ): Promise<void> {
    // No-op
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async trackRewardEarned(_rewardType: string, _rewardValue: number): Promise<void> {
    // No-op
  }

  async trackAdRevenue(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _amount: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _adType: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _currency: string = 'USD'
  ): Promise<void> {
    // No-op
  }

  async trackAdLoadAttempt(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _adType: 'banner' | 'interstitial' | 'rewarded',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _placement: string
  ): Promise<void> {
    // No-op
  }

  async trackAdLoaded(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _adType: 'banner' | 'interstitial' | 'rewarded',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _placement: string
  ): Promise<void> {
    // No-op
  }

  async trackAdLoadFailed(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _adType: 'banner' | 'interstitial' | 'rewarded',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _placement: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _errorMessage?: string
  ): Promise<void> {
    // No-op
  }

  async trackAdShowAttempt(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _adType: 'banner' | 'interstitial' | 'rewarded',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _placement: string
  ): Promise<void> {
    // No-op
  }

  async trackAdShown(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _adType: 'banner' | 'interstitial' | 'rewarded',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _placement: string
  ): Promise<void> {
    // No-op
  }

  async trackAdShowFailed(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _adType: 'banner' | 'interstitial' | 'rewarded',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _placement: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _errorMessage?: string
  ): Promise<void> {
    // No-op
  }

  async trackAdPaid(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _adType: 'banner' | 'interstitial' | 'rewarded',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _placement: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _valueMicros: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _currencyCode: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _precision?: string | number
  ): Promise<void> {
    // No-op
  }

  async trackSearchAttempt(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _role: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _zone: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _schedule: string
  ): Promise<void> {
    // No-op
  }

  async trackSearchResults(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _role: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _zone: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _schedule: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _resultCount: number
  ): Promise<void> {
    // No-op
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async trackReturnAfterContact(_role: string, _elapsedMs: number): Promise<void> {
    // No-op
  }

  async trackPostContactAd(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _placement: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _props: {
      adsDisabled: boolean;
      loaded: boolean;
      shown: boolean;
    }
  ): Promise<void> {
    // No-op
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async trackScreenTime(_screenName: string, _timeInSeconds: number): Promise<void> {
    // No-op
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async trackUserSegment(_isPremium: boolean): Promise<void> {
    // No-op
  }

  async trackParentRequest(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _school: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _zone: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _schedule: string
  ): Promise<void> {
    // No-op
  }

  async trackDriverVacancy(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _school: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _zone: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _seats: number
  ): Promise<void> {
    // No-op
  }

  async trackContactInitiated(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _role: 'parent' | 'driver',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _targetUserId: string
  ): Promise<void> {
    // No-op
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async trackSignUp(_role: 'parent' | 'driver'): Promise<void> {
    // No-op
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async trackLogin(_role: 'parent' | 'driver'): Promise<void> {
    // No-op
  }
}

export default new AnalyticsService();
