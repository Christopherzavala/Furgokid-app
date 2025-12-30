# 🐛 Sentry Setup - Pasos Completados

## ✅ Paso 1: Cuenta Creada

- **Organización:** FurgoKid
- **Email:** christopher.zaval4@gmail.com
- **URL:** https://furgokid.sentry.io/
- **Plan:** Prueba gratuita 14 días (5,000 eventos/mes después)

---

## 📋 Paso 2: Crear Proyecto React Native

### En Sentry Dashboard:

1. **Ir a:** https://furgokid.sentry.io/projects/new/

2. **Seleccionar plataforma:**

   - Buscar y seleccionar: **React Native**

3. **Configurar proyecto:**

   ```
   Project name: furgokid-app
   Alert frequency: On every new issue
   Team: #furgokid (o default)
   ```

4. **Click:** "Create Project"

---

## 📋 Paso 3: Obtener DSN

Después de crear el proyecto, Sentry mostrará:

### Página de configuración mostrará el DSN:

```
DSN: https://XXXXXX@YYYYYY.ingest.sentry.io/ZZZZZZ
```

**Ejemplo:**

```
https://abc123def456@o4507234567890.ingest.sentry.io/4507234567891
```

### O navegar manualmente:

1. https://furgokid.sentry.io/settings/projects/furgokid-app/keys/
2. Copiar el "DSN" (Client Keys)

---

## 📋 Paso 4: Configurar DSN en EAS

### En tu terminal (PowerShell):

```powershell
# Asegúrate de estar en el directorio del proyecto
cd C:\Users\Dell\Desktop\Furgokid

# Login a EAS si no lo has hecho
eas login

# Agregar DSN como secret
eas secret:create --scope project --name SENTRY_DSN --value "PEGAR_TU_DSN_AQUI"

# Ejemplo:
# eas secret:create --scope project --name SENTRY_DSN --value "https://abc123@o123.ingest.sentry.io/456"

# Verificar que se creó correctamente
eas secret:list
```

### Output esperado:

```
┌────────────┬─────────────────────┬───────────┐
│ Name       │ Value               │ Updated   │
├────────────┼─────────────────────┼───────────┤
│ SENTRY_DSN │ https://abc...      │ Just now  │
└────────────┴─────────────────────┴───────────┘
```

---

## 📋 Paso 5: Actualizar eas.json

Ya está configurado en tu proyecto, pero verificar:

```json
// eas.json - Ya debe tener esto en el profile production:
"production": {
  "env": {
    "SENTRY_ENABLED": "true",
    "SENTRY_DSN": "eas-secret:SENTRY_DSN"  // ← Esto usa el secret
  }
}
```

---

## ✅ Paso 6: Verificar Integración

### Construir preview para probar:

```powershell
npm run build:preview
```

### En los logs del build, debes ver:

```
[Sentry] Initialized (preview, sample rate: 0.5)
```

### Forzar un error de prueba:

En cualquier screen, temporalmente agregar:

```typescript
// Test Sentry
throw new Error('Test Sentry Integration');
```

Correr la app y verificar que el error aparece en:
https://furgokid.sentry.io/issues/

---

## 🎯 Configuraciones Recomendadas en Sentry

### 1. Alert Rules

**En:** https://furgokid.sentry.io/alerts/rules/

Crear regla:

- **Trigger:** When an event occurs
- **Filter:** All events
- **Action:** Send notification to email
- **Frequency:** On every new issue

### 2. Release Tracking

**En:** https://furgokid.sentry.io/settings/projects/furgokid-app/release-tracking/

- Habilitar: "Auto-assign commits to releases"
- Conectar: GitHub repository (opcional)

### 3. Performance Monitoring

**En:** https://furgokid.sentry.io/settings/projects/furgokid-app/performance/

- Sample Rate: 20% (ya configurado en sentry.ts)
- Enable Tracing: ON

### 4. User Feedback

**En:** https://furgokid.sentry.io/settings/projects/furgokid-app/user-feedback/

- Enable User Crash Reports: ON

---

## 📊 Monitoreo Post-Deployment

### Dashboard principal:

https://furgokid.sentry.io/issues/

### Métricas a vigilar:

- **Crash-free rate:** Debe ser >99%
- **APDEX score:** Debe ser >0.9
- **Error rate:** <1% de sesiones
- **Response time p95:** <2 segundos

---

## 🔄 Plan después de 14 días

Después del trial:

- **Plan Free:** 5,000 eventos/mes (suficiente para empezar)
- **Plan Team:** $26/mes si necesitas más

**Recomendación:** Empezar con Free, upgrade solo si llegas al límite

---

## ✅ Checklist Final

- [x] Cuenta Sentry creada
- [ ] Proyecto React Native creado
- [ ] DSN copiado
- [ ] Secret agregado a EAS: `eas secret:create`
- [ ] Build de prueba realizado
- [ ] Error test enviado y visible en Sentry
- [ ] Alert rules configuradas

---

## 🆘 Troubleshooting

### Sentry no recibe eventos:

1. **Verificar DSN en secrets:**

   ```powershell
   eas secret:list
   ```

2. **Verificar en logs del build:**

   ```
   [Sentry] Initialized (production, sample rate: 1.0)
   ```

3. **Forzar crash de prueba:**

   ```typescript
   Sentry.captureException(new Error('Manual test'));
   ```

4. **Verificar environment:**
   - Preview: Sample rate 50%
   - Production: Sample rate 100%

### DSN no válido:

Formato correcto:

```
https://PUBLIC_KEY@ORGANIZATION.ingest.sentry.io/PROJECT_ID
```

NO usar:

- DSN "deprecated" (sin ingest)
- API keys (diferentes a DSN)
- Auth tokens

---

**Última actualización:** 29 Diciembre 2025  
**Siguiente paso:** Crear proyecto en Sentry y copiar DSN
