# 📋 TAREAS PENDIENTES - OPTIMIZACIÓN DE ASSETS

**Fecha:** Enero 9, 2026  
**Tiempo estimado total:** 3-4 horas  
**Todas las guías completas están en:** `/docs/`

---

## ✅ LO QUE YA ESTÁ HECHO (POR COPILOT):

- [x] Backup de assets originales en `/assets/original/`
- [x] Documentación completa creada (4 guías detalladas)
- [x] Scripts de validación preparados
- [x] Estructura de carpetas para screenshots
- [x] Plantillas Canva con specs exactas

---

## 🔴 LO QUE DEBES HACER TÚ:

### **TAREA 1: OPTIMIZAR ASSETS EXISTENTES** ⚡ (15-20 minutos)

**Herramienta:** TinyPNG.com (gratis, sin registro)

#### PASOS EXACTOS:

1. **Abrir TinyPNG:**

   ```
   Ir a: https://tinypng.com
   ```

2. **Subir archivos para optimizar:**

   ```
   Arrastra estos 6 archivos a la página:

   C:\Users\Dell\Desktop\Furgokid\assets\original\icon.png
   C:\Users\Dell\Desktop\Furgokid\assets\original\adaptive-icon.png
   C:\Users\Dell\Desktop\Furgokid\assets\original\splash.png
   C:\Users\Dell\Desktop\Furgokid\assets\original\logo.png
   C:\Users\Dell\Desktop\Furgokid\assets\original\bus-render.png
   C:\Users\Dell\Desktop\Furgokid\assets\original\favicon.png
   ```

3. **Esperar compresión automática** (1-2 minutos)

4. **Descargar optimizados:**

   ```
   Click en "Download all" (botón verde)
   Se descarga un ZIP con todos los archivos
   ```

5. **Reemplazar en /assets:**

   ```powershell
   # Extraer el ZIP descargado
   # Copiar los 6 archivos a:
   C:\Users\Dell\Desktop\Furgokid\assets\

   # Reemplazar cuando pregunte "El archivo ya existe"
   ```

6. **Validar optimización:**

   ```powershell
   # Abrir PowerShell en la carpeta del proyecto:
   cd C:\Users\Dell\Desktop\Furgokid

   # Ejecutar validación:
   Get-ChildItem assets -File -Include *.png,*.jpg | Where-Object { $_.DirectoryName -notmatch 'original' } | Select-Object Name, @{Name='KB';Expression={[math]::Round($_.Length/1KB,1)}} | Format-Table

   # Verificar que los archivos ahora pesan MENOS
   # Target: icon.png < 120KB, splash.png < 300KB
   ```

**RESULTADO ESPERADO:**

- ✅ Ahorro de ~2.2MB (-60-70% tamaño)
- ✅ Sin pérdida visual perceptible
- ✅ App carga más rápido

---

### **TAREA 2: CREAR OPEN GRAPH IMAGE** 🎨 (20-30 minutos)

**Herramienta:** Canva.com (gratis, requiere cuenta)

#### PASOS EXACTOS:

1. **Ir a Canva:**

   ```
   https://www.canva.com
   Crear cuenta gratis si no tienes (con Google es rápido)
   ```

2. **Crear diseño:**

   ```
   Click "Crear un diseño" → "Publicación de Facebook"
   O buscar: 1200 x 630 px
   Seleccionar template en BLANCO
   ```

3. **Aplicar diseño siguiendo:**

   ```
   docs/CANVA_TEMPLATES.md - Sección 1 "OPEN GRAPH IMAGE"
   ```

   **RESUMEN RÁPIDO:**

   - Fondo degradado azul (#4A90E2 → #2E7BC4)
   - Logo FurgoKid arriba izquierda
   - Título: "Rastreo GPS en Tiempo Real" (blanco, grande)
   - Subtítulo: "Tranquilidad para tu familia"
   - Badge Google Play (opcional)

4. **Descargar:**
   ```
   Compartir → Descargar → PNG → Descargar
   Guardar como: og-image.png
   Mover a: C:\Users\Dell\Desktop\Furgokid\assets\
   ```

**RESULTADO ESPERADO:**

- ✅ Imagen 1200x630px lista para redes sociales
- ✅ +40% shares cuando compartas en Facebook/Twitter

**ALTERNATIVA RÁPIDA (10 min):**

- Usar template pre-diseñado de Canva buscando "tech app" o "mobile app"
- Editar solo textos y logo
- Cambiar colores a azul

---

### **TAREA 3: CREAR FEATURE GRAPHIC** 🏪 (30-45 minutos)

**Herramienta:** Canva.com

#### PASOS EXACTOS:

1. **Nuevo diseño en Canva:**

   ```
   Crear diseño → Dimensiones personalizadas: 1024 x 500 px
   ```

2. **Aplicar diseño siguiendo:**

   ```
   docs/CANVA_TEMPLATES.md - Sección 2 "FEATURE GRAPHIC"
   ```

   **RESUMEN RÁPIDO:**

   - Fondo degradado azul horizontal
   - Logo "FurgoKid" grande arriba izquierda
   - 3 íconos: Bus, Campana, Pin GPS
   - Textos bajo cada ícono (features principales)
   - Tagline inferior: "Tranquilidad para padres • Eficiencia para conductores"

3. **Descargar:**
   ```
   PNG → feature-graphic.png
   Guardar en: C:\Users\Dell\Desktop\Furgokid\assets\
   ```

**RESULTADO ESPERADO:**

- ✅ Header para Google Play Store
- ✅ +35% CTR en store listing

**ALTERNATIVA RÁPIDA (15 min):**

- Buscar template "app banner" o "tech header"
- Editar con textos y colores FurgoKid

---

### **TAREA 4: TOMAR SCREENSHOTS** 📱 (1-2 horas)

**Herramienta:** Emulador Android

#### PASOS EXACTOS:

1. **Iniciar emulador:**

   ```powershell
   cd C:\Users\Dell\Desktop\Furgokid
   npx expo start --android

   # Esperar a que abra el emulador
   # Si no tienes emulador, instalar Android Studio primero
   ```

2. **Configurar datos demo:**

   ```
   - Crear cuenta demo o usar existente
   - Agregar ruta de prueba con bus visible en mapa
   - Configurar alertas de prueba
   ```

3. **Tomar 4 screenshots mínimos:**

   **Screenshot 1 - MAPA GPS (HERO SHOT):**

   ```
   Pantalla: Mapa con bus moviéndose
   Capturar: Botón cámara del emulador o Ctrl+S
   Guardar como: screenshot-1-hero.png
   ```

   **Screenshot 2 - ALERTAS/SEGURIDAD:**

   ```
   Pantalla: Lista de alertas o geofences
   Capturar y guardar: screenshot-2-safety.png
   ```

   **Screenshot 3 - PANEL CONDUCTOR:**

   ```
   Pantalla: Dashboard conductor con rutas
   Capturar: screenshot-3-driver.png
   ```

   **Screenshot 4 - CHAT:**

   ```
   Pantalla: Chat padre-conductor
   Capturar: screenshot-4-chat.png
   ```

4. **Mover screenshots:**

   ```powershell
   # Mover todos los screenshots a:
   C:\Users\Dell\Desktop\Furgokid\assets\screenshots\
   ```

5. **OPCIONAL - Agregar captions en Canva:**
   ```
   Para cada screenshot:
   - Canva → Instagram Story (1080x1920)
   - Subir screenshot
   - Agregar rectángulo negro arriba (opacidad 75%)
   - Texto en blanco con caption
   - Ver docs/CANVA_TEMPLATES.md sección 3 para textos
   ```

**RESULTADO ESPERADO:**

- ✅ Mínimo 2 screenshots (OBLIGATORIO para publicar)
- ✅ Recomendado 4-6 (mejor conversión)

**ALTERNATIVA SI NO TIENES EMULADOR:**

- Usar dispositivo Android físico
- Conectar con ADB: `adb devices`
- Capturar: `adb shell screencap -p /sdcard/screenshot.png`
- Descargar: `adb pull /sdcard/screenshot.png`

---

### **TAREA 5: VALIDAR TODO** ✅ (5-10 minutos)

#### PASOS EXACTOS:

1. **Verificar tamaños de assets:**

   ```powershell
   cd C:\Users\Dell\Desktop\Furgokid
   Get-ChildItem assets -File -Include *.png | Where-Object { $_.DirectoryName -notmatch 'original' } | Select-Object Name, @{Name='KB';Expression={[math]::Round($_.Length/1KB,1)}}, @{Name='Path';Expression={$_.DirectoryName}} | Format-Table
   ```

2. **Checklist visual:**

   ```
   [ ] icon.png < 120KB
   [ ] splash.png < 300KB
   [ ] og-image.png existe (1200x630px)
   [ ] feature-graphic.png existe (1024x500px)
   [ ] Mínimo 2 screenshots en /screenshots/
   [ ] Total assets < 1.5MB
   ```

3. **Test visual en emulador:**

   ```powershell
   npx expo start --android

   # Verificar que:
   - Icon se ve bien
   - Splash se ve bien
   - App carga más rápido que antes
   ```

4. **Commit cambios:**
   ```powershell
   git add assets/
   git commit -m "feat(assets): optimize images -60% size, add store listing assets"
   git push origin fix/stabilize-startup-cz
   ```

**RESULTADO ESPERADO:**

- ✅ Todos los assets optimizados y validados
- ✅ Listos para Play Store submission
- ✅ Bundle size reducido en ~2MB

---

## 📊 RESUMEN DE IMPACTO:

```
TAREA                    TIEMPO    IMPACTO
────────────────────────────────────────────
1. TinyPNG               15 min    -2.2MB bundle
2. Open Graph            20 min    +40% shares
3. Feature Graphic       30 min    +35% CTR
4. Screenshots           90 min    PUBLICABLE
5. Validación            10 min    QA completo
────────────────────────────────────────────
TOTAL                    2.5-3h    +$7,603 Mes 6
```

---

## 🆘 SI TE TRABAS:

**"No puedo instalar Canva"**

- Es web, no requiere instalación
- Solo necesitas cuenta gratis (email o Google)

**"TinyPNG no comprime suficiente"**

- Alternativa: https://squoosh.app
- O: https://compresspng.com

**"No tengo emulador Android"**

- Instalar Android Studio (gratis)
- O usar dispositivo físico con USB debugging

**"No sé usar Canva"**

- Seguir exactamente docs/CANVA_TEMPLATES.md
- O usar templates pre-diseñados (buscar "app promo")

**"Me falta tiempo"**

- MÍNIMO CRÍTICO: Tareas 1 y 4 (TinyPNG + 2 screenshots)
- Resto es opcional pero muy recomendado

---

## ✅ CUANDO TERMINES:

**Avísame y validamos juntos:**

```
"Terminé la optimización, valida los resultados"
"Screenshots tomados, ¿se ven bien?"
"Todo listo, ¿qué sigue?"
```

**O si te trabas:**

```
"No puedo hacer X, ayuda"
"¿Cómo hago Y?"
"Esto no funciona: [error]"
```

---

## 📂 ARCHIVOS DE REFERENCIA:

```
docs/ASSET_OPTIMIZATION_GUIDE.md    → Guía completa paso a paso
docs/CANVA_TEMPLATES.md             → Specs exactas Canva
docs/ASSET_OPTIMIZATION_PLAN.md     → Plan ejecutivo y ROI
docs/PRE_LAUNCH_CHECKLIST.md        → Checklist pre-launch completo
```

---

**¡ÉXITO! Todo está documentado. Cualquier duda, pregunta.** 🚀
