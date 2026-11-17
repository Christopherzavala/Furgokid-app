import React from 'react';

interface AdBannerProps {
  unitId: string;
  screenName: string;
  style?: any;
}

/** AdMob is disabled; retain the component API while rendering no ad surface. */
export const AdBanner: React.FC<AdBannerProps> = () => null;
