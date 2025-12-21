import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ParentHomeScreen from './src/screens/ParentHomeScreen';
import DriverScreen from './src/screens/DriverScreen';
import LoadingView from './src/components/LoadingView';

const Stack = createStackNavigator();

function Navigation() {
  const { user, loading, userData } = useAuth();

  if (loading) return <LoadingView />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : (
        userData?.role === 'conductor' ? (
          <Stack.Screen name="DriverHome" component={DriverScreen} />
        ) : (
          <Stack.Screen name="ParentHome" component={ParentHomeScreen} />
        )
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <Navigation />
      </NavigationContainer>
    </AuthProvider>
  );
}
