import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import useAuth from './src/hooks/useAuth';
import LoadingView from './src/components/LoadingView';

// Importar pantallas
import LoginScreen from './src/screens/LoginScreen';
import ParentHomeScreen from './src/screens/ParentHomeScreen';
import TrackingMap from './src/screens/TrackingMap';
import SettingsScreen from './src/screens/SettingsScreen';
import DriverScreen from './src/screens/DriverScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Configuración común de Tabs
const screenOptions = ({ route }) => ({
  tabBarIcon: ({ focused, color, size }) => {
    let iconName;

    if (route.name === 'Inicio') {
      iconName = focused ? 'home' : 'home-outline';
    } else if (route.name === 'GPS') {
      iconName = focused ? 'map' : 'map-outline';
    } else if (route.name === 'Conductor') {
      iconName = focused ? 'car' : 'car-outline';
    } else if (route.name === 'Configuración') {
      iconName = focused ? 'settings' : 'settings-outline';
    }

    return <Ionicons name={iconName} size={size} color={color} />;
  },
  tabBarActiveTintColor: '#2196F3',
  tabBarInactiveTintColor: 'gray',
  headerStyle: {
    backgroundColor: '#2196F3',
  },
  headerTintColor: '#fff',
  headerTitleStyle: {
    fontWeight: 'bold',
  },
  tabBarStyle: {
    paddingBottom: 5,
    paddingTop: 5,
    height: 60,
  },
});

// Navegador para PADRES
function ParentTabNavigator() {
  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen
        name="Inicio"
        component={ParentHomeScreen}
        options={{ title: 'Mis Hijos' }}
      />
      <Tab.Screen
        name="GPS"
        component={TrackingMap}
        options={{ title: 'Rastreo' }}
      />
      <Tab.Screen
        name="Configuración"
        component={SettingsScreen}
        options={{ title: 'Ajustes' }}
      />
    </Tab.Navigator>
  );
}

// Navegador para CONDUCTORES
function DriverTabNavigator() {
  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen
        name="Conductor"
        component={DriverScreen}
        options={{ title: 'Mi Ruta' }}
      />
      <Tab.Screen
        name="GPS"
        component={TrackingMap}
        options={{ title: 'Mapa' }}
      />
      <Tab.Screen
        name="Configuración"
        component={SettingsScreen}
        options={{ title: 'Ajustes' }}
      />
    </Tab.Navigator>
  );
}

import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  const { user, loading } = useAuth(); // Usar el hook refactorizado

  if (loading) {
    return <LoadingView message="Iniciando FurgoKid..." />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" backgroundColor="#1976D2" />

        {user ? (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {user.role === 'driver' ? (
              <Stack.Screen name="DriverApp" component={DriverTabNavigator} />
            ) : (
              <Stack.Screen name="ParentApp" component={ParentTabNavigator} />
            )}
          </Stack.Navigator>
        ) : (
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              cardStyle: { backgroundColor: '#fff' }
            }}
          >
            <Stack.Screen name="Login" component={LoginScreen} />
          </Stack.Navigator>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}