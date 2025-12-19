// Subscription Types and Plans
export type SubscriptionTier = 'free' | 'basic' | 'family' | 'school' | 'enterprise';

export interface SubscriptionPlan {
    id: SubscriptionTier;
    name: string;
    price: number;
    currency: string;
    interval: 'month' | 'year';
    features: string[];
    limits: {
        vehicles: number;
        users: number;
        historyDays: number;
        notifications: boolean;
        geofencing: boolean;
        analytics: boolean;
        support: 'email' | 'priority' | '24/7';
    };
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
    free: {
        id: 'free',
        name: 'Prueba Gratuita',
        price: 0,
        currency: 'USD',
        interval: 'month',
        features: [
            'Rastreo GPS básico',
            '1 vehículo',
            'Notificaciones básicas',
            '7 días de historial',
            'Soporte por email',
        ],
        limits: {
            vehicles: 1,
            users: 1,
            historyDays: 7,
            notifications: true,
            geofencing: false,
            analytics: false,
            support: 'email',
        },
    },
    basic: {
        id: 'basic',
        name: 'Plan Básico',
        price: 9.99,
        currency: 'USD',
        interval: 'month',
        features: [
            'Rastreo GPS en tiempo real',
            '1 vehículo',
            'Notificaciones estándar',
            '30 días de historial',
            'Soporte por email',
        ],
        limits: {
            vehicles: 1,
            users: 1,
            historyDays: 30,
            notifications: true,
            geofencing: false,
            analytics: false,
            support: 'email',
        },
    },
    family: {
        id: 'family',
        name: 'Plan Familiar',
        price: 19.99,
        currency: 'USD',
        interval: 'month',
        features: [
            'Rastreo GPS avanzado',
            'Hasta 3 vehículos',
            'Hasta 3 usuarios',
            'Notificaciones personalizadas',
            'Geocercas (geofencing)',
            '90 días de historial',
            'Reportes semanales',
            'Soporte prioritario',
        ],
        limits: {
            vehicles: 3,
            users: 3,
            historyDays: 90,
            notifications: true,
            geofencing: true,
            analytics: true,
            support: 'priority',
        },
    },
    school: {
        id: 'school',
        name: 'Plan Escuela',
        price: 99.99,
        currency: 'USD',
        interval: 'month',
        features: [
            'Vehículos ilimitados',
            'Usuarios ilimitados',
            'Panel administrativo',
            'Reportes y analíticas completas',
            'Historial ilimitado',
            'API para integración',
            'Branding personalizado',
            'Soporte 24/7',
            'Capacitación incluida',
        ],
        limits: {
            vehicles: -1, // unlimited
            users: -1, // unlimited
            historyDays: -1, // unlimited
            notifications: true,
            geofencing: true,
            analytics: true,
            support: '24/7',
        },
    },
    enterprise: {
        id: 'enterprise',
        name: 'Plan Enterprise',
        price: 0, // Custom pricing
        currency: 'USD',
        interval: 'month',
        features: [
            'Todo del Plan Escuela',
            'Infraestructura dedicada',
            'SLA garantizado (99.9%)',
            'Features personalizados',
            'Integración con sistemas existentes',
            'Account Manager dedicado',
            'Onboarding personalizado',
        ],
        limits: {
            vehicles: -1,
            users: -1,
            historyDays: -1,
            notifications: true,
            geofencing: true,
            analytics: true,
            support: '24/7',
        },
    },
};

// User Subscription Status
export interface UserSubscription {
    userId: string;
    plan: SubscriptionTier;
    status: 'active' | 'canceled' | 'past_due' | 'trialing';
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    cancelAtPeriodEnd: boolean;
    trialEnd?: Date;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
}

// Invoice/Receipt
export interface Invoice {
    id: string;
    userId: string;
    amount: number;
    currency: string;
    status: 'paid' | 'pending' | 'failed';
    plan: SubscriptionTier;
    periodStart: Date;
    periodEnd: Date;
    paidAt?: Date;
    invoiceUrl?: string;
    receiptUrl?: string;
}

// Payment Method
export interface PaymentMethod {
    id: string;
    userId: string;
    type: 'card' | 'paypal' | 'bank_transfer';
    last4?: string;
    brand?: string;
    expiryMonth?: number;
    expiryYear?: number;
    isDefault: boolean;
}

// Subscription Helper Functions
export const canAccessFeature = (
    userPlan: SubscriptionTier,
    feature: keyof SubscriptionPlan['limits']
): boolean => {
    const plan = SUBSCRIPTION_PLANS[userPlan];
    return plan.limits[feature] === true || plan.limits[feature] === -1;
};

export const hasReachedLimit = (
    userPlan: SubscriptionTier,
    feature: 'vehicles' | 'users',
    currentCount: number
): boolean => {
    const plan = SUBSCRIPTION_PLANS[userPlan];
    const limit = plan.limits[feature];

    if (limit === -1) return false; // unlimited
    return currentCount >= limit;
};

export const getDaysUntilRenewal = (subscription: UserSubscription): number => {
    const now = new Date();
    const end = new Date(subscription.currentPeriodEnd);
    const diffTime = end.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const isTrialing = (subscription: UserSubscription): boolean => {
    if (!subscription.trialEnd) return false;
    return new Date() < new Date(subscription.trialEnd);
};

export const formatPrice = (price: number, currency: string = 'USD'): string => {
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: currency,
    }).format(price);
};
