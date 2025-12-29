/**
 * useConsent - Hook para manejar consentimiento del usuario
 */

import { useCallback, useEffect, useState } from 'react';
import consentService, { ConsentPreferences } from '../services/consentService';

interface UseConsentReturn {
  preferences: ConsentPreferences;
  needsConsent: boolean;
  hasAcceptedRequired: boolean;
  canShowPersonalizedAds: boolean;
  canTrackAnalytics: boolean;
  canTrackLocation: boolean;
  acceptAll: () => Promise<void>;
  acceptRequired: () => Promise<void>;
  updatePreference: (key: keyof ConsentPreferences, value: boolean) => Promise<void>;
  withdrawConsent: () => Promise<void>;
  requestDataDeletion: () => Promise<{ success: boolean; message: string }>;
  exportData: () => Promise<object>;
  loading: boolean;
}

export function useConsent(): UseConsentReturn {
  const [preferences, setPreferences] = useState<ConsentPreferences>(
    consentService.getPreferences()
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const prefs = await consentService.initialize();
      setPreferences(prefs);
      setLoading(false);
    };
    init();
  }, []);

  const refreshPreferences = useCallback(() => {
    setPreferences(consentService.getPreferences());
  }, []);

  const acceptAll = useCallback(async () => {
    await consentService.acceptAll();
    refreshPreferences();
  }, [refreshPreferences]);

  const acceptRequired = useCallback(async () => {
    await consentService.acceptRequired();
    refreshPreferences();
  }, [refreshPreferences]);

  const updatePreference = useCallback(
    async (key: keyof ConsentPreferences, value: boolean) => {
      await consentService.updatePreference(key as any, value);
      refreshPreferences();
    },
    [refreshPreferences]
  );

  const withdrawConsent = useCallback(async () => {
    await consentService.withdrawConsent();
    refreshPreferences();
  }, [refreshPreferences]);

  const requestDataDeletion = useCallback(async () => {
    const result = await consentService.requestDataDeletion();
    refreshPreferences();
    return result;
  }, [refreshPreferences]);

  const exportData = useCallback(async () => {
    return consentService.exportUserData();
  }, []);

  return {
    preferences,
    needsConsent: consentService.needsConsentPrompt(),
    hasAcceptedRequired: consentService.hasAcceptedRequired(),
    canShowPersonalizedAds: consentService.canShowPersonalizedAds(),
    canTrackAnalytics: consentService.canTrackAnalytics(),
    canTrackLocation: consentService.canTrackLocation(),
    acceptAll,
    acceptRequired,
    updatePreference,
    withdrawConsent,
    requestDataDeletion,
    exportData,
    loading,
  };
}

export default useConsent;
