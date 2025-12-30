/**
 * Onboarding Flow Component
 * Welcome tutorial for first-time users
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    title: '¡Bienvenido a FurgoKid!',
    description:
      'Rastrea el transporte escolar en tiempo real y mantente informado sobre la ubicación de tus hijos.',
    icon: 'bus',
    color: '#2196F3',
  },
  {
    id: '2',
    title: 'Notificaciones Inteligentes',
    description:
      'Recibe alertas cuando el transporte esté cerca de tu ubicación o llegue al destino.',
    icon: 'notifications',
    color: '#4CAF50',
  },
  {
    id: '3',
    title: 'Seguro y Privado',
    description:
      'Tus datos están protegidos. Solo tú puedes ver la información de tus rutas y ubicaciones.',
    icon: 'shield-checkmark',
    color: '#FF9800',
  },
];

const ONBOARDING_SHOWN_KEY = '@furgokid_onboarding_shown';

interface OnboardingProps {
  onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_SHOWN_KEY, 'true');
      onComplete();
    } catch (error) {
      console.error('[Onboarding] Error saving completion status:', error);
      onComplete();
    }
  };

  const currentSlide = SLIDES[currentIndex];

  return (
    <View style={styles.container}>
      {/* Skip button */}
      {currentIndex < SLIDES.length - 1 && (
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          accessible={true}
          accessibilityLabel="Saltar tutorial"
          accessibilityRole="button"
        >
          <Text style={styles.skipText}>Saltar</Text>
        </TouchableOpacity>
      )}

      {/* Slide content */}
      <View style={styles.slideContainer}>
        <View style={[styles.iconContainer, { backgroundColor: currentSlide.color }]}>
          <Ionicons name={currentSlide.icon} size={100} color="#fff" />
        </View>

        <Text style={styles.title}>{currentSlide.title}</Text>
        <Text style={styles.description}>{currentSlide.description}</Text>
      </View>

      {/* Pagination dots */}
      <View style={styles.pagination}>
        {SLIDES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentIndex && styles.activeDot,
              index === currentIndex && { backgroundColor: currentSlide.color },
            ]}
          />
        ))}
      </View>

      {/* Next/Get Started button */}
      <TouchableOpacity
        style={[styles.nextButton, { backgroundColor: currentSlide.color }]}
        onPress={handleNext}
        accessible={true}
        accessibilityLabel={currentIndex === SLIDES.length - 1 ? 'Comenzar' : 'Siguiente'}
        accessibilityRole="button"
      >
        <Text style={styles.nextButtonText}>
          {currentIndex === SLIDES.length - 1 ? 'Comenzar' : 'Siguiente'}
        </Text>
        <Ionicons name="arrow-forward" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

/**
 * Check if onboarding should be shown
 */
export const shouldShowOnboarding = async (): Promise<boolean> => {
  try {
    const shown = await AsyncStorage.getItem(ONBOARDING_SHOWN_KEY);
    return shown !== 'true';
  } catch {
    return true; // Show by default if error
  }
};

/**
 * Reset onboarding (for testing or user settings)
 */
export const resetOnboarding = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(ONBOARDING_SHOWN_KEY);
  } catch (error) {
    console.error('[Onboarding] Error resetting:', error);
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'space-between',
    paddingVertical: 50,
  },
  skipButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  skipText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  slideContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  iconContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#DDD',
    marginHorizontal: 5,
  },
  activeDot: {
    width: 30,
    height: 10,
    borderRadius: 5,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 30,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginRight: 8,
  },
});
