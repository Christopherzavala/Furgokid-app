# FurGoKid Senior - Configuración de Desarrollo

## 🚀 Inicio Rápido

### 1. Instalar Expo CLI
```bash
npm install -g @expo/cli eas-cli
```

### 2. Iniciar Desarrollo
```bash
npx expo start
```

### 3. Pruebas
```bash
# iOS Simulator
npx expo start --ios

# Android Emulator  
npx expo start --android

# Web
npx expo start --web
```

## 📱 Configuración de Dispositivos

### iOS Simulator
1. Abrir Xcode
2. Tools > Simulator
3. Seleccionar dispositivo iOS

### Android Emulator
1. Abrir Android Studio
2. Crear/selector AVD
3. Iniciar emulador

### Dispositivo Físico
1. Instalar Expo Go
2. Escanear QR code

## 🔧 Variables de Entorno

Crear archivo `.env.local`:
```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_maps_api_key
EXPO_PUBLIC_ADMOB_BANNER_ID=your_banner_id
EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID=your_interstitial_id
```

## 🛠️ Debugging

### React Native Debugger
```bash
npm install -g react-native-debugger
```

### Flipper
```bash
# Descargar Flipper Desktop
# https://fbflipper.com/
```

### Reactotron
```bash
npm install --save-dev reactotron-react-native
```

## 📋 Testing

### Tests Unitarios
```bash
npm test
```

### Tests E2E
```bash
npx expo test
```

## 🚀 Build y Deploy

### Desarrollo
```bash
eas build --profile development --platform all
```

### Preview
```bash
eas build --profile preview --platform all
```

### Producción
```bash
eas build --profile production --platform all
```

### Deploy Automático
```bash
eas submit --platform all
```

## 🐛 Troubleshooting

### Metro Bundler Issues
```bash
npx expo start --clear
```

### Cache Issues
```bash
rm -rf node_modules
npm install
npx expo start --clear
```

### Firebase Issues
- Verificar credenciales
- Confirmar permisos de red
- Revisar configuración de proyecto

### Mapas No Carga
- Verificar Google Maps API Key
- Confirmar billing habilitado
- Revisar restricciones de API

---

**¡Listo para desarrollo Senior Ultra!**