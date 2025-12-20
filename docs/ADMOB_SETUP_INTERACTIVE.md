# Setup Interactivo de AdMob - FurgoKid

## 🎯 Objetivo

Configurar cuenta AdMob REAL para habilitar monetización.

**Impacto:** Pasar de **$0/mes** a **$225-$1,125/mes** (proyección con 1K DAU).

---

## ✅ Pre-requisitos

- [ ] Cuenta Google activa
- [ ] 15-20 minutos de tiempo
- [ ] Acceso a esta terminal

---

## Paso 1: Crear Cuenta AdMob

### 1.1 Ir a AdMob Console

Abre en tu navegador:
```
https://admob.google.com
```

### 1.2 Iniciar Sesión

- Usa tu cuenta Google principal (la que usas para Play Console si ya tienes)
- Acepta términos de servicio

### 1.3 Completar Información

AdMob te pedirá:
- **País:** [Tu país]
- **Zona horaria:** [Tu zona horaria]
- **Información fiscal:** (Requerido para recibir pagos)

> **CTO Tip:** Usa la misma cuenta Google que usarás para Google Play Console. Simplifica gestión de pagos.

---

## Paso 2: Registrar App Android

### 2.1 Agregar App

En AdMob Console:
1. Click **"Apps"** (menú lateral)
2. Click **"Add App"**

### 2.2 Configurar App

**¿La app ya está publicada?**
- Selecciona: **"No"** (aún no está en Play Store)

**Platform:**
- Selecciona: **Android**

**App name:**
```
FurgoKid
```

**Package name:**
```
com.furgokid.app
```

> ⚠️ **CRÍTICO:** El package name DEBE coincidir EXACTAMENTE con `app.config.js` (línea 29).

### 2.3 Copiar App ID

AdMob generará un **App ID** con formato:
```
ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX
```

**📋 ACCIÓN:** Copia este ID y pégalo aquí (reemplaza XXXX):
```
ADMOB_ANDROID_APP_ID=
```

---

## Paso 3: Crear Ad Units (Android)

### 3.1 Banner Ad

En la app que acabas de crear:
1. Click **"Ad units"** → **"Add ad unit"**
2. Tipo: **Banner**
3. Nombre: `FurgoKid_Home_Banner`
4. Click **"Create ad unit"**

**📋 Copiar Ad Unit ID:**
```
BANNER_AD_UNIT_ANDROID=
```

### 3.2 Interstitial Ad

Repetir proceso:
1. Tipo: **Interstitial**
2. Nombre: `FurgoKid_Action_Interstitial`

**📋 Copiar Ad Unit ID:**
```
INTERSTITIAL_AD_UNIT_ANDROID=
```

### 3.3 Rewarded Ad (Opcional)

Si quieres features premium con ads:
1. Tipo: **Rewarded**
2. Nombre: `FurgoKid_Premium_Rewarded`

**📋 Copiar Ad Unit ID:**
```
REWARDED_AD_UNIT_ANDROID=
```

---

## Paso 4: Registrar App iOS (Opcional - Si desarrollas para iOS)

Si solo harás Android por ahora, **SALTA al Paso 5**.

### 4.1 Agregar App iOS

Repetir Paso 2 pero:
- Platform: **iOS**
- Bundle ID: `com.furgokid.app`

**📋 Copiar iOS App ID:**
```
ADMOB_IOS_APP_ID=
```

### 4.2 Crear Ad Units iOS

Repetir Paso 3 para iOS (mismos nombres de ad units).

---

## Paso 5: Actualizar .env

Una vez tengas todos los IDs copiados, ejecuta este comando en la terminal:

```powershell
notepad .env
```

Actualiza estas líneas con tus IDs REALES:

```bash
# ============================================================================
# ADMOB CONFIGURATION (PRODUCTION - IDs REALES)
# ============================================================================

# AdMob App IDs
ADMOB_ANDROID_APP_ID=ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX
ADMOB_IOS_APP_ID=ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX

# Ad Unit IDs - Android
BANNER_AD_UNIT_ANDROID=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
INTERSTITIAL_AD_UNIT_ANDROID=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
REWARDED_AD_UNIT_ANDROID=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX

# Ad Unit IDs - iOS (opcional si aún no haces iOS)
BANNER_AD_UNIT_IOS=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
INTERSTITIAL_AD_UNIT_IOS=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
REWARDED_AD_UNIT_IOS=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
```

**Guardar y cerrar** (Ctrl+S).

---

## Paso 6: Validar Configuración

Ejecuta en terminal:

```bash
npm run security:audit
```

**Resultado esperado:**
```
[CRITICO] AdMob usando IDs de TEST en produccion
```

Debería cambiar a:
```
[OK] AdMob configurado con IDs reales
```

Si aún sale test IDs, verifica que actualizaste `.env` correctamente.

---

## Paso 7: Testing en Development Build

> ⚠️ **Los ads NO funcionan en Expo Go**. Necesitas Development Build.

### 7.1 Build de Desarrollo

```bash
eas build --profile development --platform android --local
```

### 7.2 Instalar APK

1. Conecta dispositivo Android vía USB
2. Habilita "Depuración USB" en el dispositivo
3. Instala el APK generado

### 7.3 Validar Ads

En la app:
- ✅ Banner debe aparecer en pantalla principal
- ✅ No debe tener borde amarillo (eso = test ad)
- ✅ Debe mostrar ads REALES
- ✅ Al hacer click, debe abrir navegador/Play Store

---

## Paso 8: Monitorear en AdMob Console

**Esperar 24-48 horas** después del primer testing.

1. Ir a **AdMob Console → Apps → FurgoKid → Overview**
2. Verificar métricas:
   - **Requests:** > 0
   - **Impressions:** > 0
   - **Fill rate:** Objetivo >85%

---

## 🚨 Troubleshooting

### "Ad failed to load: ERROR_CODE_NO_FILL"

**Normal para apps nuevas.** AdMob necesita 24-48 hrs para analizar tu app y asignar campañas.

**Solución:** Esperar y volver a testear.

---

### Ads no se muestran (solo espacio en blanco)

**Causa:** IDs incorrectos o `.env` no sincronizado.

**Solución:**
```bash
# Verificar que .env tiene IDs correctos
cat .env | findstr ADMOB

# Reiniciar servidor Expo
npm start
```

---

### App rechazada por Google Play (Política de Ads)

**Causa:** Ads cubriendo contenido critical o frecuencia excesiva.

**Solución:**
- Banners: Solo en bottom, nunca overlay sobre botones de seguridad
- Interstitials: Max 1 cada 3 minutos

---

## ✅ Checklist Final

Marca cuando termines cada paso:

- [ ] Cuenta AdMob creada
- [ ] App Android registrada (App ID copiado)
- [ ] 3 ad units creados (Banner, Interstitial, Rewarded)
- [ ] `.env` actualizado con IDs reales
- [ ] `npm run security:audit` reporta "IDs reales"
- [ ] Development build generado
- [ ] Ads testeados en dispositivo real
- [ ] AdMob Console monitoreado (después de 24-48 hrs)

---

## 📊 Proyección de Revenue (Post-Setup)

| DAU | Impresiones/día | eCPM | Revenue/mes |
|-----|-----------------|------|-------------|
| 500 | 1,500 | $2.50 | ~$112 |
| 1,000 | 3,000 | $2.50 | ~$225 |
| 5,000 | 15,000 | $2.50 | ~$1,125 |

**Con test IDs = $0/mes** ❌

---

## 🎯 Siguiente Paso (Después de Completar)

Una vez termines el setup de AdMob, continúa con:

```bash
# Migración a EAS Secrets (Fase 6)
npm run eas:migrate:dry
```

---

**¿Listo para empezar?**

Abre https://admob.google.com en tu navegador y comienza desde el Paso 1.

**Avísame cuando termines cada paso** y te guío con el siguiente.
