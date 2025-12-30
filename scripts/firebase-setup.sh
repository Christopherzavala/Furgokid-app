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
    echo -e "${YELLOW}Firebase CLI no encontrado. Instalando...${NC}"
    npm install -g firebase-tools
else
    echo -e "${GREEN}✓ Firebase CLI encontrado${NC}"
    firebase --version
fi

echo ""

# ============================================================================
# PASO 2: Login a Firebase
# ============================================================================

echo -e "${BLUE}[2/5] Iniciando sesión en Firebase...${NC}"
echo -e "${YELLOW}Se abrirá tu navegador para autenticación.${NC}"
echo ""

firebase login

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Login exitoso${NC}"
else
    echo -e "${RED}✗ Error en login${NC}"
    exit 1
fi

echo ""

# ============================================================================
# PASO 3: Inicializar proyecto (si no está)
# ============================================================================

echo -e "${BLUE}[3/5] Verificando configuración de proyecto...${NC}"

if [ ! -f ".firebaserc" ]; then
    echo -e "${YELLOW}Proyecto no inicializado. Configurando...${NC}"
    firebase init
else
    echo -e "${GREEN}✓ Proyecto ya configurado${NC}"
    cat .firebaserc
fi

echo ""

# ============================================================================
# PASO 4: Deploy Firestore Indexes
# ============================================================================

echo -e "${BLUE}[4/5] Desplegando Firestore indexes...${NC}"
echo -e "${YELLOW}Esto puede tardar 2-5 minutos...${NC}"
echo ""

firebase deploy --only firestore:indexes

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Indexes desplegados exitosamente${NC}"
else
    echo -e "${RED}✗ Error desplegando indexes${NC}"
    echo -e "${YELLOW}Tip: Verifica que firestore.indexes.json existe y es válido${NC}"
fi

echo ""

# ============================================================================
# PASO 5: Deploy Firestore Rules
# ============================================================================

echo -e "${BLUE}[5/5] Desplegando Firestore security rules...${NC}"
echo -e "${YELLOW}Aplicando reglas restrictivas de seguridad...${NC}"
echo ""

firebase deploy --only firestore:rules

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Security rules desplegadas exitosamente${NC}"
else
    echo -e "${RED}✗ Error desplegando rules${NC}"
    echo -e "${YELLOW}Tip: Verifica que firestore.rules existe y es válido${NC}"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                   ✅ Setup Completado                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================================
# RESUMEN Y PRÓXIMOS PASOS
# ============================================================================

echo -e "${BLUE}📊 Resumen del deployment:${NC}"
echo ""
firebase firestore:indexes
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
