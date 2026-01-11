# ✅ CHECKLIST INTERACTIVO - OPTIMIZACIÓN DE ASSETS

Marca cada item cuando lo completes. Total: **2.5-3 horas**

---

## 📥 TAREA 1: OPTIMIZAR ASSETS EN TINYPNG (15-20 min)

**Link:** https://tinypng.com

### Pasos:

- [ ] Abrir TinyPNG en navegador
- [ ] Arrastrar 6 archivos desde `/assets/original/`:
  - [ ] icon.png
  - [ ] adaptive-icon.png
  - [ ] splash.png
  - [ ] logo.png
  - [ ] bus-render.png
  - [ ] favicon.png
- [ ] Esperar compresión (1-2 min)
- [ ] Click "Download all"
- [ ] Extraer ZIP descargado
- [ ] Copiar 6 archivos a `/assets/` (reemplazar existentes)
- [ ] **Validar:** Ejecutar comando:
  ```powershell
  Get-ChildItem assets -File -Include *.png,*.jpg | Where-Object { $_.DirectoryName -notmatch 'original' } | Select-Object Name, @{Name='KB';Expression={[math]::Round($_.Length/1KB,1)}} | Format-Table
  ```
- [ ] **Verificar:** icon.png < 120KB, splash.png < 300KB

**Resultado esperado:** ✅ Ahorro ~2.2MB (-60-70%)

---

## 🎨 TAREA 2: CREAR OPEN GRAPH IMAGE (20-30 min)

**Link:** https://www.canva.com  
**Guía:** Ver `docs/CANVA_TEMPLATES.md` sección 1

### Pasos:

- [ ] Crear cuenta Canva (si no tienes)
- [ ] Crear diseño → "Publicación de Facebook" (1200x630px)
- [ ] Template en blanco
- [ ] Agregar fondo degradado azul:
  - [ ] Color 1: #4A90E2
  - [ ] Color 2: #2E7BC4
- [ ] Subir y agregar logo (assets/logo.png) arriba izquierda
- [ ] Agregar texto headline: "Rastreo GPS en Tiempo Real"
  - [ ] Fuente: Montserrat Bold, 56px, blanco
- [ ] Agregar subtítulo: "Tranquilidad para tu familia"
  - [ ] Fuente: Montserrat Regular, 28px, blanco
- [ ] (Opcional) Agregar badge Google Play
- [ ] Descargar como PNG
- [ ] Guardar como: `og-image.png` en `/assets/`

**Resultado esperado:** ✅ Imagen 1200x630px para redes sociales

**Alternativa rápida (10 min):**

- [ ] Usar template "tech app" pre-diseñado
- [ ] Editar solo textos y logo
- [ ] Cambiar colores a azul

---

## 🏪 TAREA 3: CREAR FEATURE GRAPHIC (30-45 min)

**Link:** https://www.canva.com  
**Guía:** Ver `docs/CANVA_TEMPLATES.md` sección 2

### Pasos:

- [ ] Nuevo diseño → Dimensiones: 1024 x 500 px
- [ ] Fondo degradado azul horizontal
- [ ] Agregar texto "FurgoKid" (Montserrat Black, 80px, blanco)
- [ ] Agregar 3 íconos de Elements:
  - [ ] Bus (amarillo #FFD700) con texto "Rastreo GPS"
  - [ ] Campana (rojo #FF6B6B) con texto "Alertas Seguras"
  - [ ] Pin GPS (turquesa #4ECDC4) con texto "Rutas Inteligentes"
- [ ] Agregar tagline inferior: "Tranquilidad para padres • Eficiencia para conductores"
  - [ ] Montserrat Medium, 24px, centrado
- [ ] Descargar como PNG
- [ ] Guardar como: `feature-graphic.png` en `/assets/`

**Resultado esperado:** ✅ Header 1024x500px para Play Store

**Alternativa rápida (15 min):**

- [ ] Buscar template "app banner"
- [ ] Editar con textos FurgoKid
- [ ] Cambiar colores a azul

---

## 📱 TAREA 4: TOMAR SCREENSHOTS (60-90 min)

**Herramienta:** Emulador Android

### Pasos:

- [ ] Iniciar emulador:
  ```powershell
  npx expo start --android
  ```
- [ ] Esperar carga de app en emulador
- [ ] Configurar datos demo (rutas, alertas)

### Screenshots a tomar (mínimo 2, recomendado 4):

**Screenshot 1 - Hero (Mapa GPS):**

- [ ] Navegar a pantalla de mapa con bus visible
- [ ] Capturar (botón cámara emulador o Ctrl+S)
- [ ] Guardar como: `screenshot-1-hero.png`
- [ ] Caption sugerido: "Rastreo GPS en Tiempo Real"

**Screenshot 2 - Safety (Alertas):**

- [ ] Navegar a pantalla de alertas/geofences
- [ ] Capturar
- [ ] Guardar como: `screenshot-2-safety.png`
- [ ] Caption: "Alertas Automáticas de Llegada"

**Screenshot 3 - Driver (Panel conductor):**

- [ ] Navegar a dashboard conductor
- [ ] Capturar
- [ ] Guardar como: `screenshot-3-driver.png`
- [ ] Caption: "Rutas Optimizadas"

**Screenshot 4 - Chat:**

- [ ] Navegar a chat padre-conductor
- [ ] Capturar
- [ ] Guardar como: `screenshot-4-chat.png`
- [ ] Caption: "Comunicación Directa y Segura"

### Post-procesamiento:

- [ ] Mover todos los screenshots a `/assets/screenshots/`
- [ ] **OPCIONAL:** Agregar captions en Canva:
  - [ ] Instagram Story template (1080x1920)
  - [ ] Rectángulo negro arriba (75% opacidad)
  - [ ] Texto blanco con caption
  - [ ] Ver specs en `docs/CANVA_TEMPLATES.md` sección 3

**Resultado esperado:** ✅ 2-4 screenshots 1080x1920px listos para Play Store

---

## ✅ TAREA 5: VALIDAR Y COMMIT (10-15 min)

### Validación:

- [ ] Verificar tamaños:
  ```powershell
  Get-ChildItem assets -File -Include *.png | Where-Object { $_.DirectoryName -notmatch 'original' } | Select-Object Name, @{Name='KB';Expression={[math]::Round($_.Length/1KB,1)}} | Format-Table
  ```

### Checklist visual:

- [ ] icon.png < 120KB ✓
- [ ] splash.png < 300KB ✓
- [ ] og-image.png existe ✓
- [ ] feature-graphic.png existe ✓
- [ ] Mínimo 2 screenshots en /screenshots/ ✓
- [ ] Total assets < 1.5MB ✓

### Test en emulador:

- [ ] App carga más rápido
- [ ] Icon se ve bien
- [ ] Splash se ve bien

### Commit:

- [ ] Verificar cambios:
  ```powershell
  git status
  ```
- [ ] Agregar assets:
  ```powershell
  git add assets/
  ```
- [ ] Commit:
  ```powershell
  git commit -m "feat(assets): optimize images -60% size, add store listing assets"
  ```
- [ ] Push:
  ```powershell
  git push origin fix/stabilize-startup-cz
  ```

**Resultado esperado:** ✅ Todo optimizado, validado y commiteado

---

## 📊 PROGRESO TOTAL:

**Tareas completadas:** \_\_ / 5

**Tiempo invertido:** **\_\_**

**Próximo paso:**

- Si completaste todo → Preparar build para Play Store
- Si falta algo → Ver TODO_ASSETS.md para ayuda

---

## 🆘 ¿NECESITAS AYUDA?

**Si te trabas:**

- Ver guía completa: `docs/ASSET_OPTIMIZATION_GUIDE.md`
- Ver plantillas Canva: `docs/CANVA_TEMPLATES.md`
- Comandos útiles: `COMANDOS_RAPIDOS.md`
- Avisarme: "No puedo hacer X, ayuda"

**Cuando termines:**

- Avisarme: "Terminé optimización, valida resultados"
- O: "Todo listo, ¿qué sigue?"

---

**¡ÉXITO!** 🚀
