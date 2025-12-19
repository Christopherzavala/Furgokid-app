// Subscription Service - Business Logic for Billing
import { db } from '../config/firebase';
import {
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    query,
    where,
    getDocs,
    Timestamp,
} from 'firebase/firestore';
import {
    SubscriptionTier,
    UserSubscription,
    Invoice,
    SUBSCRIPTION_PLANS,
    canAccessFeature,
    hasReachedLimit,
} from '../types/subscription';

/**
 * Get user's current subscription
 */
export const getUserSubscription = async (
    userId: string
): Promise<UserSubscription | null> => {
    try {
        const subscriptionRef = doc(db, 'subscriptions', userId);
        const subscriptionSnap = await getDoc(subscriptionRef);

        if (!subscriptionSnap.exists()) {
            // Create free trial subscription
            return await createFreeTrialSubscription(userId);
        }

        const data = subscriptionSnap.data();
        return {
            userId: data.userId,
            plan: data.plan,
            status: data.status,
            currentPeriodStart: data.currentPeriodStart.toDate(),
            currentPeriodEnd: data.currentPeriodEnd.toDate(),
            cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
            trialEnd: data.trialEnd?.toDate(),
            stripeCustomerId: data.stripeCustomerId,
            stripeSubscriptionId: data.stripeSubscriptionId,
        };
    } catch (error) {
        console.error('Error getting subscription:', error);
        return null;
    }
};

/**
 * Create free trial subscription for new users
 */
export const createFreeTrialSubscription = async (
    userId: string
): Promise<UserSubscription> => {
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const subscription: UserSubscription = {
        userId,
        plan: 'free',
        status: 'trialing',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        trialEnd,
    };

    const subscriptionRef = doc(db, 'subscriptions', userId);
    await setDoc(subscriptionRef, {
        ...subscription,
        currentPeriodStart: Timestamp.fromDate(subscription.currentPeriodStart),
        currentPeriodEnd: Timestamp.fromDate(subscription.currentPeriodEnd),
        trialEnd: Timestamp.fromDate(trialEnd),
        createdAt: Timestamp.now(),
    });

    return subscription;
};

/**
 * Upgrade user subscription
 */
export const upgradeSubscription = async (
    userId: string,
    newPlan: SubscriptionTier,
    paymentMethodId?: string
): Promise<boolean> => {
    try {
        const subscriptionRef = doc(db, 'subscriptions', userId);
        const now = new Date();
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        await updateDoc(subscriptionRef, {
            plan: newPlan,
            status: 'active',
            currentPeriodStart: Timestamp.fromDate(now),
            currentPeriodEnd: Timestamp.fromDate(periodEnd),
            cancelAtPeriodEnd: false,
            trialEnd: null,
            updatedAt: Timestamp.now(),
        });

        // Create invoice
        await createInvoice(userId, newPlan, now, periodEnd);

        return true;
    } catch (error) {
        console.error('Error upgrading subscription:', error);
        return false;
    }
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async (
    userId: string,
    immediately: boolean = false
): Promise<boolean> => {
    try {
        const subscriptionRef = doc(db, 'subscriptions', userId);

        if (immediately) {
            await updateDoc(subscriptionRef, {
                status: 'canceled',
                plan: 'free',
                cancelAtPeriodEnd: false,
                updatedAt: Timestamp.now(),
            });
        } else {
            await updateDoc(subscriptionRef, {
                cancelAtPeriodEnd: true,
                updatedAt: Timestamp.now(),
            });
        }

        return true;
    } catch (error) {
        console.error('Error canceling subscription:', error);
        return false;
    }
};

/**
 * Create invoice
 */
export const createInvoice = async (
    userId: string,
    plan: SubscriptionTier,
    periodStart: Date,
    periodEnd: Date
): Promise<string> => {
    const planDetails = SUBSCRIPTION_PLANS[plan];
    const invoiceRef = doc(collection(db, 'invoices'));

    const invoice: Invoice = {
        id: invoiceRef.id,
        userId,
        amount: planDetails.price,
        currency: planDetails.currency,
        status: 'paid',
        plan,
        periodStart,
        periodEnd,
        paidAt: new Date(),
    };

    await setDoc(invoiceRef, {
        ...invoice,
        periodStart: Timestamp.fromDate(periodStart),
        periodEnd: Timestamp.fromDate(periodEnd),
        paidAt: Timestamp.fromDate(invoice.paidAt!),
        createdAt: Timestamp.now(),
    });

    return invoiceRef.id;
};

/**
 * Get user invoices
 */
export const getUserInvoices = async (userId: string): Promise<Invoice[]> => {
    try {
        const invoicesRef = collection(db, 'invoices');
        const q = query(invoicesRef, where('userId', '==', userId));
        const querySnapshot = await getDocs(q);

        return querySnapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                userId: data.userId,
                amount: data.amount,
                currency: data.currency,
                status: data.status,
                plan: data.plan,
                periodStart: data.periodStart.toDate(),
                periodEnd: data.periodEnd.toDate(),
                paidAt: data.paidAt?.toDate(),
                invoiceUrl: data.invoiceUrl,
                receiptUrl: data.receiptUrl,
            };
        });
    } catch (error) {
        console.error('Error getting invoices:', error);
        return [];
    }
};

/**
 * Check if user can access a feature
 */
export const checkFeatureAccess = async (
    userId: string,
    feature: string
): Promise<boolean> => {
    const subscription = await getUserSubscription(userId);
    if (!subscription) return false;

    return canAccessFeature(subscription.plan, feature as any);
};

/**
 * Check if user has reached limit
 */
export const checkLimit = async (
    userId: string,
    limitType: 'vehicles' | 'users',
    currentCount: number
): Promise<boolean> => {
    const subscription = await getUserSubscription(userId);
    if (!subscription) return true;

    return hasReachedLimit(subscription.plan, limitType, currentCount);
};

/**
 * Get subscription analytics for admin
 */
export const getSubscriptionAnalytics = async () => {
    try {
        const subscriptionsRef = collection(db, 'subscriptions');
        const querySnapshot = await getDocs(subscriptionsRef);

        const analytics = {
            total: 0,
            byPlan: {} as Record<SubscriptionTier, number>,
            byStatus: {} as Record<string, number>,
            mrr: 0, // Monthly Recurring Revenue
            arr: 0, // Annual Recurring Revenue
        };

        querySnapshot.docs.forEach((doc) => {
            const data = doc.data();
            analytics.total++;

            // Count by plan
            analytics.byPlan[data.plan as SubscriptionTier] =
                (analytics.byPlan[data.plan as SubscriptionTier] || 0) + 1;

            // Count by status
            analytics.byStatus[data.status] = (analytics.byStatus[data.status] || 0) + 1;

            // Calculate MRR
            if (data.status === 'active' && data.plan !== 'free') {
                const planPrice = SUBSCRIPTION_PLANS[data.plan as SubscriptionTier].price;
                analytics.mrr += planPrice;
            }
        });

        analytics.arr = analytics.mrr * 12;

        return analytics;
    } catch (error) {
        console.error('Error getting analytics:', error);
        return null;
    }
};

export default {
    getUserSubscription,
    createFreeTrialSubscription,
    upgradeSubscription,
    cancelSubscription,
    createInvoice,
    getUserInvoices,
    checkFeatureAccess,
    checkLimit,
    getSubscriptionAnalytics,
};
