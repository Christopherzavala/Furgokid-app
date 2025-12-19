# 🔐 Guía de Implementación: Google Sign-In - FurgoKid

## 📋 Objetivo
Implementar autenticación con Google para permitir a los usuarios iniciar sesión rápidamente.

---

## 🚀 Paso 1: Configurar Google Cloud Console

### 1.1 Crear Proyecto en Google Cloud

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Nombre del proyecto: **FurgoKid**

### 1.2 Habilitar Google Sign-In API

1. En el menú lateral, ve a **APIs & Services** > **Library**
2. Busca "Google Sign-In API"
3. Click en **Enable**

### 1.3 Configurar OAuth Consent Screen

1. Ve a **APIs & Services** > **OAuth consent screen**
2. Selecciona **External** (para usuarios fuera de tu organización)
3. Completa la información:
   - **App name**: FurgoKid
   - **User support email**: tu-email@example.com
   - **Developer contact**: tu-email@example.com
4. Click en **Save and Continue**
5. En **Scopes**, agrega:
   - `email`
   - `profile`
   - `openid`
6. Click en **Save and Continue**

### 1.4 Crear Credenciales OAuth 2.0

#### Para Android:

1. Ve a **APIs & Services** > **Credentials**
2. Click en **Create Credentials** > **OAuth client ID**
3. Selecciona **Android**
4. Nombre: **FurgoKid Android**
5. Package name: `com.furgokid.app` (o el que uses)
6. SHA-1: Obtén ejecutando:
   ```bash
   # En Windows (PowerShell)
   cd android
   ./gradlew signingReport
   
   # Busca el SHA-1 en la salida
   ```
7. Click en **Create**
8. **Copia el Client ID**

#### Para iOS:

1. Click en **Create Credentials** > **OAuth client ID**
2. Selecciona **iOS**
3. Nombre: **FurgoKid iOS**
4. Bundle ID: `com.furgokid.app`
5. Click en **Create**
6. **Copia el Client ID**

#### Para Web (Expo Go):

1. Click en **Create Credentials** > **OAuth client ID**
2. Selecciona **Web application**
3. Nombre: **FurgoKid Web**
4. Authorized redirect URIs:
   - `https://auth.expo.io/@tu-usuario/furgokid`
5. Click en **Create**
6. **Copia el Client ID y Client Secret**

---

## 🔧 Paso 2: Configurar Firebase

### 2.1 Habilitar Google Sign-In en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto **FurgoKid**
3. Ve a **Authentication** > **Sign-in method**
4. Click en **Google**
5. **Habilita** el proveedor
6. Agrega tu **Web client ID** (del paso anterior)
7. Click en **Save**

---

## 📦 Paso 3: Instalar Dependencias

```bash
# Instalar Google Sign-In
npx expo install @react-native-google-signin/google-signin

# Instalar dependencias adicionales
npm install @react-native-google-signin/google-signin
```

---

## 🔨 Paso 4: Configurar en el Código

### 4.1 Actualizar `app.json`

```json
{
  "expo": {
    "android": {
      "googleServicesFile": "./google-services.json",
      "config": {
        "googleSignIn": {
          "apiKey": "TU_ANDROID_API_KEY",
          "certificateHash": "TU_SHA1_HASH"
        }
      }
    },
    "ios": {
      "googleServicesFile": "./GoogleService-Info.plist",
      "config": {
        "googleSignIn": {
          "reservedClientId": "TU_IOS_CLIENT_ID"
        }
      }
    },
    "plugins": [
      "@react-native-google-signin/google-signin"
    ]
  }
}
```

### 4.2 Crear Servicio de Google Sign-In

Crea `src/services/googleAuthService.ts`:

```typescript
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../config/firebase';

// Configurar Google Sign-In
export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    offlineAccess: true,
  });
};

// Iniciar sesión con Google
export const signInWithGoogle = async () => {
  try {
    // 1. Verificar si Google Play Services está disponible
    await GoogleSignin.hasPlayServices();

    // 2. Obtener información del usuario
    const userInfo = await GoogleSignin.signIn();

    // 3. Crear credencial de Firebase
    const googleCredential = GoogleAuthProvider.credential(userInfo.idToken);

    // 4. Iniciar sesión en Firebase
    const userCredential = await signInWithCredential(auth, googleCredential);

    return {
      success: true,
      user: userCredential.user,
    };
  } catch (error: any) {
    console.error('Error signing in with Google:', error);
    
    let errorMessage = 'Error al iniciar sesión con Google';
    
    if (error.code === 'SIGN_IN_CANCELLED') {
      errorMessage = 'Inicio de sesión cancelado';
    } else if (error.code === 'IN_PROGRESS') {
      errorMessage = 'Inicio de sesión en progreso';
    } else if (error.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
      errorMessage = 'Google Play Services no disponible';
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
};

// Cerrar sesión de Google
export const signOutFromGoogle = async () => {
  try {
    await GoogleSignin.signOut();
    return true;
  } catch (error) {
    console.error('Error signing out from Google:', error);
    return false;
  }
};

// Verificar si el usuario está conectado con Google
export const isSignedInWithGoogle = async () => {
  return await GoogleSignin.isSignedIn();
};
```

### 4.3 Actualizar `app/login.tsx`

Reemplaza el handler del botón de Google:

```typescript
import { signInWithGoogle, configureGoogleSignIn } from '../../src/services/googleAuthService';

export default function LoginScreen() {
  // ... código existente ...

  useEffect(() => {
    // Configurar Google Sign-In al montar el componente
    configureGoogleSignIn();
  }, []);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    
    try {
      const result = await signInWithGoogle();
      
      if (result.success) {
        Alert.alert('¡Éxito!', 'Sesión iniciada con Google');
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', result.error || 'No se pudo iniciar sesión');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  // En el JSX, actualiza el botón:
  <TouchableOpacity
    style={styles.googleButton}
    onPress={handleGoogleSignIn}
    disabled={loading}
  >
    <Ionicons name="logo-google" size={24} color="#DB4437" />
    <Text style={styles.googleButtonText}>Ingresar con Google</Text>
  </TouchableOpacity>
}
```

---

## 🔐 Paso 5: Variables de Entorno

Crea/actualiza `.env`:

```env
# Google Sign-In
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=123456789-android.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=123456789-ios.apps.googleusercontent.com
```

---

## 🧪 Paso 6: Testing

### 6.1 Desarrollo con Expo Go

**Limitación**: Google Sign-In no funciona completamente en Expo Go.

**Solución**: Crear un Development Build

```bash
# Instalar EAS CLI
npm install -g eas-cli

# Login en Expo
eas login

# Configurar proyecto
eas build:configure

# Crear development build para Android
eas build --profile development --platform android

# Crear development build para iOS
eas build --profile development --platform ios
```

### 6.2 Testing en Emulador/Dispositivo

1. Descarga el development build
2. Instala en tu dispositivo
3. Ejecuta `npx expo start --dev-client`
4. Prueba el botón de Google Sign-In

---

## 📊 Flujo de Autenticación

```
Usuario presiona "Ingresar con Google"
    ↓
Google Sign-In SDK abre pantalla de selección de cuenta
    ↓
Usuario selecciona cuenta de Google
    ↓
Google devuelve ID Token
    ↓
App crea credencial de Firebase con ID Token
    ↓
Firebase autentica al usuario
    ↓
Usuario redirigido a pantalla principal
```

---

## 🔍 Solución de Problemas

### Error: "Developer Error"
**Causa**: SHA-1 incorrecto o Client ID incorrecto  
**Solución**: Verifica que el SHA-1 y Client ID coincidan

### Error: "SIGN_IN_REQUIRED"
**Causa**: Usuario no seleccionó cuenta  
**Solución**: Normal, el usuario canceló

### Error: "PLAY_SERVICES_NOT_AVAILABLE"
**Causa**: Google Play Services no instalado (emuladores)  
**Solución**: Usa un dispositivo real o emulador con Google Play

### Error: "API not enabled"
**Causa**: Google Sign-In API no habilitada  
**Solución**: Habilita en Google Cloud Console

---

## 🎨 Mejoras Opcionales

### 1. Botón de Apple Sign-In (iOS)

```typescript
import * as AppleAuthentication from 'expo-apple-authentication';

const handleAppleSignIn = async () => {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    
    // Autenticar con Firebase
    const provider = new OAuthProvider('apple.com');
    const firebaseCredential = provider.credential({
      idToken: credential.identityToken!,
    });
    
    await signInWithCredential(auth, firebaseCredential);
  } catch (error) {
    console.error('Apple Sign-In error:', error);
  }
};
```

### 2. Botón de Facebook Sign-In

```bash
npm install react-native-fbsdk-next
```

---

## 📈 Métricas de Éxito

Después de implementar Google Sign-In, monitorea:

1. **Tasa de conversión**: % de usuarios que usan Google vs Email
2. **Tiempo de registro**: Reducción esperada del 70%
3. **Abandono**: Reducción esperada del 50%
4. **Retención**: Aumento esperado del 20%

---

## ✅ Checklist de Implementación

- [ ] Crear proyecto en Google Cloud Console
- [ ] Configurar OAuth Consent Screen
- [ ] Crear credenciales OAuth 2.0 (Android, iOS, Web)
- [ ] Habilitar Google Sign-In en Firebase
- [ ] Instalar dependencias
- [ ] Configurar `app.json`
- [ ] Crear servicio de Google Auth
- [ ] Actualizar pantalla de login
- [ ] Configurar variables de entorno
- [ ] Crear development build
- [ ] Testing en dispositivo real
- [ ] Documentar para el equipo

---

## 🚀 Próximos Pasos

1. **Semana 1**: Configurar Google Cloud y Firebase
2. **Semana 2**: Implementar código
3. **Semana 3**: Testing exhaustivo
4. **Semana 4**: Lanzamiento

---

**Última actualización**: 2025-11-25  
**Versión**: 1.0  
**Estado**: ✅ UI Implementada, Funcionalidad Documentada
