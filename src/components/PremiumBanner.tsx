/**
 * PremiumBanner - Banner promocional para suscripción Premium
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import premiumService from '../services/premiumService';

interface PremiumBannerProps {
  onUpgradePress?: () => void;
  compact?: boolean;
}

const PremiumBanner: React.FC<PremiumBannerProps> = ({ onUpgradePress, compact = false }) => {
  const [isPremium, setIsPremium] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      await premiumService.initialize();
      setIsPremium(premiumService.isPremium());
      setDaysRemaining(premiumService.getDaysRemaining());
    };
    checkStatus();
  }, []);

  if (isPremium) {
    // Show premium status
    return (
      <LinearGradient
        colors={['#FFD700', '#FFA500']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.container, compact && styles.containerCompact]}
      >
        <View style={styles.iconContainer}>
          <Ionicons name="star" size={compact ? 20 : 24} color="#fff" />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, compact && styles.titleCompact]}>Premium Activo</Text>
          {daysRemaining !== null && (
            <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>
              {daysRemaining} días restantes
            </Text>
          )}
        </View>
        <Ionicons name="checkmark-circle" size={24} color="#fff" />
      </LinearGradient>
    );
  }

  // Show upgrade prompt
  return (
    <TouchableOpacity onPress={onUpgradePress} activeOpacity={0.8}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.container, compact && styles.containerCompact]}
      >
        <View style={styles.iconContainer}>
          <Ionicons name="diamond" size={compact ? 20 : 24} color="#fff" />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, compact && styles.titleCompact]}>Hazte Premium</Text>
          <Text style={[styles.subtitle, compact && styles.subtitleCompact]}>
            Sin anuncios + más funciones
          </Text>
        </View>
        <View style={styles.ctaButton}>
          <Text style={styles.ctaText}>Desde $4.99/mes</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  containerCompact: {
    padding: 12,
    marginHorizontal: 0,
    marginVertical: 4,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  titleCompact: {
    fontSize: 16,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  subtitleCompact: {
    fontSize: 12,
  },
  ctaButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  ctaText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
});

export default PremiumBanner;
