import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getAdUnitId } from '../config/AdMobConfig';

/**
 * AdBannerComponent - Componente reutilizable para mostrar banners AdMob
 * Uso: <AdBannerComponent placement="home" size="BANNER" />
 */
const AdBannerComponent = ({ placement = 'BANNER_HOME', userRole = 'parent' }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const adUnitId = getAdUnitId(placement, userRole);

  // Si no hay Ad Unit ID, no mostrar nada
  if (!adUnitId) {
    return null;
  }

  useEffect(() => {
    // Simulacion: En produccion, llamar a GoogleMobileAds.loadBanner
    const timer = setTimeout(() => {
      setLoaded(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, [adUnitId]);

  if (!loaded) {
    return (
      <View style={{ height: 50, justifyContent: 'center' }}>
        <ActivityIndicator size="small" color="#999" />
      </View>
    );
  }

  // Placeholder para cuando se integre GoogleMobileAds
  return (
    <View
      style={{
        height: 50,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 12, color: '#666' }}>Ad Banner - {placement}</Text>
    </View>
  );
};

export default AdBannerComponent;
