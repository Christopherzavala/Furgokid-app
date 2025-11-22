import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as Font from 'expo-font';

// Importar pantallas
import LoginScreen from './src/screens/LoginScreen';
import ParentHomeScreen from './src/screens/ParentHomeScreen';
import TrackingMap from './src/screens/TrackingMap';
import SettingsScreen from './src/screens/SettingsScreen';
import DriverScreen from './src/screens/DriverScreen';

// Importar servicios
import { auth } from './src/config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { initializeLocationService } from './src/services/locationService';

// Configurar notificaciones
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Navegador de pestañas principal
function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
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
      })}
    >
      <Tab.Screen 
        name="Inicio" 
        component={ParentHomeScreen} 
        options={{ title: 'Panel Principal' }}
      />
      <Tab.Screen 
        name="GPS" 
        component={TrackingMap} 
        options={{ title: 'Ubicación GPS' }}
      />
      <Tab.Screen 
        name="Conductor" 
        component={DriverScreen} 
        options={{ title: 'Conductor' }}
      />
      <Tab.Screen 
        name="Configuración" 
        component={SettingsScreen} 
        options={{ title: 'Ajustes' }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Cargar fuentes
        await Font.loadAsync({
          'Roboto': require('react-native-vector-icons/Fonts/Roboto.ttf'),
          'Roboto-Medium': require('react-native-vector-icons/Fonts/Roboto-Medium.ttf'),
        });
        setFontsLoaded(true);

        // Configurar servicios de ubicación
        await initializeLocationService();

        // Configurar listener de autenticación
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          setUser(user);
          setLoading(false);
        });

        return unsubscribe;
      } catch (error) {
        console.error('Error initializing app:', error);
        Alert.alert('Error', 'No se pudo inicializar la aplicación. Intenta reiniciar.');
        setLoading(false);
      }
    };

    initializeApp();
  }, []);

  if (loading || !fontsLoaded) {
    return (
      <View style={{
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: '#fff'
      }}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor="#1976D2" />
      
      {user ? (
        <Stack.Navigator 
          screenOptions={{
            headerStyle: { backgroundColor: '#2196F3' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: 'bold' },
            gestureEnabled: true,
          }}
        >
          <Stack.Screen 
            name="Main" 
            component={MainTabNavigator} 
            options={{ headerShown: false }}
          />
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
  );
}