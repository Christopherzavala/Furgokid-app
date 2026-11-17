#!/bin/bash

# ============================================================================
# Firebase Setup Helper Script
# Automatiza la configuración de Firebase para FurgoKid
# ============================================================================

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║       🔥 Firebase Setup Helper - FurgoKid 🚌              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# PASO 1: Verificar Firebase CLI
# ============================================================================

echo -e "${BLUE}[1/5] Verificando Firebase CLI...${NC}"

if ! command -v firebase &> /dev/null
then
    echo -e "${YELLOW}Firebase CLI no encontrado. Este diagnóstico no instala herramientas.${NC}"
    exit 1
else
    echo -e "${GREEN}✓ Firebase CLI encontrado${NC}"
    firebase --version
fi

echo ""

# ============================================================================
# PASO 2: Login a Firebase
# ============================================================================

echo -e "${BLUE}[2/5] Este diagnóstico no realiza autenticación.${NC}"

echo ""

# ============================================================================
# PASO 3: Inicializar proyecto (si no está)
# ============================================================================

echo -e "${BLUE}[3/5] Verificando configuración de proyecto...${NC}"

if [ ! -f ".firebaserc" ]; then
    echo -e "${YELLOW}Proyecto no inicializado. Ejecuta el flujo de inicialización por separado y revisa sus cambios.${NC}"
else
    echo -e "${GREEN}✓ Proyecto ya configurado${NC}"
    cat .firebaserc
fi

echo ""

# ============================================================================
# PASO 4: Informar el procedimiento seguro de deploy
# ============================================================================

echo -e "${BLUE}[4/5] Este script de setup no despliega recursos.${NC}"
echo -e "${YELLOW}Use el flujo de deployment protegido del repositorio para el entorno elegido.${NC}"

echo ""

# ============================================================================
# PASO 5: Confirmar que las reglas se despliegan por el flujo protegido
# ============================================================================

echo -e "${BLUE}[5/5] Las reglas solo se despliegan con los scripts protegidos indicados arriba.${NC}"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                   ✅ Setup Completado                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================================
# RESUMEN Y PRÓXIMOS PASOS
# ============================================================================

echo -e "${BLUE}📊 Resumen del setup (sin deployment):${NC}"
echo ""
echo -e "${NC}No se ejecutó ningún deploy ni consulta remota desde este resumen."
echo ""

echo -e "${YELLOW}📋 Próximos pasos pendientes:${NC}"
echo ""
echo "1. 🔐 Firebase Console - Configurar API Key restrictions:"
echo "   https://console.firebase.google.com → Settings → Web API Key"
echo "   - Android: Com.Furgokid.App"
echo "   - iOS: Com.Furgokid.App"
echo ""
echo "2. 🌐 Publicar Privacy Policy:"
echo "   - Archivo HTML: docs/privacy-policy.html"
echo "   - Opción 1: GitHub Pages"
echo "   - Opción 2: Firebase Hosting"
echo "   - Actualizar URL en app.config.js"
echo ""
echo "3. 🐛 Crear cuenta Sentry:"
echo "   https://sentry.io/signup/"
echo "   - Copiar DSN"
echo "   - Ejecutar: eas secret:create --name SENTRY_DSN --value \"YOUR_DSN\""
echo ""

echo -e "${GREEN}Para más detalles, ver: docs/MANUAL_ACTIONS_REQUIRED.md${NC}"
echo ""
