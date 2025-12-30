import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useEffect, useRef } from 'react';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import LoadingView from './src/components/LoadingView';
import { initSentry } from './src/config/sentry';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import DriverProfileScreen from './src/screens/DriverProfileScreen';
import DriverScreen from './src/screens/DriverScreen';
import DriverVacancyScreen from './src/screens/DriverVacancyScreen';
import GDPRSettingsScreen from './src/screens/GDPRSettingsScreen';
import LoginScreen from './src/screens/LoginScreen';
import ParentalConsentScreen from './src/screens/ParentalConsentScreen';
import ParentHomeScreen from './src/screens/ParentHomeScreen';
import ParentRequestScreen from './src/screens/ParentRequestScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import SearchScreen from './src/screens/SearchScreen';
import analyticsService from './src/services/analyticsService';
import crashlyticsService from './src/services/crashlyticsService';
import firebasePerformanceService from './src/services/firebasePerformanceService';
import performanceService from './src/services/performanceService';

// Track app startup
performanceService.startTrace('app_startup');

// Initialize error tracking & crash reporting
initSentry();
crashlyticsService.initialize();
firebasePerformanceService.initialize();

const Stack = createStackNavigator();
const navigationRef = createNavigationContainerRef();

function Navigation() {
  const { user, loading, userProfile } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      // App is ready - stop startup trace
      performanceService.stopTrace('app_startup', {
        role: userProfile?.role || 'unknown',
        authenticated: true,
      });
    }
  }, [loading, user, userProfile]);

  if (loading) return <LoadingView />;
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="ParentalConsent" component={ParentalConsentScreen} />
        </>
      ) : userProfile?.role === 'driver' ? (
        <>
          <Stack.Screen name="DriverHome" component={DriverScreen} />
          <Stack.Screen name="DriverProfile" component={DriverProfileScreen} />
          <Stack.Screen name="DriverVacancy" component={DriverVacancyScreen} />
          <Stack.Screen name="Search" component={SearchScreen} />
          <Stack.Screen name="GDPRSettings" component={GDPRSettingsScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="ParentHome" component={ParentHomeScreen} />
          <Stack.Screen name="ParentRequest" component={ParentRequestScreen} />
          <Stack.Screen name="Search" component={SearchScreen} />
          <Stack.Screen name="GDPRSettings" component={GDPRSettingsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const routeNameRef = useRef(null);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <AuthProvider>
          <NavigationContainer
            ref={navigationRef}
            onReady={() => {
              const routeName = navigationRef.getCurrentRoute()?.name;
              routeNameRef.current = routeName;
              analyticsService.trackSessionStart();
              if (routeName) analyticsService.trackScreenView(routeName);
            }}
            onStateChange={() => {
              const previousRouteName = routeNameRef.current;
              const currentRouteName = navigationRef.getCurrentRoute()?.name;
              if (currentRouteName && previousRouteName !== currentRouteName) {
                analyticsService.trackScreenView(currentRouteName);
              }
              routeNameRef.current = currentRouteName;
            }}
          >
            <Navigation />
          </NavigationContainer>
        </AuthProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
