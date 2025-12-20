# Integración de Google Mobile Ads (AdMob) en FurgoKid

## Descripción General

Esta documentación explica cómo se ha integrado Google Mobile Ads (AdMob) en la aplicación FurgoKid para monetización mediante anuncios.

## Archivos Creados

### 1. `src/config/adMobConfig.ts`

Archivo de configuración centralizado que contiene:

- **IDs de aplicación (App IDs)**: Para iOS y Android
- **IDs de anuncios (Ad Unit IDs)**: Para diferentes tipos de anuncios y pantallas
  - Anuncios de banner
  - Anuncios intersticiales
  - Anuncios recompensados
- **Función auxiliar `getAdUnitId()`**: Para obtener el ID de anuncio correcto según el tipo y la pantalla

### 2. `components/ads/BannerAd.tsx`

Componente reutilizable para mostrar anuncios de banner:

- Maneja la carga y visualización de banners
- Soporte para diferentes tamaños (SMART_BANNER por defecto)
- Manejo de errores y eventos de carga
- Fácil integración en pantallas

**Uso:**
```tsx
import BannerAd from '@/components/ads/BannerAd';

<BannerAd screenName="homeScreen" />
```

### 3. `components/ads/InterstitialAd.tsx`

Componente para mostrar anuncios intersticiales a pantalla completa:

- Carga automática de anuncios
- Recarga después de que se cierren
- Callbacks para eventos (onAdClosed, onAdFailedToLoad)
- Método `showAd()` para mostrar el anuncio

**Uso:**
```tsx
const interstitialRef = useRef();

<InterstitialAd 
  screenName="afterTracking"
  ref={interstitialRef}
  onAdClosed={() => console.log('Ad closed')}
/>

// Mostrar el anuncio cuando se necesite
interstitialRef.current?.showAd();
```

## Configuración Inicial

### 1. Reemplazar IDs de Prueba por IDs Reales

En `src/config/adMobConfig.ts`, reemplaza los IDs de prueba con tus IDs reales:

```typescript
export const AD_MOB_CONFIG = {
  appId: {
    ios: 'ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy',    // Tu App ID de iOS
    android: 'ca-app-pub-xxxxxxxxxxxxxxxx~zzzzzzzzzz', // Tu App ID de Android
  },
  bannerAds: {
    homeScreen: {
      ios: 'ca-app-pub-tu-id-ios',
      android: 'ca-app-pub-tu-id-android',
    },
    // ...
  },
  // ...
};
```

### 2. Configurar en app.json (Expo)

Asegura que tu archivo `app.json` incluya la configuración de AdMob:

```json
{
  "expo": {
    "plugins": [
      [
        "google-mobile-ads",
        {
          "appIdIos": "ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy",
          "appIdAndroid": "ca-app-pub-xxxxxxxxxxxxxxxx~zzzzzzzzzz"
        }
      ]
    ]
  }
}
```

## Integración en Pantallas

### Agregar Anuncios de Banner

En cualquier pantalla:

```tsx
import BannerAd from '@/components/ads/BannerAd';

export default function ParentHomeScreen() {
  return (
    <ScrollView>
      {/* Contenido de la pantalla */}
      <BannerAd screenName="homeScreen" />
    </ScrollView>
  );
}
```

### Agregar Anuncios Intersticiales

```tsx
import InterstitialAd from '@/components/ads/InterstitialAd';
const interstitialRef = useRef();

export default function TrackingMap() {
  const handleStopTracking = () => {
    // Mostrar anuncio intersticial
    interstitialRef.current?.showAd();
    
    // Realizar acción
    // ...
  };

  return (
    <>
      <InterstitialAd 
        screenName="afterTracking"
        ref={interstitialRef}
      />
      {/* Resto del contenido */}
    </>
  );
}
```

## IDs de Prueba de Google

Para desarrollo y pruebas, Google proporciona IDs de prueba:

- **App ID de prueba (Android)**: `ca-app-pub-3940256099942544~3347511713`
- **Banner de prueba**: `ca-app-pub-3940256099942544/6300978111`
- **Intersticial de prueba**: `ca-app-pub-3940256099942544/1033173712`
- **Rewarded de prueba**: `ca-app-pub-3940256099942544/5224354917`

Estos IDs están actualmente configurados en `adMobConfig.ts`.

## Política de Anuncios

### Ubicación Recomendada de Anuncios

- **Banners**: Al inicio/final de pantallas principales
- **Intersticiales**: Después de completar acciones importantes
- **Recompensados**: Para desbloquear features premium

### Mejores Prácticas

1. No mostrar anuncios intersticiales continuamente
2. Permitir que se carguen los anuncios antes de mostrarlos
3. Respetar los tiempos de carga
4. Monitorear el rendimiento y la retención de usuarios

## Siguientes Pasos

1. Crear cuenta en [AdMob Console](https://admob.google.com)
2. Crear aplicación y generar IDs de anuncios
3. Reemplazar IDs de prueba con IDs reales
4. Probar en dispositivos reales
5. Enviar aplicación a App Store y Play Store

## Recursos Útiles

- [Google Mobile Ads SDK - React Native](https://firebase.google.com/docs/admob/react-native/get-started)
- [AdMob Console](https://admob.google.com)
- [Google Ads Policies](https://support.google.com/adspolicy)

## Problemas Comunes

### Anuncios no se muestran
- Verificar que los IDs de anuncios sean correctos
- Asegurarse de que AdMob esté inicializado
- Revisar la consola de logs

### Errores de carga
- Usar IDs de prueba en desarrollo
- Esperar a que se carguen los anuncios antes de mostrar
- Verificar conexión a internet
