# Migración a EAS Secrets - Guía de Implementación

## Por qué EAS Secrets

**Problema:** Archivos `.env` son fáciles de leakear a Git, pueden ser comprometidos en laptops robadas, y no tienen control de acceso granular.

**Solución:** EAS Secrets es un sistema de gestión de secretos encriptado y específico por entorno (development, preview, production).

**Impacto financiero:** Un leak de Firebase keys puede costar $10K-$50K+ en abuso de APIs.

---

## Prerequisitos

```bash
# Instalar EAS CLI globalmente
npm install -g eas-cli

# Login a Expo
eas login

# Verificar que el proyecto esté vinculado
eas whoami
```

---

## Paso 1: Auditar Secrets Actuales

Ejecutar auditoría de seguridad:

```powershell
.\scripts\security-audit.ps1
```

Si detecta `.env` en historial de Git → **ROTAR TODAS LAS KEYS** inmediatamente.

---

## Paso 2: Exportar Secrets desde .env

Crear script temporal para migración:

```powershell
# migrate-to-eas.ps1
$envContent = Get-Content ".env"

foreach ($line in $envContent) {
    if ($line -match "^([A-Z_]+)=(.+)$") {
        $key = $matches[1]
        $value = $matches[2]
        
        # Saltar comentarios y líneas vacías
        if ($key -notmatch "^#") {
            Write-Host "Creando secret: $key" -ForegroundColor Cyan
            eas secret:create --scope project --name $key --value $value --force
        }
    }
}

Write-Host "`n✅ Migración completada" -ForegroundColor Green
```

Ejecutar:
```powershell
.\migrate-to-eas.ps1
```

---

## Paso 3: Validar Secrets Creados

```bash
eas secret:list
```

Deberías ver:
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `ADMOB_ANDROID_APP_ID`
- `ADMOB_IOS_APP_ID`
- `GOOGLE_MAPS_API_KEY`

---

## Paso 4: Actualizar eas.json

Editar `eas.json` para usar secrets en diferentes perfiles:

```json
{
  "cli": {
    "version": ">= 5.2.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "APP_VARIANT": "development"
      }
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "APP_VARIANT": "preview"
      }
    },
    "production": {
      "env": {
        "APP_VARIANT": "production"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

**Nota:** EAS automáticamente inyecta los secrets en `process.env` durante el build. No necesitas referenciarlos explícitamente en `eas.json`.

---

## Paso 5: Testing Local con .env (Development)

Para desarrollo local, **mantener `.env` pero con valores de desarrollo/test:**

```bash
# .env (DESARROLLO LOCAL ÚNICAMENTE)
FIREBASE_API_KEY=your-dev-key-here
FIREBASE_PROJECT_ID=furgokid-dev
ADMOB_ANDROID_APP_ID=ca-app-pub-3940256099942544~3347511713  # Test ID
ADMOB_IOS_APP_ID=ca-app-pub-3940256099942544~1458002511      # Test ID
```

Para producción, EAS usará los secrets encriptados automáticamente.

---

## Paso 6: Build con EAS Secrets

```bash
# Development build (usa .env local)
eas build --profile development --platform android --local

# Production build (usa EAS Secrets)
eas build --profile production --platform android
```

Durante el build de producción, verás:
```
✔ Loaded environment variables from EAS
```

---

## Paso 7: Rotar Secrets (Si Hubo Leak)

### Firebase

1. Ir a [Firebase Console](https://console.firebase.google.com)
2. Project Settings → General → **Delete Project** (si es crítico)
3. O restringir API Key:
   - Cloud Console → APIs & Services → Credentials
   - Editar API key → Application restrictions → Android/iOS apps
   - Agregar SHA-1 fingerprint del certificado de signing

### Google Maps API

1. [Google Cloud Console](https://console.cloud.google.com)
2. APIs & Services → Credentials
3. Rotar API key (crea nueva, elimina antigua)
4. Actualizar secret en EAS:
```bash
eas secret:create --scope project --name GOOGLE_MAPS_API_KEY --value "NEW_KEY" --force
```

### AdMob

- AdMob IDs son públicos (visibles en APK), **NO necesitan rotación**.
- Solo proteger las credenciales de acceso a la cuenta AdMob.

---

## Best Practices

### ✅ DO

- Usar EAS Secrets para **todos** los builds de producción
- Mantener `.env` en `.gitignore`
- Rotar secrets cada 6-12 meses (compliance)
- Usar diferentes Firebase projects para dev/staging/prod
- Documentar qué secret se usa en qué entorno

### ❌ DON'T

- Commitear `.env` a Git (NUNCA)
- Hardcodear secrets en código fuente
- Compartir secrets por Slack/Email
- Usar mismos secrets en dev y prod
- Dejar secrets de test en producción

---

## Troubleshooting

### "Failed to fetch secrets from EAS"

```bash
# Re-login
eas logout
eas login

# Verificar proyecto
eas project:info
```

### Secrets no se inyectan en build

```bash
# Verificar que existan
eas secret:list

# Rebuild limpio
eas build --profile production --platform android --clear-cache
```

### .env tomando precedencia sobre EAS Secrets

EAS Secrets tienen **menor prioridad** que `.env`. Si `.env` existe, ese valor se usa.

**Solución:** Renombrar `.env` a `.env.local` durante builds de producción, o usar `.gitignore` y no incluirlo en EAS build.

---

## Checklist de Seguridad Post-Migración

- [ ] `.env` está en `.gitignore`
- [ ] No hay `.env` en historial de Git
- [ ] Todos los secrets están en EAS (`eas secret:list`)
- [ ] Build de producción usa EAS Secrets (verificar logs)
- [ ] Firebase API keys tienen restricciones de app
- [ ] Google Maps API key tiene restricciones de app
- [ ] Secrets de dev/staging son DIFERENTES a prod
- [ ] Team members tienen acceso apropiado (no full access a todos)

---

## Gestión de Acceso (Teams)

```bash
# Ver miembros del proyecto
eas project:info

# Agregar colaborador (solo lectura de secrets)
# Requiere Expo Team Plan ($29/mes+)
```

Para startups pequeñas: 1-2 personas de confianza con acceso total, resto sin acceso a secrets.

---

## Costo-Beneficio

| Opción | Costo Setup | Costo/Mes | Riesgo | TTR (Time to Recover) |
|--------|-------------|-----------|--------|----------------------|
| `.env` en Git | 0 min | $0 | 🔴 **Crítico** | Horas-Días |
| `.env` gitignored | 5 min | $0 | 🟡 Medio | Minutos |
| **EAS Secrets** | **30 min** | **$0** | **🟢 Bajo** | **Segundos** |
| HashiCorp Vault | 8-16 hrs | $50-200 | 🟢 Muy Bajo | Segundos |

**Recomendación CTO:** EAS Secrets es el sweet spot para startups. Vault es overkill hasta 10M+ usuarios.

---

**Última actualización:** 2025-12-19  
**Autor:** CTO/Senior Architect
