# ✅ Pre-Build Checklist

## Antes de cada build, ejecutar:

```bash
npm run pre-build
```

Este comando ejecuta automáticamente:

1. TypeScript check (`tsc --noEmit`)
2. ESLint (`eslint src`)
3. Tests (`jest --passWithNoTests`)
4. Security audit (`npm audit`)

---

## Checklist Manual

### 📝 Código

- [ ] Sin errores de TypeScript
- [ ] Sin warnings de ESLint
- [ ] Tests pasando
- [ ] Sin `console.log` en código de producción

### 🔧 Configuración

- [ ] `app.config.js` versión actualizada
- [ ] Variables de entorno configuradas en EAS
- [ ] AdMob IDs correctos (producción, no test)

### 🔐 Seguridad

- [ ] No hay secretos en código
- [ ] `.env` no está en el commit
- [ ] `npm audit` sin vulnerabilidades críticas

### 📱 Funcionalidad

- [ ] Login/registro funciona
- [ ] Navegación correcta
- [ ] Ads se muestran (en build, no Expo Go)
- [ ] Firebase conectado

### 📦 Git

- [ ] Todos los cambios commiteados
- [ ] Branch actualizado con main
- [ ] PR creado (si aplica)

---

## Comandos de Verificación

```bash
# Verificar TypeScript
npm run type-check

# Verificar ESLint
npm run lint

# Ejecutar tests
npm test

# Verificar dependencias
npx expo-doctor
npx expo install --check

# Verificar seguridad
npm audit

# Validar configuración
npm run validate:config
```

---

## Proceso de Build

### Preview (APK para testing)

```bash
npm run build:preview
# o
eas build --platform android --profile preview
```

### Production (AAB para Play Store)

```bash
npm run build:production
# o
eas build --platform android --profile production
```

---

## Errores Comunes

| Error                           | Solución                                  |
| ------------------------------- | ----------------------------------------- |
| `package-lock.json out of sync` | `rm package-lock.json && npm install`     |
| `peer dependency conflict`      | Usar `.npmrc` con `legacy-peer-deps=true` |
| `Module not found`              | Verificar imports y dependencias          |
| `TypeScript error`              | `npm run type-check` para ver detalles    |

---

Última actualización: 29 de diciembre de 2025
