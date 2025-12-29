# 🔧 Scripts de Utilidad - FurgoKid

**Ubicación:** `docs/scripts/`  
**Última actualización:** 29 de Diciembre, 2025

---

## 📋 Scripts Disponibles

### 1. GUIA-INICIO.ps1

**Propósito:** Configuración inicial automatizada del proyecto  
**Sistema:** Windows (PowerShell)  
**Uso desde raíz del proyecto:**

```powershell
..\docs\scripts\GUIA-INICIO.ps1
```

**Lo que hace:**

- Verifica instalación de Node.js y npm
- Instala dependencias del proyecto
- Valida configuración de Expo
- Verifica archivos de configuración esenciales
- Muestra guía de próximos pasos

---

### 2. validar-setup.ps1

**Propósito:** Valida que todas las configuraciones estén correctas  
**Sistema:** Windows (PowerShell)  
**Uso desde raíz:**

```powershell
..\docs\scripts\validar-setup.ps1
```

**Lo que valida:**

- ✅ Variables de entorno (.env)
- ✅ Firebase credentials
- ✅ Google Maps API key
- ✅ AdMob configuration
- ✅ app.config.js
- ✅ Dependencias de npm

**Output:** Reporte detallado de configuración

---

### 3. diagnostico-y-reparacion.ps1

**Propósito:** Diagnóstico completo y reparación automática de problemas  
**Sistema:** Windows (PowerShell)  
**Uso desde raíz:**

```powershell
..\docs\scripts\diagnostico-y-reparacion.ps1
```

**Lo que repara:**

- 🔧 Caché de Expo (`.expo/`)
- 🔧 Node modules corruptos
- 🔧 Package-lock.json desincronizado
- 🔧 Assets faltantes (icon.png, splash.png)
- 🔧 Configuraciones de Expo
- 🔧 Git hooks (Husky)

**Cuándo usarlo:**

- Error al iniciar Expo
- Problemas de dependencias
- Assets no encontrados
- Cualquier error raro que no sabes cómo resolver

---

### 4. reparar-expo-notifications.ps1

**Propósito:** Fix específico para expo-notifications en Expo Go  
**Sistema:** Windows (PowerShell)  
**Uso desde raíz:**

```powershell
..\docs\scripts\reparar-expo-notifications.ps1
```

**Contexto:**
Expo Go SDK 53+ eliminó soporte para push notifications nativas. Este script:

- Comenta el código de notifications en App.js
- Remueve el plugin de app.json temporalmente
- Limpia caché

**Cuándo usarlo:**

- Error: "expo-notifications: Android Push notifications functionality was removed"
- Solo si usas Expo Go (no en Development Builds)

---

### 5. reparar-proyecto.ps1

**Propósito:** Reparación general rápida  
**Sistema:** Windows (PowerShell)  
**Uso desde raíz:**

```powershell
..\docs\scripts\reparar-proyecto.ps1
```

**Lo que hace:**

- Limpia node_modules
- Limpia caché de npm
- Reinstala dependencias
- Limpia caché de Metro bundler

**Cuándo usarlo:**

- Como primer intento ante cualquier error
- Después de cambiar dependencias
- Antes de hacer un build importante

---

## 🐧 Scripts Unix/Linux/Mac

### QUICK_START.sh

**Propósito:** Setup rápido en sistemas Unix  
**Sistema:** Linux, macOS, WSL  
**Uso:**

```bash
cd docs
bash QUICK_START.sh
```

**Equivalente a:** GUIA-INICIO.ps1 en Windows

---

### VERIFY_MVP.sh

**Propósito:** Verifica que el MVP esté completo  
**Sistema:** Linux, macOS, WSL  
**Uso:**

```bash
cd docs
bash VERIFY_MVP.sh
```

**Lo que verifica:**

- Todas las screens implementadas
- Servicios configurados
- Firebase integration
- Navigation completa
- Tests básicos

---

## 🎯 Flujo Recomendado

### Primera vez en el proyecto

```powershell
# 1. Setup inicial
..\docs\scripts\GUIA-INICIO.ps1

# 2. Validar configuración
..\docs\scripts\validar-setup.ps1

# 3. Si hay errores
..\docs\scripts\diagnostico-y-reparacion.ps1
```

### Ante un error desconocido

```powershell
# 1. Intenta reparación rápida
..\docs\scripts\reparar-proyecto.ps1

# 2. Si persiste, diagnóstico completo
..\docs\scripts\diagnostico-y-reparacion.ps1

# 3. Validar que todo esté OK
..\docs\scripts\validar-setup.ps1
```

### Error específico de notifications

```powershell
..\docs\scripts\reparar-expo-notifications.ps1
```

---

## 🔐 Requisitos

Todos los scripts PowerShell requieren:

- Windows 10/11
- PowerShell 5.1 o superior
- Permisos de ejecución habilitados:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Scripts Bash requieren:

- Bash 4.0+
- Git instalado
- Node.js y npm instalados

---

## 📝 Notas Importantes

### Ubicación de Ejecución

Todos los scripts PowerShell deben ejecutarse **desde la raíz del proyecto**, no desde `docs/scripts/`:

```powershell
# ✅ CORRECTO (desde raíz)
..\docs\scripts\validar-setup.ps1

# ❌ INCORRECTO (desde docs/scripts/)
.\validar-setup.ps1  # No funcionará correctamente
```

### Backups Automáticos

`diagnostico-y-reparacion.ps1` crea backups automáticos en `backups/` antes de hacer cambios.

### Logs

Los scripts generan logs en formato timestamp para debugging:

- `backups/YYYYMMDD_HHMMSS/`

---

## 🐛 Troubleshooting

### "No se puede ejecutar el script"

**Error:** "...no se puede cargar porque la ejecución de scripts está deshabilitada"

**Solución:**

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### "Archivo no encontrado"

**Error:** Script no encuentra archivos del proyecto

**Causa:** Ejecutando desde directorio incorrecto

**Solución:** Navega a la raíz del proyecto:

```powershell
cd C:\Users\Dell\Desktop\Furgokid
..\docs\scripts\nombre-script.ps1
```

### Script no hace nada

**Causa:** Puede estar esperando input

**Solución:** Revisa la terminal, puede estar pidiendo confirmación (Y/N)

---

## 📚 Referencias

- **Documentación completa:** [../README.md](../README.md)
- **Auditoría técnica:** [../AUDITORIA_TECNICA_2025.md](../AUDITORIA_TECNICA_2025.md)
- **Firebase Setup:** [../FIREBASE_SETUP_GUIDE.md](../FIREBASE_SETUP_GUIDE.md)

---

**Mantenido por:** GitHub Copilot  
**Proyecto:** FurgoKid  
**Versión:** 1.0
