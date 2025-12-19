import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '@/src/config/firebase';
import { router } from 'expo-router';
import {
    SUBSCRIPTION_PLANS,
    SubscriptionTier,
    formatPrice,
    UserSubscription,
} from '@/src/types/subscription';
import {
    getUserSubscription,
    upgradeSubscription,
    cancelSubscription,
} from '@/src/services/subscriptionService';

export default function SubscriptionScreen() {
    const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
    const [loading, setLoading] = useState(true);
    const [upgrading, setUpgrading] = useState(false);

    useEffect(() => {
        loadSubscription();
    }, []);

    const loadSubscription = async () => {
        if (!auth.currentUser) return;

        try {
            const subscription = await getUserSubscription(auth.currentUser.uid);
            setCurrentSubscription(subscription);
        } catch (error) {
            console.error('Error loading subscription:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpgrade = async (plan: SubscriptionTier) => {
        if (!auth.currentUser) return;

        Alert.alert(
            'Confirmar Suscripción',
            `¿Deseas suscribirte al ${SUBSCRIPTION_PLANS[plan].name} por ${formatPrice(
                SUBSCRIPTION_PLANS[plan].price
            )}/mes?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Confirmar',
                    onPress: async () => {
                        setUpgrading(true);
                        try {
                            const success = await upgradeSubscription(auth.currentUser!.uid, plan);
                            if (success) {
                                Alert.alert('¡Éxito!', 'Tu suscripción ha sido actualizada.');
                                await loadSubscription();
                            } else {
                                Alert.alert('Error', 'No se pudo procesar la suscripción.');
                            }
                        } catch (error) {
                            Alert.alert('Error', 'Ocurrió un error al procesar el pago.');
                        } finally {
                            setUpgrading(false);
                        }
                    },
                },
            ]
        );
    };

    const handleCancel = async () => {
        if (!auth.currentUser) return;

        Alert.alert(
            'Cancelar Suscripción',
            '¿Estás seguro que deseas cancelar tu suscripción? Mantendrás el acceso hasta el final del período actual.',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'Sí, Cancelar',
                    style: 'destructive',
                    onPress: async () => {
                        const success = await cancelSubscription(auth.currentUser!.uid);
                        if (success) {
                            Alert.alert('Cancelado', 'Tu suscripción será cancelada al final del período.');
                            await loadSubscription();
                        }
                    },
                },
            ]
        );
    };

    const renderPlanCard = (tier: SubscriptionTier) => {
        const plan = SUBSCRIPTION_PLANS[tier];
        const isCurrent = currentSubscription?.plan === tier;
        const isUpgrade =
            currentSubscription &&
            ['free', 'basic', 'family', 'school'].indexOf(currentSubscription.plan) <
            ['free', 'basic', 'family', 'school'].indexOf(tier);

        if (tier === 'enterprise') {
            return (
                <View key={tier} style={[styles.planCard, styles.enterpriseCard]}>
                    <View style={styles.planHeader}>
                        <Text style={styles.planName}>{plan.name}</Text>
                        <Text style={styles.planPriceCustom}>Precio Personalizado</Text>
                    </View>
                    <View style={styles.featuresContainer}>
                        {plan.features.map((feature, index) => (
                            <View key={index} style={styles.featureRow}>
                                <Ionicons name="checkmark-circle" size={20} color="#9C27B0" />
                                <Text style={styles.featureText}>{feature}</Text>
                            </View>
                        ))}
                    </View>
                    <TouchableOpacity
                        style={[styles.button, styles.enterpriseButton]}
                        onPress={() => Alert.alert('Contacto', 'Envía un email a sales@furgokid.com')}
                    >
                        <Text style={styles.buttonText}>Contactar Ventas</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View
                key={tier}
                style={[
                    styles.planCard,
                    isCurrent && styles.currentPlanCard,
                    tier === 'family' && styles.popularCard,
                ]}
            >
                {tier === 'family' && (
                    <View style={styles.popularBadge}>
                        <Text style={styles.popularText}>MÁS POPULAR</Text>
                    </View>
                )}
                <View style={styles.planHeader}>
                    <Text style={styles.planName}>{plan.name}</Text>
                    <View style={styles.priceContainer}>
                        <Text style={styles.planPrice}>{formatPrice(plan.price)}</Text>
                        <Text style={styles.planInterval}>/{plan.interval === 'month' ? 'mes' : 'año'}</Text>
                    </View>
                </View>

                <View style={styles.featuresContainer}>
                    {plan.features.map((feature, index) => (
                        <View key={index} style={styles.featureRow}>
                            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                            <Text style={styles.featureText}>{feature}</Text>
                        </View>
                    ))}
                </View>

                {isCurrent ? (
                    <View style={styles.currentBadge}>
                        <Ionicons name="checkmark-circle" size={20} color="#fff" />
                        <Text style={styles.currentBadgeText}>Plan Actual</Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={[
                            styles.button,
                            tier === 'family' && styles.popularButton,
                            upgrading && styles.buttonDisabled,
                        ]}
                        onPress={() => handleUpgrade(tier)}
                        disabled={upgrading}
                    >
                        {upgrading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>
                                {isUpgrade ? 'Mejorar Plan' : tier === 'free' ? 'Probar Gratis' : 'Seleccionar'}
                            </Text>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2196F3" />
                <Text style={styles.loadingText}>Cargando suscripción...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Planes y Precios</Text>
                <Text style={styles.subtitle}>Elige el plan perfecto para ti</Text>
            </View>

            {currentSubscription && currentSubscription.plan !== 'free' && (
                <View style={styles.currentSubscriptionCard}>
                    <View style={styles.subscriptionInfo}>
                        <Ionicons name="information-circle" size={24} color="#2196F3" />
                        <View style={styles.subscriptionDetails}>
                            <Text style={styles.subscriptionTitle}>Suscripción Actual</Text>
                            <Text style={styles.subscriptionPlan}>
                                {SUBSCRIPTION_PLANS[currentSubscription.plan].name}
                            </Text>
                            <Text style={styles.subscriptionRenewal}>
                                Renueva el{' '}
                                {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString('es-ES')}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                        <Text style={styles.cancelButtonText}>Cancelar</Text>
                    </TouchableOpacity>
                </View>
            )}

            <View style={styles.plansContainer}>
                {renderPlanCard('free')}
                {renderPlanCard('basic')}
                {renderPlanCard('family')}
                {renderPlanCard('school')}
                {renderPlanCard('enterprise')}
            </View>

            <View style={styles.footer}>
                <Text style={styles.footerText}>
                    Todos los planes incluyen 14 días de prueba gratuita
                </Text>
                <Text style={styles.footerSubtext}>Cancela en cualquier momento</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#666',
    },
    header: {
        padding: 24,
        backgroundColor: '#2196F3',
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#E3F2FD',
    },
    currentSubscriptionCard: {
        backgroundColor: '#fff',
        margin: 16,
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    subscriptionInfo: {
        flexDirection: 'row',
        flex: 1,
    },
    subscriptionDetails: {
        marginLeft: 12,
        flex: 1,
    },
    subscriptionTitle: {
        fontSize: 12,
        color: '#666',
        marginBottom: 4,
    },
    subscriptionPlan: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    subscriptionRenewal: {
        fontSize: 14,
        color: '#666',
    },
    cancelButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#f44336',
    },
    cancelButtonText: {
        color: '#f44336',
        fontSize: 14,
        fontWeight: '600',
    },
    plansContainer: {
        padding: 16,
    },
    planCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    currentPlanCard: {
        borderWidth: 2,
        borderColor: '#2196F3',
    },
    popularCard: {
        borderWidth: 2,
        borderColor: '#FF9800',
    },
    enterpriseCard: {
        borderWidth: 2,
        borderColor: '#9C27B0',
    },
    popularBadge: {
        position: 'absolute',
        top: -10,
        right: 20,
        backgroundColor: '#FF9800',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    popularText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    planHeader: {
        marginBottom: 16,
    },
    planName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    planPrice: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#2196F3',
    },
    planPriceCustom: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#9C27B0',
    },
    planInterval: {
        fontSize: 16,
        color: '#666',
        marginLeft: 4,
    },
    featuresContainer: {
        marginBottom: 20,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    featureText: {
        fontSize: 14,
        color: '#666',
        marginLeft: 12,
        flex: 1,
    },
    button: {
        backgroundColor: '#2196F3',
        padding: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    popularButton: {
        backgroundColor: '#FF9800',
    },
    enterpriseButton: {
        backgroundColor: '#9C27B0',
    },
    buttonDisabled: {
        backgroundColor: '#90CAF9',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    currentBadge: {
        backgroundColor: '#4CAF50',
        padding: 12,
        borderRadius: 8,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    currentBadgeText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    footer: {
        alignItems: 'center',
        padding: 24,
    },
    footerText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginBottom: 8,
    },
    footerSubtext: {
        fontSize: 12,
        color: '#999',
    },
});
