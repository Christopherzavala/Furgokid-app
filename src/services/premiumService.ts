/**
 * PremiumService - Sistema de Suscripción Premium para FurgoKid
 *
 * Características Premium:
 * - Sin anuncios
 * - Tracking avanzado
 * - Soporte prioritario
 * - Notificaciones ilimitadas
 * - Reportes detallados
 *
 * Planes:
 * - Monthly: $4.99/mes
 * - Annual: $39.99/año (33% descuento)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import secureStorage from '../utils/secureStorage';
import analyticsService from './analyticsService';

const PREMIUM_STATUS_KEY = '@furgokid_premium_status';
const PREMIUM_TRIAL_KEY = '@furgokid_premium_trial';

export interface PremiumStatus {
  isPremium: boolean;
  plan: 'free' | 'monthly' | 'annual' | 'trial';
  expiresAt: number | null;
  purchasedAt: number | null;
  features: PremiumFeatures;
}

export interface PremiumFeatures {
  noAds: boolean;
  advancedTracking: boolean;
  prioritySupport: boolean;
  unlimitedNotifications: boolean;
  detailedReports: boolean;
  familyPlan: boolean;
  customAlerts: boolean;
}

export const PREMIUM_PLANS = {
  monthly: {
    id: 'furgokid_premium_monthly',
    name: 'Premium Mensual',
    price: 4.99,
    currency: 'USD',
    period: 'month',
    durationDays: 30,
  },
  annual: {
    id: 'furgokid_premium_annual',
    name: 'Premium Anual',
    price: 39.99,
    currency: 'USD',
    period: 'year',
    durationDays: 365,
    savings: '33%',
  },
  trial: {
    id: 'furgokid_premium_trial',
    name: 'Prueba Gratuita',
    price: 0,
    currency: 'USD',
    period: 'trial',
    durationDays: 7,
  },
};

const FREE_FEATURES: PremiumFeatures = {
  noAds: false,
  advancedTracking: false,
  prioritySupport: false,
  unlimitedNotifications: false,
  detailedReports: false,
  familyPlan: false,
  customAlerts: false,
};

const PREMIUM_FEATURES: PremiumFeatures = {
  noAds: true,
  advancedTracking: true,
  prioritySupport: true,
  unlimitedNotifications: true,
  detailedReports: true,
  familyPlan: true,
  customAlerts: true,
};

class PremiumService {
  private status: PremiumStatus = {
    isPremium: false,
    plan: 'free',
    expiresAt: null,
    purchasedAt: null,
    features: FREE_FEATURES,
  };
  private initialized = false;

  async initialize(): Promise<PremiumStatus> {
    if (this.initialized) return this.status;

    try {
      const stored = await AsyncStorage.getItem(PREMIUM_STATUS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as PremiumStatus;

        // Check if subscription expired
        if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
          // Subscription expired
          this.status = {
            isPremium: false,
            plan: 'free',
            expiresAt: null,
            purchasedAt: parsed.purchasedAt,
            features: FREE_FEATURES,
          };
          await this.saveStatus();
          analyticsService.trackUserSegment(false);
        } else {
          this.status = parsed;
          analyticsService.trackUserSegment(parsed.isPremium);
        }
      }

      this.initialized = true;
      console.log(`[Premium] Status: ${this.status.plan}`);
      return this.status;
    } catch (error) {
      console.warn('[Premium] Init error:', error);
      this.initialized = true;
      return this.status;
    }
  }

  private async saveStatus(): Promise<void> {
    try {
      await AsyncStorage.setItem(PREMIUM_STATUS_KEY, JSON.stringify(this.status));
    } catch {
      // Silently fail
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STATUS GETTERS
  // ═══════════════════════════════════════════════════════════════

  getStatus(): PremiumStatus {
    return { ...this.status };
  }

  isPremium(): boolean {
    return this.status.isPremium;
  }

  hasFeature(feature: keyof PremiumFeatures): boolean {
    return this.status.features[feature] || false;
  }

  shouldShowAds(): boolean {
    return !this.status.features.noAds;
  }

  getDaysRemaining(): number | null {
    if (!this.status.expiresAt) return null;
    const remaining = Math.ceil((this.status.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(0, remaining);
  }

  // ═══════════════════════════════════════════════════════════════
  // SUBSCRIPTION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  async startTrial(): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if already used trial
      const trialUsed = await secureStorage.getItem(PREMIUM_TRIAL_KEY);
      if (trialUsed) {
        return { success: false, error: 'Ya utilizaste tu prueba gratuita' };
      }

      const trialPlan = PREMIUM_PLANS.trial;
      const expiresAt = Date.now() + trialPlan.durationDays * 24 * 60 * 60 * 1000;

      this.status = {
        isPremium: true,
        plan: 'trial',
        expiresAt,
        purchasedAt: Date.now(),
        features: PREMIUM_FEATURES,
      };

      await this.saveStatus();
      await AsyncStorage.setItem(PREMIUM_TRIAL_KEY, 'true');

      analyticsService.trackPremiumPurchaseCompleted('trial', 0);
      analyticsService.trackUserSegment(true);

      console.log('[Premium] Trial started');
      return { success: true };
    } catch (error) {
      console.error('[Premium] Trial error:', error);
      return { success: false, error: 'Error al iniciar prueba' };
    }
  }

  async purchasePlan(
    planType: 'monthly' | 'annual'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const plan = PREMIUM_PLANS[planType];

      // Track attempt
      analyticsService.trackPremiumPurchaseStarted(planType, plan.price);

      // TODO: Integrate with actual IAP (react-native-iap)
      // For now, simulate successful purchase
      const expiresAt = Date.now() + plan.durationDays * 24 * 60 * 60 * 1000;

      this.status = {
        isPremium: true,
        plan: planType,
        expiresAt,
        purchasedAt: Date.now(),
        features: PREMIUM_FEATURES,
      };

      await this.saveStatus();

      analyticsService.trackPremiumPurchaseCompleted(planType, plan.price);
      analyticsService.trackUserSegment(true);

      console.log(`[Premium] ${planType} purchased`);
      return { success: true };
    } catch (error) {
      console.error('[Premium] Purchase error:', error);
      return { success: false, error: 'Error al procesar compra' };
    }
  }

  async restorePurchases(): Promise<{ success: boolean; restored: boolean; error?: string }> {
    try {
      // TODO: Integrate with actual IAP restore
      // For now, check local storage
      const stored = await AsyncStorage.getItem(PREMIUM_STATUS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as PremiumStatus;
        if (parsed.isPremium && parsed.expiresAt && parsed.expiresAt > Date.now()) {
          this.status = parsed;
          await this.saveStatus();
          return { success: true, restored: true };
        }
      }
      return { success: true, restored: false };
    } catch (error) {
      console.error('[Premium] Restore error:', error);
      return { success: false, restored: false, error: 'Error al restaurar compras' };
    }
  }

  async cancelSubscription(): Promise<{ success: boolean; error?: string }> {
    try {
      // TODO: Integrate with actual IAP cancellation
      analyticsService.trackPremiumCancelled(this.status.plan);

      // For now, just mark as expired
      this.status = {
        isPremium: false,
        plan: 'free',
        expiresAt: null,
        purchasedAt: this.status.purchasedAt,
        features: FREE_FEATURES,
      };

      await this.saveStatus();
      analyticsService.trackUserSegment(false);

      console.log('[Premium] Subscription cancelled');
      return { success: true };
    } catch (error) {
      console.error('[Premium] Cancel error:', error);
      return { success: false, error: 'Error al cancelar suscripción' };
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // DEBUG METHODS (dev only)
  // ═══════════════════════════════════════════════════════════════

  async debugSetPremium(isPremium: boolean): Promise<void> {
    if (!__DEV__) return;

    if (isPremium) {
      this.status = {
        isPremium: true,
        plan: 'monthly',
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        purchasedAt: Date.now(),
        features: PREMIUM_FEATURES,
      };
    } else {
      this.status = {
        isPremium: false,
        plan: 'free',
        expiresAt: null,
        purchasedAt: null,
        features: FREE_FEATURES,
      };
    }
    await this.saveStatus();
    console.log(`[Premium] Debug: Set to ${isPremium ? 'premium' : 'free'}`);
  }

  async debugResetTrial(): Promise<void> {
    if (!__DEV__) return;
    await AsyncStorage.removeItem(PREMIUM_TRIAL_KEY);
    console.log('[Premium] Debug: Trial reset');
  }
}

export default new PremiumService();
