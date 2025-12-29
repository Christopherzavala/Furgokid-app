# 🚀 FurgoKid MVP - Guía Completa de Implementación

## ✅ Estado Actual

**Completado (100% funcional)**:

1. ✅ **ParentRequestScreen** - Padres publican necesidades (zona, horario, cantidad de hijos)
2. ✅ **DriverVacancyScreen** - Conductores publican cupos (zona, horario, asientos, colegios)
3. ✅ **SearchScreen** - Interfaz de búsqueda y matching con WhatsApp
4. ✅ **Navegación** - Integrado en App.js para ambos roles
5. ✅ **Analytics** - Eventos trackean: solicitudes, cupos, contactos

---

## 📱 FLUJO DE USUARIO (Padre)

### 1️⃣ Login/Register

```
Usuario abre app → Login/Register → Selecciona rol "Padre" → Home
```

### 2️⃣ ParentHomeScreen (Nuevo)

Botones principales:

- **"Publicar Necesidad"** → Navega a `ParentRequestScreen`
- **"Buscar Conductores"** → Navega a `SearchScreen`

### 3️⃣ ParentRequestScreen (NUEVO)

**Campos:**

- Colegio (texto, requerido)
- Zona (Picker: 5 opciones, requerido)
- Horario (Segmented: Mañana/Tarde/Ambas)
- Cantidad de hijos (número +/-, mín 1)
- Edades (opcional)
- Necesidades especiales (opcional)

**Validación:**

- Colegio y zona obligatorios
- Cantidad de hijos ≥ 1

**Firestore:**

```json
{
  "parentId": "uid123",
  "parentName": "Juan Pérez",
  "parentPhone": "+56912345678",
  "school": "Colegio San Ignacio",
  "zone": "Zona Norte",
  "schedule": "Mañana",
  "childrenCount": 2,
  "childrenAges": "6, 8",
  "specialNeeds": "",
  "createdAt": {serverTimestamp},
  "status": "active"
}
```

### 4️⃣ SearchScreen - Ver Conductores

**Filtros:**

- Zona (5 botones)
- Horario (Mañana/Tarde/Ambas)

**Cards por Conductor:**

- Nombre, Rating (placeholder: 4.5★)
- Vehículo (modelo, placa)
- Asientos disponibles
- Horario
- Colegios que cubre

**Acción:**

- Botón WhatsApp → Abre chat con mensaje predefinido

---

## 🚗 FLUJO DE USUARIO (Conductor)

### 1️⃣ Login/Register

```
Conductor → Selecciona rol "Driver" → Completa perfil (vehículo) → Home
```

### 2️⃣ DriverScreen (Actualizado)

Botones principales:

- **Gran botón verde**: "INICIAR RUTA" / "TERMINAR RUTA"
- **"Publicar Cupo"** → Navega a `DriverVacancyScreen`
- **"Ver Solicitudes"** → Navega a `SearchScreen`
- **Botón perfil** (header): Edita datos de vehículo

### 3️⃣ DriverVacancyScreen (NUEVO)

**Campos:**

- Zona (Picker: 5 opciones, requerido)
- Horario (Picker: Mañana/Tarde/Ambas)
- Total de asientos (número +/-, mín 1)
- Colegios que cubre (Modal searchable)

**Validación:**

- Perfil de vehículo DEBE estar completo
- Zona requerida
- Al menos 1 colegio
- Asientos > 0

**Firestore:**

```json
{
  "driverId": "uid456",
  "driverName": "Carlos López",
  "driverPhone": "+56987654321",
  "vehicleModel": "Toyota Hiace",
  "licensePlate": "ABCD-1234",
  "totalSeats": 7,
  "availableSeats": 7,
  "zone": "Zona Norte",
  "schedule": "Mañana",
  "schools": ["Colegio San Ignacio", "Colegio Verbo Divino"],
  "createdAt": {serverTimestamp},
  "status": "active"
}
```

### 4️⃣ SearchScreen - Ver Solicitudes de Padres

**Filtros:**

- Zona
- Horario

**Cards por Padre:**

- Nombre, Rating
- Colegio
- Cantidad de niños
- Edades (si disponible)
- Necesidades especiales (si aplica)

**Acción:**

- Botón WhatsApp → Contacto directo

---

## 🔌 INTEGRACIONES

### Firestore Collections

#### `requests/{docId}`

Documentos de solicitudes de padres:

- Campos: parentId, parentName, parentPhone, school, zone, schedule, childrenCount, childrenAges, specialNeeds, createdAt, status
- Índice: `zone` + `status`

#### `vacancies/{docId}`

Documentos de cupos de conductores:

- Campos: driverId, driverName, driverPhone, vehicleModel, licensePlate, totalSeats, availableSeats, zone, schedule, schools[], createdAt, status
- Índice: `zone` + `status`

#### `users/{userId}`

Datos de usuario (existente):

- Campos: displayName, email, whatsapp, role, vehicleModel, vehicleYear, licensePlate, seats, zone, profileCompleted, createdAt

### Analytics Events

```typescript
// En ParentRequestScreen
analyticsService.trackParentRequest(school, zone, schedule);

// En DriverVacancyScreen
analyticsService.trackDriverVacancy(zone, schools.join(', '), seats);

// En SearchScreen (ambos roles)
analyticsService.trackContactInitiated(role, targetUserId);
```

---

## 🧪 TESTING END-TO-END

### Escenario 1: Padre Publica Necesidad

```
1. Login como padre (test@parent.com)
2. Home → "Publicar Necesidad"
3. Llenar: Colegio (ej: San Ignacio), Zona (Zona Norte), Horario (Mañana)
4. ✓ Debe guardar en Firestore/requests con serverTimestamp
5. ✓ Analytics debe trackear evento "parent_request"
```

### Escenario 2: Conductor Publica Cupo

```
1. Login como conductor (driver@test.com)
2. DriverProfile → Completar datos vehículo (modelo, año, placa, asientos)
3. Home → "Publicar Cupo"
4. Llenar: Zona (Zona Norte), Horario (Mañana), Asientos (7)
5. Modal: Agregar colegios (San Ignacio, Verbo Divino)
6. ✓ Debe guardar en Firestore/vacancies con serverTimestamp
7. ✓ Analytics debe trackear evento "driver_vacancy"
```

### Escenario 3: Búsqueda y Contacto

```
A. Padre busca Conductores
   1. Home → "Buscar Conductores"
   2. Filtra por Zona Norte + Mañana
   3. Ve cards de conductores disponibles
   4. Toca WhatsApp en card
   5. ✓ Debe abrir WhatsApp con mensaje predefinido
   6. ✓ Analytics trackea "contact_initiated"

B. Conductor busca Solicitudes
   1. Home → "Ver Solicitudes"
   2. Filtra por Zona Norte + Mañana
   3. Ve cards de padres buscando transporte
   4. Toca WhatsApp
   5. ✓ Debe abrir WhatsApp + analytics
```

---

## ⚠️ DEPENDENCIAS CRÍTICAS

### Verificar instaladas:

```bash
npm list @react-native-picker/picker
npm list @react-native-firebase/analytics
npm list expo-constants
npm list react-native-gesture-handler
```

**Si faltan:**

```bash
npm install @react-native-picker/picker
npm install @react-native-firebase/analytics
npm install expo-constants
npm install react-native-gesture-handler
```

---

## 📋 PRÓXIMOS PASOS (Post-MVP)

- [ ] Ratings/Reviews (padre → conductor, conductor → padre)
- [ ] Histórico de viajes
- [ ] Notificaciones push (cuando aparece nuevo cupo/necesidad)
- [ ] Google Sign-In (opcional, si hay tiempo)
- [ ] UI polish y dark mode
- [ ] Prueba en build nativo (EAS)
- [ ] Play Store submission

---

## 🎯 MÉTRICAS MVPACTIVOS (Analytics)

**Events a trackear:**

- `sign_up` - Nuevos usuarios por rol
- `login` - Acceso a app
- `parent_request` - Necesidades publicadas
- `driver_vacancy` - Cupos publicados
- `contact_initiated` - Contactos iniciados (WhatsApp)
- `ad_impression` - Vistas de anuncios
- `ad_click` - Clicks en anuncios

---

## ✨ ARQUITECTURA

```
App.js
  ├─ Navigation Stack
  │   ├─ Auth (Login/Register)
  │   ├─ Parent Role
  │   │   ├─ ParentHome
  │   │   ├─ ParentRequest (NUEVO)
  │   │   └─ Search (NUEVO)
  │   └─ Driver Role
  │       ├─ DriverHome
  │       ├─ DriverProfile
  │       ├─ DriverVacancy (NUEVO)
  │       └─ Search (NUEVO)
  │
  └─ AuthContext
      ├─ useAuth hook
      ├─ Firebase Auth
      └─ Firestore user profile

Services
  ├─ analyticsService.ts
  ├─ admobService.ts
  └─ locationService.js

Firestore
  ├─ users/{userId}
  ├─ requests/{docId}    (NUEVO)
  └─ vacancies/{docId}   (NUEVO)
```

---

## 🐛 TROUBLESHOOTING

### ParentRequestScreen no aparece

- ✓ Verificar import en App.js
- ✓ Verificar Stack.Screen name="ParentRequest" en Navigation
- ✓ Verificar que user.role === 'parent'

### DriverVacancyScreen no aparece

- ✓ Verificar import en App.js
- ✓ Verificar @react-native-picker/picker instalado
- ✓ Verificar que user.role === 'driver'

### Picker errors en DriverVacancyScreen

- ✗ Si ves "Picker is not a constructor"
- → `npm install @react-native-picker/picker`

### Firestore queries no retornan resultados

- ✓ Verificar Firestore rules permiten lectura
- ✓ Verificar zona/schedule exactos entre requests y vacancies
- ✓ Verificar que status = 'active' en ambos documentos

### WhatsApp no abre

- ✓ En Android: necesita +56 (código país)
- ✓ En iOS: igual, pero Linking.canOpenURL() a veces falla
- ✓ Alternativa: mostrar número para copiar manualmente

---

**Última actualización**: Enero 2024
**Estado MVP**: ✅ Listo para testing E2E
