/**
 * usePremium - Hook para acceder al estado de Premium
 */

import { useCallback, useEffect, useState } from 'react';
import premiumService, { PremiumFeatures, PremiumStatus } from '../services/premiumService';

interface UsePremiumReturn {
  status: PremiumStatus;
  isPremium: boolean;
  shouldShowAds: boolean;
  hasFeature: (feature: keyof PremiumFeatures) => boolean;
  daysRemaining: number | null;
  startTrial: () => Promise<{ success: boolean; error?: string }>;
  purchase: (plan: 'monthly' | 'annual') => Promise<{ success: boolean; error?: string }>;
  restore: () => Promise<{ success: boolean; restored: boolean; error?: string }>;
  loading: boolean;
}

export function usePremium(): UsePremiumReturn {
  const [status, setStatus] = useState<PremiumStatus>(premiumService.getStatus());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const newStatus = await premiumService.initialize();
      setStatus(newStatus);
      setLoading(false);
    };
    init();
  }, []);

  const refreshStatus = useCallback(() => {
    setStatus(premiumService.getStatus());
  }, []);

  const startTrial = useCallback(async () => {
    setLoading(true);
    const result = await premiumService.startTrial();
    refreshStatus();
    setLoading(false);
    return result;
  }, [refreshStatus]);

  const purchase = useCallback(
    async (plan: 'monthly' | 'annual') => {
      setLoading(true);
      const result = await premiumService.purchasePlan(plan);
      refreshStatus();
      setLoading(false);
      return result;
    },
    [refreshStatus]
  );

  const restore = useCallback(async () => {
    setLoading(true);
    const result = await premiumService.restorePurchases();
    refreshStatus();
    setLoading(false);
    return result;
  }, [refreshStatus]);

  return {
    status,
    isPremium: status.isPremium,
    shouldShowAds: premiumService.shouldShowAds(),
    hasFeature: (feature) => premiumService.hasFeature(feature),
    daysRemaining: premiumService.getDaysRemaining(),
    startTrial,
    purchase,
    restore,
    loading,
  };
}

export default usePremium;
