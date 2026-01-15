# ✅ Google Play Console - Checklist de Publicación

## 📋 Pre-requisitos

### Cuenta de Desarrollador

- [ ] Cuenta de Google Play Console activa ($25 USD único)
- [ ] Información de desarrollador verificada
- [ ] Método de pago configurado (para recibir pagos de AdMob)

### Aplicación

- [ ] APK/AAB firmado con keystore de producción
- [ ] Version code incrementado
- [ ] Version name actualizada (1.0.0)

---

## 📝 Información de la Tienda

### Detalles Básicos

```
Nombre de la app: FurgoKid
Descripción corta (80 caracteres):
"Conecta padres con conductores de transporte escolar de confianza"

Descripción completa (4000 caracteres):
FurgoKid es la solución moderna para el transporte escolar seguro.

🚐 PARA PADRES:
• Encuentra conductores de furgones escolares en tu zona
• Revisa perfiles verificados y calificaciones
• Contacta directamente por WhatsApp
• Publica tus necesidades de transporte
• Guarda conductores favoritos

🚗 PARA CONDUCTORES:
• Promociona tus servicios de transporte escolar
• Publica cupos disponibles
• Recibe contactos de padres interesados
• Gestiona tu perfil profesional
• Muestra tu zona de cobertura

✨ CARACTERÍSTICAS:
• Búsqueda por zona, colegio y horario
• Perfiles detallados con fotos del vehículo
• Contacto directo vía WhatsApp
• Interfaz simple e intuitiva
• Sin comisiones ni intermediarios

FurgoKid no es responsable de los acuerdos entre padres y conductores.
Recomendamos verificar credenciales y documentos antes de contratar.

📧 Soporte: support@furgokid.com
```

### Categorización

- **Categoría:** Crianza / Parenting
- **Categoría secundaria:** Mapas y navegación
- **Clasificación de contenido:** Para todos (completar cuestionario)

---

## 🖼️ Assets Gráficos

### Requeridos

- [ ] **Ícono de la app:** 512x512 PNG (sin transparencia)
- [ ] **Feature graphic:** 1024x500 PNG/JPG
- [ ] **Screenshots teléfono:** Mín 2, máx 8 (1080x1920 o similar)
- [ ] **Screenshots tablet 7":** Mín 1 (si soportas tablets)
- [ ] **Screenshots tablet 10":** Mín 1 (si soportas tablets)

### Recomendados

- [ ] Video promocional (YouTube URL)
- [ ] Screenshots adicionales para diferentes dispositivos

---

## 📜 Políticas y Documentos

### URLs Requeridas

- [ ] **Política de Privacidad:** https://furgokid.com/privacy

  - Debe estar accesible públicamente
  - Ver `docs/PRIVACY_POLICY.md` para contenido

- [ ] **Términos de Servicio:** https://furgokid.com/terms (opcional pero recomendado)
  - Ver `docs/TERMS_OF_SERVICE.md` para contenido

### Declaraciones

- [ ] Declaración de permisos (ubicación, cámara si aplica)
- [ ] Declaración de uso de datos sensibles
- [ ] App ads.txt (para AdMob)

---

## 🔐 Seguridad y Cumplimiento

### Data Safety Form

Completar en Play Console:

- [ ] ¿Recopila datos de usuario? → Sí
- [ ] ¿Qué datos recopila?
  - Información personal (nombre, email, teléfono)
  - Ubicación (aproximada y precisa)
  - Fotos (perfil, vehículo)
- [ ] ¿Los datos se comparten? → Sí (con otros usuarios de la app)
- [ ] ¿Los datos se encriptan en tránsito? → Sí
- [ ] ¿El usuario puede solicitar eliminación? → Sí

### Content Rating

Completar cuestionario IARC:

- [ ] Violencia → No
- [ ] Sexualidad → No
- [ ] Lenguaje → No
- [ ] Sustancias → No
- [ ] Gambling → No
- [ ] Datos de ubicación → Sí (funcional)

Resultado esperado: **PEGI 3 / Everyone**

---

## 💰 Monetización

### Google AdMob

- [ ] App verificada en AdMob
- [ ] Ad units creados y configurados
- [ ] app-ads.txt configurado (si tienes sitio web)

### IDs de AdMob (ya configurados)

```
Publisher ID: pub-XXXXXXXXXXXXXXXX
App ID: ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy
Banner: ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy
Interstitial: ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy
Rewarded: ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy
```

Nota: los IDs reales deben ir en variables de entorno/EAS Secrets (no en el repo).

---

## 🚀 Proceso de Publicación

### 1. Crear la App en Play Console

1. Ve a https://play.google.com/console
2. "Crear aplicación"
3. Nombre: FurgoKid
4. Idioma: Español (Chile) o Español
5. App o juego: App
6. Gratis o de pago: Gratis

### 2. Configurar la Ficha de la Tienda

1. Subir assets gráficos
2. Completar descripción
3. Agregar URL de privacidad
4. Completar Data Safety

### 3. Configurar Versiones

1. Ir a "Pruebas" → "Pruebas internas"
2. Subir el AAB (no APK para producción)
3. Agregar testers (emails)
4. Probar antes de producción

### 4. Lanzamiento Gradual

1. Pruebas internas → Pruebas cerradas → Pruebas abiertas → Producción
2. Recomendado: lanzar a 10% inicialmente
3. Monitorear crashlytics y reviews

---

## 📊 Post-Lanzamiento

### Monitoreo

- [ ] Configurar Firebase Crashlytics
- [ ] Configurar Firebase Analytics
- [ ] Revisar Android Vitals en Play Console
- [ ] Responder reviews de usuarios

### KPIs a Seguir

- Instalaciones
- Usuarios activos (DAU/MAU)
- Retención (D1, D7, D30)
- Crashes y ANRs
- Ingresos de AdMob

---

## 📞 Información de Contacto (para Play Console)

```
Email de soporte: support@furgokid.com
Teléfono: +56 9 XXXX XXXX
Sitio web: https://furgokid.com
```

---

## ⚠️ Errores Comunes a Evitar

1. **Política de privacidad inválida** - Debe estar en URL pública accesible
2. **Screenshots incorrectos** - Deben mostrar la app, no mockups
3. **Descripción engañosa** - Debe reflejar funcionalidad real
4. **Permisos no justificados** - Explicar por qué necesitas cada permiso
5. **Data Safety incompleto** - Ser honesto y completo
6. **App crashes** - Probar exhaustivamente antes de subir

---

**Última actualización:** 29 de diciembre de 2025
