import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useEffect, useMemo, useRef, useState } from 'react';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import ConsentModal from './src/components/ConsentModal';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import LoadingView from './src/components/LoadingView';
import { initSentry } from './src/config/sentry';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import ConsentPreferencesScreen from './src/screens/ConsentPreferencesScreen';
import DriverProfileScreen from './src/screens/DriverProfileScreen';
import DriverScreen from './src/screens/DriverScreen';
import DriverVacancyScreen from './src/screens/DriverVacancyScreen';
import EmailVerificationScreen from './src/screens/EmailVerificationScreen';
import GDPRSettingsScreen from './src/screens/GDPRSettingsScreen';
import LoginScreen from './src/screens/LoginScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import ParentalConsentScreen from './src/screens/ParentalConsentScreen';
import ParentHomeScreen from './src/screens/ParentHomeScreen';
import ParentProfileScreen from './src/screens/ParentProfileScreen';
import ParentRequestScreen from './src/screens/ParentRequestScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import SearchScreen from './src/screens/SearchScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import analyticsService from './src/services/analyticsService';
import consentService from './src/services/consentService';
// import crashlyticsService from './src/services/crashlyticsService';
// import firebasePerformanceService from './src/services/firebasePerformanceService';
import { setScreen } from './src/config/sentry';
import performanceService from './src/services/performanceService';

// Track app startup
performanceService.startTrace('app_startup');

// Initialize error tracking & crash reporting
initSentry();
// crashlyticsService.initialize(); // Requires native modules - disabled for Expo
// firebasePerformanceService.initialize(); // Requires native modules - disabled for Expo

const Stack = createStackNavigator();
const navigationRef = createNavigationContainerRef();

function Navigation() {
  const { user, loading, userProfile, isEmailVerified } = useAuth();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  useEffect(() => {
    // Check if user has seen onboarding
    const checkOnboarding = async () => {
      try {
        const value = await AsyncStorage.getItem('hasSeenOnboarding');
        setHasSeenOnboarding(value === 'true');
      } catch (error) {
        console.error('Error checking onboarding:', error);
        setHasSeenOnboarding(true); // Skip onboarding on error
      } finally {
        setCheckingOnboarding(false);
      }
    };

    checkOnboarding();
  }, []);

  useEffect(() => {
    if (!loading && user) {
      // App is ready - stop startup trace
      performanceService.stopTrace('app_startup', {
        role: userProfile?.role || 'unknown',
        authenticated: true,
        emailVerified: isEmailVerified,
      });
    }
  }, [loading, user, userProfile, isEmailVerified]);

  if (loading || checkingOnboarding) return <LoadingView />;

  // Show onboarding for first-time users (not logged in)
  if (!user && !hasSeenOnboarding) {
    return (
      <OnboardingScreen
        onComplete={() => {
          setHasSeenOnboarding(true);
        }}
      />
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="ParentalConsent" component={ParentalConsentScreen} />
        </>
      ) : !isEmailVerified ? (
        // User logged in but email not verified - block access
        <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
      ) : userProfile?.role === 'driver' ? (
        <>
          <Stack.Screen name="DriverHome" component={DriverScreen} />
          <Stack.Screen name="DriverProfile" component={DriverProfileScreen} />
          <Stack.Screen name="DriverVacancy" component={DriverVacancyScreen} />
          <Stack.Screen name="Search" component={SearchScreen} />
          <Stack.Screen name="GDPRSettings" component={GDPRSettingsScreen} />
          <Stack.Screen name="ConsentPreferences" component={ConsentPreferencesScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="ParentHome" component={ParentHomeScreen} />
          <Stack.Screen name="ParentProfile" component={ParentProfileScreen} />
          <Stack.Screen name="ParentRequest" component={ParentRequestScreen} />
          <Stack.Screen name="Search" component={SearchScreen} />
          <Stack.Screen name="GDPRSettings" component={GDPRSettingsScreen} />
          <Stack.Screen name="ConsentPreferences" component={ConsentPreferencesScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const routeNameRef = useRef(null);
  const [consentRefreshToken, setConsentRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const initConsent = async () => {
      await consentService.initialize();
      if (cancelled) return;
      analyticsService.setEnabled(consentService.canTrackAnalytics());
      setConsentRefreshToken((v) => v + 1);
    };
    initConsent();
    return () => {
      cancelled = true;
    };
  }, []);

  const consentVisible = useMemo(() => {
    return consentService.needsConsentPrompt();
  }, [consentRefreshToken]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <AuthProvider>
          <ConsentModal
            visible={consentVisible}
            onComplete={() => {
              // Force a rerender so consent-dependent gates update immediately
              setConsentRefreshToken((v) => v + 1);
            }}
          />
          <NavigationContainer
            ref={navigationRef}
            onReady={() => {
              const routeName = navigationRef.getCurrentRoute()?.name;
              routeNameRef.current = routeName;

              if (consentService.canTrackAnalytics()) {
                analyticsService.trackSessionStart();
                if (routeName) {
                  analyticsService.trackScreenView(routeName);
                }
              }
              if (routeName) {
                setScreen(routeName); // Sentry screen tracking
              }
            }}
            onStateChange={() => {
              const previousRouteName = routeNameRef.current;
              const currentRouteName = navigationRef.getCurrentRoute()?.name;
              if (currentRouteName && previousRouteName !== currentRouteName) {
                if (consentService.canTrackAnalytics()) {
                  analyticsService.trackScreenView(currentRouteName);
                }
                setScreen(currentRouteName); // Sentry screen tracking
              }
              routeNameRef.current = currentRouteName;
            }}
          >
            <Navigation />
          </NavigationContainer>
          <Toast />
        </AuthProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
