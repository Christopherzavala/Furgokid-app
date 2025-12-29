# 🧪 FurgoKid MVP - Testing Guide

## Pre-Test Checklist

```bash
# 1. Instalar dependencias faltantes (si aplica)
npm install @react-native-picker/picker

# 2. Limpiar caché
rm -rf node_modules/.cache
expo start -c

# 3. Abrir en Expo Go
# iOS: Scan QR con cámara o Expo app
# Android: Scan QR en Expo Go app
```

---

## 🧑‍👨‍👧 PRUEBA 1: Flujo Padre

### 1.1 - Login

```
Email:    test@parent.com
Password: Test12345!
```

**Esperado:**

- ✅ Lleva a `ParentHomeScreen`
- ✅ Muestra nombre del padre en header
- ✅ Muestra botones "Publicar Necesidad" y "Buscar Conductores"

### 1.2 - Publicar Necesidad

```
Toca: "Publicar Necesidad"
→ ParentRequestScreen
```

**Llenar formulario:**

```
Colegio:              "Colegio San Ignacio"
Zona:                 "Zona Norte" (Picker)
Horario:              "Mañana" (SegmentedControl)
Cantidad de hijos:    2 (botones +/-)
Edades (opcional):    "6, 8"
Necesidades (opt):    "" (vacío)
```

**Esperado:**

- ✅ Validación: Colegio y Zona requeridos
- ✅ Toca "Publicar Necesidad" → Success alert
- ✅ Se guarda en Firestore → `requests` collection
- ✅ Firebase Analytics tracks `parent_request` event
- ✅ Vuelve a ParentHome

**Verificar en Firestore:**

```
Collection: requests
Fields: parentId, parentName, school, zone, schedule, childrenCount, createdAt
Status: active
```

### 1.3 - Buscar Conductores

```
Tapa: "Buscar Conductores"
→ SearchScreen
```

**Sin cupos creados aún:**

- ✅ Empty state: "No hay conductores disponibles"

**Después de crear un cupo de conductor (ver abajo):**

- ✅ Muestra cards de conductores
- ✅ Filtros funcionan (zona, horario)
- ✅ Card muestra: nombre, vehículo, asientos, colegios
- ✅ Botón WhatsApp abre chat

---

## 🚗 PRUEBA 2: Flujo Conductor

### 2.1 - Login

```
Email:    test@driver.com
Password: Test12345!
```

**Esperado:**

- ✅ Lleva a `DriverScreen`
- ✅ Muestra botón "INICIAR RUTA" (verde)
- ✅ Muestra botones "Publicar Cupo" y "Ver Solicitudes"

### 2.2 - Completar Perfil (si no está hecho)

```
Toca: Botón "document-text" en header
→ DriverProfileScreen
```

**Llenar:**

```
Modelo:        "Toyota Hiace"
Año:           "2020"
Placa:         "ABCD-1234"
Asientos:      "7"
Zona:          "Zona Norte"
```

**Esperado:**

- ✅ Se guarda en Firestore → `users/{userId}`
- ✅ Campo `profileCompleted: true`

### 2.3 - Publicar Cupo

```
Toca: "Publicar Cupo"
→ DriverVacancyScreen
```

**Llenar formulario:**

```
Zona:           "Zona Norte" (Picker)
Horario:        "Mañana" (Picker)
Asientos:       "7" (botones +/-)
Colegios:       Agregar modal
                - "Colegio San Ignacio"
                - "Colegio Verbo Divino"
```

**Paso 1: Agregar primer colegio**

```
Toca: "+ Agregar Colegio"
→ Modal aparece
Toca: "Colegio San Ignacio"
→ Se agrega a lista (verde, tag con X)
```

**Paso 2: Agregar segundo colegio**

```
Toca: "+ Agregar Colegio" otra vez
Toca: "Colegio Verbo Divino"
→ Se agrega
```

**Paso 3: Publicar**

```
Toca: "Publicar Cupo"
```

**Esperado:**

- ✅ Validación: Zona requerida, al menos 1 colegio, perfil completo
- ✅ Si perfil incompleto → Alert "Completa datos de vehículo"
- ✅ Success alert: "Tu cupo ha sido publicado"
- ✅ Se guarda en Firestore → `vacancies` collection
- ✅ Analytics tracks `driver_vacancy` event

**Verificar en Firestore:**

```
Collection: vacancies
Fields: driverId, zone, schools[], totalSeats, availableSeats, createdAt
Status: active
```

### 2.4 - Ver Solicitudes (Reverse Search)

```
Toca: "Ver Solicitudes"
→ SearchScreen (modo conductor)
```

**Esperado:**

- ✅ Muestra cards de solicitudes de padres
- ✅ Filtra por zona/horario
- ✅ Cards muestran: nombre padre, colegio, cantidad niños, edades
- ✅ Botón WhatsApp contacta al padre

---

## 💬 PRUEBA 3: WhatsApp Integration

### 3.1 - Desde Padre buscando Conductor

```
SearchScreen (padre)
→ Card de conductor
→ Toca botón "Contactar por WhatsApp"
```

**Esperado:**

- ✅ Abre WhatsApp con mensaje:
  ```
  "Hola! Vi tu perfil en FurgoKid como conductor.
   Necesito transporte escolar para mis hijos. ¿Tienes disponibilidad?"
  ```
- ✅ Analytics tracks `contact_initiated` event

### 3.2 - Desde Conductor buscando Padre

```
SearchScreen (conductor)
→ Card de solicitud padre
→ Toca botón "Contactar por WhatsApp"
```

**Esperado:**

- ✅ Abre WhatsApp con mensaje:
  ```
  "Hola! Vi tu solicitud en FurgoKid y tengo disponibilidad
   de transporte escolar. ¿Te interesa?"
  ```
- ✅ Analytics tracks `contact_initiated` event

---

## 🔄 PRUEBA 4: Filtros de Búsqueda

### 4.1 - Filtro Zona

```
SearchScreen
Zona: "Zona Norte" → Muestra solo matches en Zona Norte
Zona: "Zona Sur"  → Muestra solo matches en Zona Sur
```

**Esperado:**

- ✅ Filtros funcionan en tiempo real
- ✅ Empty state si no hay matches

### 4.2 - Filtro Horario

```
Horario: "Mañana" → Solo cupos/solicitudes Mañana
Horario: "Tarde"  → Solo Tarde
Horario: "Ambas"  → Muestra Mañana + Tarde (horarios "Ambas")
```

**Esperado:**

- ✅ Lógica: "Ambas" matchea con "Mañana" y "Tarde"

---

## 🚨 PRUEBA 5: Validaciones

### 5.1 - ParentRequestScreen

```
Publicar SIN llenar "Colegio"
→ Alert: "Por favor ingresa un colegio"

Publicar SIN seleccionar "Zona"
→ Alert: "Por favor selecciona una zona"

Cantidad de hijos = 0
→ Alert: "Por favor ingresa un número válido"
```

### 5.2 - DriverVacancyScreen

```
Publicar SIN perfil completo
→ Alert: "Por favor completa tus datos de vehículo"
→ Navega a DriverProfile

Publicar SIN colegios
→ Alert: "Por favor selecciona al menos un colegio"

Asientos = 0
→ Alert: "Por favor ingresa un número válido"
```

---

## 📊 PRUEBA 6: Analytics

### 6.1 - Verificar en Firebase Console

```
Analytics → Eventos
- sign_up (rol: parent/driver)
- login (rol: parent/driver)
- parent_request (school, zone, schedule)
- driver_vacancy (zone, schools, seats)
- contact_initiated (role, target_user_id)
```

**Nota:** En Expo Go, eventos son no-ops (no se trackean realmente a Firebase)
En build nativo (AAB), sí se trackean.

---

## ⚡ PRUEBA 7: Logout

### 7.1 - Padre

```
ParentHome → Header "log-out" icon
→ Alert: "¿Estás seguro de que deseas cerrar sesión?"
→ Confirma
→ Vuelve a LoginScreen
```

### 7.2 - Conductor

```
DriverHome → Header "log-out" icon
→ Alert: "¿Estás seguro de que deseas cerrar sesión?"
→ Confirma
→ Vuelve a LoginScreen
```

---

## 🐛 Troubleshooting

### Error: "Picker is not a constructor"

```
✓ npm install @react-native-picker/picker
✓ expo start -c (limpiar caché)
```

### Error: "Cannot find module '@react-native-picker/picker'"

```
✓ Verificar que está en package.json
✓ npm install
```

### ParentRequestScreen no aparece

```
✓ Verificar App.js imports
✓ Verificar Navigation Stack tiene "ParentRequest"
✓ Verificar user.role === 'parent'
```

### DriverVacancyScreen no aparece

```
✓ Verificar App.js imports
✓ Verificar Navigation Stack
✓ Verificar user.role === 'driver'
```

### Firestore no guarda documentos

```
✓ Verificar Firebase está configurado en firebase.js
✓ Verificar Firestore Rules (test mode permite lectura/escritura)
✓ Ver console.error() para detalles
```

### WhatsApp no abre en Android

```
✗ Número sin código país (+56)
✓ Usar +56 + número sin 9 inicial
Ejemplo: +56912345678
```

---

## ✅ Checklist de Validación

- [ ] ParentRequestScreen publica necesidades
- [ ] DriverVacancyScreen publica cupos
- [ ] SearchScreen muestra coincidencias
- [ ] Filtros zona/horario funcionan
- [ ] WhatsApp abre con mensajes predefinidos
- [ ] Firestore guarda documentos correctamente
- [ ] Validaciones previenen envíos inválidos
- [ ] Logout funciona en ambos roles
- [ ] Perfil conductor completo requerido antes de cupo
- [ ] Analytics trackea eventos (en build nativo)

---

**Estado:** ✅ MVP Listo para producción piloto
**Próximas pruebas:** Build nativo (EAS) → Play Store
