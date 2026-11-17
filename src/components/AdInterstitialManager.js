/**
 * Interstitial manager disabled by product decision F0.6 P-07.
 * All callers fail closed; no consent preference can reactivate ad requests.
 */
const adInterstitialManager = {
  async canShow(..._args) {
    return false;
  },
  async loadInterstitial(..._args) {
    return false;
  },
  async show() {
    return false;
  },
  isReady() {
    return false;
  },
};

export default adInterstitialManager;
