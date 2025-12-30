# Store Submission Checklist

## 📋 Pre-Build Checklist

### Configuración

- [ ] Perfiles EAS production/preview configurados en `eas.json`
- [ ] Variables de entorno configuradas en EAS Secrets
- [ ] Version y build number actualizados en `app.config.js`
- [ ] Bundle identifier único configurado (Android/iOS)

### Testing

- [ ] Tests pasando (87/87) - `npm run test:coverage`
- [ ] TypeScript sin errores - `npm run type-check`
- [ ] Lint sin errores - `npm run lint`
- [ ] Smoke tests pasando - `npm run smoke:test`

### Seguridad

- [ ] No hay secrets hardcodeados en código
- [ ] Firebase keys con restricciones configuradas
- [ ] Sentry DSN en EAS Secrets (no en .env)
- [ ] `.env` en `.gitignore`

---

## 🏗️ Build Production

### 1. Version Bump

```bash
# Actualizar version en app.config.js
# version: "1.0.1" → "1.0.2"
# android.versionCode: 1 → 2
# ios.buildNumber: "1" → "2"
```

### 2. Build Android

```bash
# Production build (AAB para Play Store)
eas build --platform android --profile production

# Esperar ~10-15 minutos
# Descargar .aab cuando esté listo
```

### 3. Build iOS (requiere Mac o EAS)

```bash
# Production build (IPA para App Store)
eas build --platform ios --profile production
```

---

## 📱 Google Play Store

### Assets Requeridos

#### Iconos y Screenshots

- [ ] Icon: 512x512px (PNG, sin transparencia)
- [ ] Feature Graphic: 1024x500px
- [ ] Screenshots teléfono: mín 2, máx 8 (16:9 ratio)
  - Landscape: 1920x1080px
  - Portrait: 1080x1920px
- [ ] Screenshots tablet: mín 2 (opcional)

#### Textos

- [ ] Título: "FurgoKid - Transporte Escolar" (max 50 chars)
- [ ] Descripción corta: max 80 chars
- [ ] Descripción larga: max 4000 chars
- [ ] Categoría: "Educación" o "Productividad"

### Información Legal

- [ ] Privacy Policy URL: `https://[tu-dominio]/privacy`
- [ ] Política de privacidad publicada
- [ ] Términos de servicio (opcional)
- [ ] Contact email configurado
- [ ] Dirección física (si monetizas)

### Content Rating

- [ ] Completar cuestionario de clasificación
- [ ] Declarar ads (AdMob)
- [ ] Target audience: Familias

### App Content

- [ ] Declarar uso de ubicación
- [ ] Permisos justificados en descripción
- [ ] Declarar uso de datos personales
- [ ] Configurar data safety (Google)

---

## 🍎 Apple App Store

### Assets Requeridos

#### Iconos y Screenshots

- [ ] App Icon: 1024x1024px (sin transparencia)
- [ ] Screenshots iPhone:
  - 6.5" (1284x2778px): mín 1
  - 5.5" (1242x2208px): mín 1
- [ ] Screenshots iPad (opcional):
  - 12.9" (2048x2732px)

#### Metadata

- [ ] App Name: "FurgoKid" (max 30 chars)
- [ ] Subtitle: "Tracking Transporte Escolar" (max 30 chars)
- [ ] Keywords: separados por comas (max 100 chars)
- [ ] Description: max 4000 chars
- [ ] Promotional Text: max 170 chars (editable)

### App Information

- [ ] Primary Category: Education
- [ ] Secondary Category: Navigation (opcional)
- [ ] Content Rights: Declarar derechos
- [ ] Age Rating: 4+

### Privacy

- [ ] Privacy Policy URL
- [ ] Declarar recolección de datos:
  - Location (background)
  - Contact info (email)
  - User content (messages)
- [ ] Purpose strings en Info.plist configurados

---

## 🔍 Pre-Submission Testing

### Android Testing Track

```bash
# Submit to Internal Testing
eas submit --platform android --profile production --track internal

# Invitar testers (max 100 en internal track)
# Validar durante 2-3 días
```

### Validaciones Críticas

#### Startup Performance

- [ ] Cold start < 2.5s en dispositivos target
- [ ] Firebase inicializa correctamente
- [ ] No crashes en arranque

#### Core Features

- [ ] Login/Registro funciona
- [ ] Mapa carga y muestra ubicación
- [ ] Notificaciones push funcionan
- [ ] Background location tracking activo

#### Monetización

- [ ] Banners AdMob se muestran
- [ ] Interstitials aparecen después de acciones
- [ ] No errores de ads en producción

#### Analytics y Monitoring

- [ ] Sentry captura errores (validar en dashboard)
- [ ] Eventos de analytics se registran (si habilitado)
- [ ] Performance metrics se envían

---

## 📊 KPIs Post-Launch

### Primeras 48 horas

- [ ] Crash-free rate >= 99.5%
- [ ] Average startup time <= 2.5s
- [ ] Ad fill rate >= 80%
- [ ] User retention Day 1 >= 50%

### Primera semana

- [ ] Reviews >= 4.0 stars
- [ ] Crash rate < 0.5%
- [ ] Daily active users trend positivo
- [ ] AdMob revenue > $0 (salir de test mode)

---

## 🚨 Rollout Strategy

### Staged Rollout (Recomendado)

**Day 1-2:** 10% de usuarios

- Monitorear crashes
- Validar performance
- Revisar reviews

**Day 3-5:** 50% de usuarios

- Si crash rate < 1%
- Si no hay issues críticos

**Day 6+:** 100% de usuarios

- Después de validar estabilidad

### Emergency Rollback

Si crash rate > 2%:

```bash
# Pausar rollout en Play Console
# Preparar hotfix
# Submit nuevo build
```

---

## 📝 Documentation for Stores

### Google Play - What's New (Release Notes)

```
Version 1.0.0 - Initial Release

✨ Nuevas funcionalidades:
• Tracking en tiempo real de transporte escolar
• Notificaciones de llegada del conductor
• Mapa interactivo con ubicación en vivo
• Sistema de mensajería con conductor

🔒 Seguridad y privacidad:
• Autenticación segura con Firebase
• Permisos de ubicación solo cuando usas la app
• Tus datos están protegidos

📧 Contacto: support@furgokid.com
```

### Apple - What's New

```
¡Bienvenido a FurgoKid! 🚌

La forma más segura de hacer seguimiento del transporte escolar de tus hijos.

Características:
• Ubicación en tiempo real
• Notificaciones automáticas
• Chat con el conductor
• Historial de rutas

¿Preguntas? Escríbenos a support@furgokid.com
```

---

## ✅ Final Checklist

### Pre-Submit

- [ ] Build production completado sin errores
- [ ] Smoke tests pasados
- [ ] Assets subidos (icons, screenshots)
- [ ] Metadata completo
- [ ] Privacy policy publicada
- [ ] Content rating completado

### Post-Submit

- [ ] Submitted to review (Android/iOS)
- [ ] Monitoring configurado (Sentry dashboard)
- [ ] Support email monitoreado
- [ ] Staged rollout configurado
- [ ] Team notificado de launch

### Post-Launch (Primera semana)

- [ ] Crash rate monitoreado diariamente
- [ ] Reviews respondidos
- [ ] Analytics revisado
- [ ] Hotfix preparado (si necesario)

---

## 📞 Support

**Si encuentras problemas:**

1. Revisar [Troubleshooting](#troubleshooting) abajo
2. Consultar logs de Sentry
3. Escalar a equipo de desarrollo

---

## Troubleshooting

### Build falla en EAS

**Error:** "Gradle build failed"

```bash
# Limpiar cache
npm run clean
npm install --legacy-peer-deps
eas build --platform android --profile production --clear-cache
```

### App rechazada por Google

**Razón común:** Permisos no justificados

- Agregar justificación en descripción
- Actualizar data safety declarations

### App rechazada por Apple

**Razón común:** Privacy strings faltantes

- Verificar Info.plist tiene todos los `UsageDescription`
- Re-submit con descripción clara del uso

---

**Owner:** Mobile Team  
**Última actualización:** 2025-12-29
