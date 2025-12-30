# Sentry Setup Guide

## 📋 Tabla de Contenidos

- [Introducción](#introducción)
- [Configuración Inicial](#configuración-inicial)
- [Instalación](#instalación)
- [Configuración de Secrets](#configuración-de-secrets)
- [Integración en la App](#integración-en-la-app)
- [Testing](#testing)
- [Monitoreo y Alertas](#monitoreo-y-alertas)
- [Troubleshooting](#troubleshooting)

---

## Introducción

Sentry proporciona error tracking, crash reporting y performance monitoring para FurgoKid.

**Características:**

- 🐛 Error tracking en tiempo real
- 📊 Performance monitoring (APM)
- 🔔 Alertas personalizables
- 🔒 PII scrubbing automático
- 📈 Release tracking

---

## Configuración Inicial

### 1. Crear Cuenta Sentry

1. Ir a [sentry.io](https://sentry.io)
2. Crear cuenta (plan gratuito incluye 5K eventos/mes)
3. Crear nuevo proyecto → Seleccionar "React Native"

### 2. Obtener DSN

Después de crear el proyecto:

1. Ir a **Settings** → **Projects** → [Tu Proyecto]
2. Click en **Client Keys (DSN)**
3. Copiar el DSN (formato: `https://[key]@[org].ingest.sentry.io/[project]`)

**Ejemplo:**

```
https://1234567890abcdef1234567890abcdef@o123456.ingest.sentry.io/1234567
```

---

## Instalación

### Instalar Dependencias

```bash
npm install @sentry/react-native --save
```

### Configurar Sentry CLI (Opcional - para source maps)

```bash
npm install @sentry/cli --save-dev

# Configurar auth token
npx sentry-cli login
```

---

## Configuración de Secrets

### Opción 1: EAS Secrets (Recomendado para Producción)

```bash
# Login a EAS
eas login

# Configurar DSN
eas secret:create --scope project --name SENTRY_DSN --value "https://..."

# Configurar org (para source maps)
eas secret:create --scope project --name SENTRY_ORG --value "your-org"

# Configurar project
eas secret:create --scope project --name SENTRY_PROJECT --value "your-project"
```

### Opción 2: Variables de Entorno Local (.env)

```bash
# .env (para desarrollo)
SENTRY_DSN=https://1234567890abcdef1234567890abcdef@o123456.ingest.sentry.io/1234567
SENTRY_ORG=your-org
SENTRY_PROJECT=furgokid-app
```

⚠️ **IMPORTANTE:** `.env` debe estar en `.gitignore`

---

## Integración en la App

### 1. Actualizar app.config.js

```javascript
export default ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_ENABLED: process.env.SENTRY_ENABLED || 'false',
  },
});
```

### 2. Inicializar Sentry en App.js

```typescript
// App.js
import { initSentry } from './src/config/sentry';

// Inicializar Sentry ANTES de renderizar la app
initSentry();

export default function App() {
  // ... rest of app
}
```

### 3. Usar Sentry en tu código

```typescript
import { captureException, captureMessage, setUser } from './src/config/sentry';

// Capturar excepciones
try {
  riskyOperation();
} catch (error) {
  captureException(error, { context: 'User Action' });
}

// Capturar mensajes
captureMessage('User completed onboarding', 'info');

// Setear usuario (sin PII)
setUser({ id: userId, role: 'parent' });
```

---

## Testing

### Desarrollo Local

```bash
# Test con Sentry deshabilitado (default en dev)
npm start
```

### Preview Build (con Sentry habilitado)

```bash
# Build con Sentry
SENTRY_ENABLED=true npm run build:preview

# Instalar y probar
# Trigger un error para validar que llega a Sentry
```

### Validar en Sentry Dashboard

1. Ir a tu proyecto en sentry.io
2. Click en **Issues**
3. Debe aparecer el error capturado

---

## Monitoreo y Alertas

### Configurar Alertas

1. **Sentry Dashboard** → **Alerts**
2. Crear nueva alerta:

**Alertas Recomendadas:**

| Alerta             | Condición                 | Acción        |
| ------------------ | ------------------------- | ------------- |
| Crash Rate Alto    | Crash rate > 1% en 1 hora | Email + Slack |
| Errores de Red     | > 50 errores/hora         | Email         |
| Performance Issues | p95 > 3s en 5 minutos     | Slack         |

### Sample Rates por Entorno

```typescript
// src/config/sentry.ts ya configurado:
// - Development: 0% (deshabilitado)
// - Preview: 50%
// - Production: 100% errors, 20% traces
```

---

## KPIs y Métricas

### Objetivos (según roadmap-criteria.md)

- **Crash-free sessions:** >= 99.5%
- **Error rate:** < 0.5% de sesiones
- **Response time (p95):** < 400ms

### Dashboard Sentry

Ver en **Performance** → **Transactions**:

- App startup time
- Screen render time
- API call latency

---

## Troubleshooting

### Sentry no captura errores

**Causa:** DSN no configurado o Sentry deshabilitado

**Solución:**

```bash
# Verificar que SENTRY_ENABLED=true en build
eas build --platform android --profile preview

# Verificar DSN en secrets
eas secret:list
```

### Source maps no funcionan

**Causa:** Sentry CLI no configurado

**Solución:**

```bash
# Instalar Sentry CLI
npm install @sentry/cli --save-dev

# Configurar en app.config.js
hooks: {
  postPublish: [
    {
      file: "sentry-expo/upload-sourcemaps",
      config: {
        organization: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
      }
    }
  ]
}
```

### Eventos duplicados

**Causa:** Sentry inicializado múltiples veces

**Solución:** Inicializar solo una vez en `App.js` principal

---

## Checklist de Implementación

- [ ] Cuenta Sentry creada
- [ ] DSN obtenido
- [ ] Secrets configurados en EAS (`SENTRY_DSN`)
- [ ] `@sentry/react-native` instalado
- [ ] Sentry inicializado en `App.js`
- [ ] PII scrubbing configurado
- [ ] Sample rates definidos por entorno
- [ ] Alertas configuradas (crash rate, errors)
- [ ] Source maps configurados (opcional)
- [ ] Testing en preview build validado
- [ ] Dashboard monitoreado

---

## Referencias

- [Sentry React Native Docs](https://docs.sentry.io/platforms/react-native/)
- [EAS Secrets Guide](./EAS_SECRETS_MIGRATION.md)
- [Roadmap Criteria](./roadmap-criteria.md)

---

**Última actualización:** 2025-12-29  
**Owner:** Mobile Team
