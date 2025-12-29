#!/bin/bash

echo "🚀 Iniciando build de Android con EAS..."
echo ""

# Cambiar al directorio del proyecto
cd "$(dirname "$0")"

# Verificar que estamos autenticados
echo "👤 Usuario EAS:"
eas whoami

# Verificar el commit actual
echo ""
echo "📝 Commit actual:"
git log --oneline -1

# Lanzar el build
echo ""
echo "🔨 Lanzando build..."
eas build --platform android --profile preview --clear-cache

echo ""
echo "✅ Build iniciado!"
echo "📱 Verifica el progreso en: https://expo.dev/accounts/christopher69/projects/furgokid/builds"
