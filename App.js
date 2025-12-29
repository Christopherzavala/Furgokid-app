import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useRef } from 'react';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import LoadingView from './src/components/LoadingView';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import DriverProfileScreen from './src/screens/DriverProfileScreen';
import DriverScreen from './src/screens/DriverScreen';
import DriverVacancyScreen from './src/screens/DriverVacancyScreen';
import LoginScreen from './src/screens/LoginScreen';
import ParentHomeScreen from './src/screens/ParentHomeScreen';
import ParentRequestScreen from './src/screens/ParentRequestScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import SearchScreen from './src/screens/SearchScreen';
import analyticsService from './src/services/analyticsService';

const Stack = createStackNavigator();
const navigationRef = createNavigationContainerRef();

function Navigation() {
  const { user, loading, userProfile } = useAuth();
  if (loading) return <LoadingView />;
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : userProfile?.role === 'driver' ? (
        <>
          <Stack.Screen name="DriverHome" component={DriverScreen} />
          <Stack.Screen name="DriverProfile" component={DriverProfileScreen} />
          <Stack.Screen name="DriverVacancy" component={DriverVacancyScreen} />
          <Stack.Screen name="Search" component={SearchScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="ParentHome" component={ParentHomeScreen} />
          <Stack.Screen name="ParentRequest" component={ParentRequestScreen} />
          <Stack.Screen name="Search" component={SearchScreen} />
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
