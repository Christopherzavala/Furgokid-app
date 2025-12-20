# Guía de Configuración AdMob - FurgoKid

> [!CAUTION]
> **URGENTE:** Actualmente el proyecto usa AdMob **TEST IDs** que generan $0 revenue y pueden causar ban de Google. Sigue esta guía ANTES del próximo deployment a producción.

## 📊 Benchmarks de Industria

**Apps de tracking infantil similares:**
- ARPU promedio: **$2-$8/mes** con ads
- eCPM típico: $1.50-$4.00
- Fill rate esperado: 85-95%
- Click-through rate (CTR): 1.5-3%

**Con TEST IDs = $0 revenue** ❌

---

## Paso 1: Crear Cuenta AdMob

1. Ir a [admob.google.com](https://admob.google.com)
2. Iniciar sesión con cuenta Google
3. Aceptar términos de servicio
4. Completar información fiscal (requerido para pagos)

---

## Paso 2: Registrar la App

### Android

1. En AdMob Console → **Apps** → **Add App**
2. Seleccionar: "No" (la app aún no está publicada)
3. Platform: **Android**
4. App name: `FurgoKid`
5. Package name: `com.furgokid.app` (debe coincidir con `app.config.js`)
6. Copiar el **App ID** generado (formato: `ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX`)

### iOS

1. Repetir proceso anterior
2. Platform: **iOS**
3. Bundle ID: `com.furgokid.app`
4. Copiar el **App ID** de iOS

---

## Paso 3: Crear Ad Units

Para FurgoKid necesitamos 3 tipos de anuncios:

### 3.1 Banner Ad (Bottom of Screen)

- **Ubicación:** Pantallas principales (Home, Map)
- **Formato:** Adaptive Banner
- **Pasos:**
  1. Apps → FurgoKid (Android) → **Ad units** → **Add ad unit**
  2. Tipo: **Banner**
  3. Nombre: `FurgoKid_Home_Banner`
  4. Copiar **Ad unit ID**

### 3.2 Interstitial Ad (Full Screen)

- **Ubicación:** Al completar acciones (ej: marcar ubicación como visitada)
- **Frecuencia:** Max 1 cada 3 minutos
- **Pasos:**
  1. Tipo: **Interstitial**
  2. Nombre: `FurgoKid_Action_Interstitial`
  3. Copiar **Ad unit ID**

### 3.3 Rewarded Ad (Opcional - Funcionalidades Premium)

- **Uso futuro:** Desbloquear features premium con ads
- **Pasos:**
  1. Tipo: **Rewarded**
  2. Nombre: `FurgoKid_Premium_Rewarded`
  3. Copiar **Ad unit ID**

**Repetir para iOS** con los mismos nombres.

---

## Paso 4: Actualizar Variables de Entorno

Editar `.env` con los IDs reales:

```bash
# ============================================================================
# ADMOB CONFIGURATION (PRODUCTION)
# ============================================================================
# CRÍTICO: Nunca commitear este archivo a Git
# Los valores deben ser diferentes para Android/iOS

# AdMob App IDs (de Paso 2)
ADMOB_ANDROID_APP_ID=ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX
ADMOB_IOS_APP_ID=ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX

# Ad Unit IDs - Banner (de Paso 3.1)
BANNER_AD_UNIT_ANDROID=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
BANNER_AD_UNIT_IOS=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX

# Ad Unit IDs - Interstitial (de Paso 3.2)
INTERSTITIAL_AD_UNIT_ANDROID=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
INTERSTITIAL_AD_UNIT_IOS=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX

# Ad Unit IDs - Rewarded (de Paso 3.3)
REWARDED_AD_UNIT_ANDROID=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
REWARDED_AD_UNIT_IOS=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
```

---

## Paso 5: Migrar a EAS Secrets (Producción)

Para builds de producción, **NUNCA uses .env directamente**:

```bash
# Configurar secrets en EAS
eas secret:create --scope project --name ADMOB_ANDROID_APP_ID --value "ca-app-pub-XXX"
eas secret:create --scope project --name ADMOB_IOS_APP_ID --value "ca-app-pub-XXX"
eas secret:create --scope project --name BANNER_AD_UNIT_ANDROID --value "ca-app-pub-XXX"
eas secret:create --scope project --name BANNER_AD_UNIT_IOS --value "ca-app-pub-XXX"
# ... repetir para todos los IDs
```

Verificar:
```bash
eas secret:list
```

---

## Paso 6: Testing en Development Build

> [!WARNING]
> Los ads **NO funcionan en Expo Go**. Debes usar Development Build.

```bash
# Build de desarrollo
eas build --profile development --platform android

# Instalar APK en dispositivo
# Abrir app y verificar que los ads se muestren
```

**Checklist de testing:**
- [ ] Banner aparece en pantalla principal sin overlay content
- [ ] Interstitial se muestra después de acción (max 1 vez cada 3 min)
- [ ] Ads reales se cargan (no test ads con borde amarillo)
- [ ] Click en ad abre browser/Play Store correctamente
- [ ] App no crashea al cerrar ad

---

## Paso 7: Validar Impresiones en AdMob Console

1. Esperar 24-48 horas después del primer test
2. Ir a **AdMob Console → Apps → FurgoKid → Overview**
3. Verificar métricas:
   - **Requests:** Número de veces que se pidió un ad
   - **Impressions:** Ads efectivamente mostradas
   - **Fill rate:** % de requests que recibieron ad (objetivo: >85%)
   - **eCPM:** Revenue por 1000 impresiones

---

## Troubleshooting Común

### ❌ "Ad failed to load: ERROR_CODE_NO_FILL"
**Causa:** AdMob aún no tiene ads disponibles para tu app nueva.  
**Solución:** Esperar 24-48 horas. AdMob necesita tiempo para analizar tu app.

### ❌ Ads no aparecen en producción
**Causa:** Secrets no configurados en EAS o App ID incorrecto.  
**Solución:** 
```bash
eas secret:list
# Verificar que todos los secrets estén creados
# Reconstruir app: eas build --platform android --profile production
```

### ❌ "The ad unit ID is not recognized"
**Causa:** Mismatch entre ID en código y AdMob Console.  
**Solución:** Copiar IDs directamente desde AdMob Console (no escribir manualmente).

### ❌ App rechazada por Google Play (Política de Ads)
**Causa:** Ads cubriendo contenido crítico o frecuencia excesiva.  
**Solución:** 
- Banners: Solo en bottom, nunca overlay sobre botones
- Interstitials: Max 1 cada 3 minutos, nunca en flujos críticos de seguridad

---

## Optimización de Revenue (Post-Launch)

### Fase 1: Baseline (Mes 1-2)
- Mantener solo banners en pantallas principales
- Recolectar datos de eCPM y fill rate por pantalla
- Objetivo: Fill rate >85%

### Fase 2: Incremento (Mes 3-4)
- Agregar interstitials en 2-3 ubicaciones de bajo fricción
- A/B test de frecuencia (2 min vs 3 min vs 5 min)
- Monitorear impacto en retención (no bajar más de 5%)

### Fase 3: Optimización (Mes 5+)
- Implementar Google Ad Manager para mediation
- Agregar networks adicionales (Meta Audience Network, AppLovin)
- Target eCPM >$3.00

**Proyección conservadora (1000 DAU):**
- Impresiones/día: ~3,000 (3 por usuario)
- eCPM promedio: $2.50
- Revenue/día: **$7.50**
- Revenue/mes: **~$225**
- Revenue/año: **~$2,700**

**Con 5000 DAU → ~$13,500/año** 🚀

---

## Referencias

- [AdMob Best Practices](https://support.google.com/admob/answer/6128543)
- [Expo AdMob Plugin](https://docs.expo.dev/versions/latest/sdk/google-mobile-ads/)
- [AdMob Policy Center](https://support.google.com/admob/answer/6128543)

---

**Última actualización:** 2025-12-19  
**Autor:** CTO/Senior Architect
