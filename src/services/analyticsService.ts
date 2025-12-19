import analytics from '@react-native-firebase/analytics';

class AnalyticsService {
  async trackAdImpression(
    adType: 'banner' | 'interstitial' | 'rewarded',
    screenName: string
  ): Promise<void> {
    try {
      await analytics().logEvent('ad_impression', {
        ad_type: adType,
        screen_name: screenName,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Analytics] Error tracking ad impression:', error);
    }
  }

  async trackAdClick(
    adType: string,
    adUnitId: string,
    screenName: string
  ): Promise<void> {
    try {
      await analytics().logEvent('ad_click', {
        ad_type: adType,
        ad_unit: adUnitId,
        screen_name: screenName,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Analytics] Error tracking ad click:', error);
    }
  }

  async trackRewardEarned(
    rewardType: string,
    rewardValue: number
  ): Promise<void> {
    try {
      await analytics().logEvent('reward_earned', {
        reward_type: rewardType,
        reward_value: rewardValue,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Analytics] Error tracking reward:', error);
    }
  }

  async trackAdRevenue(
    amount: number,
    adType: string,
    currency: string = 'USD'
  ): Promise<void> {
    try {
      await analytics().logEvent('ad_revenue', {
        value: amount,
        currency: currency,
        ad_type: adType,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Analytics] Error tracking revenue:', error);
    }
  }

  async trackScreenTime(screenName: string, timeInSeconds: number): Promise<void> {
    try {
      await analytics().logEvent('screen_view', {
        screen_name: screenName,
        screen_duration: timeInSeconds,
      });
    } catch (error) {
      console.error('[Analytics] Error tracking screen time:', error);
    }
  }

  async trackUserSegment(isPremium: boolean): Promise<void> {
    try {
      await analytics().setUserProperty('is_premium', isPremium ? 'true' : 'false');
    } catch (error) {
      console.error('[Analytics] Error setting user property:', error);
    }
  }
}

export default new AnalyticsService();
