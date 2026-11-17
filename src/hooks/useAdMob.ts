/** AdMob is disabled; consent preferences cannot activate ad requests. */
export const useAdMob = () => ({
  adLoaded: false,
  showInterstitial: async () => false,
  showRewarded: async () => false,
});
