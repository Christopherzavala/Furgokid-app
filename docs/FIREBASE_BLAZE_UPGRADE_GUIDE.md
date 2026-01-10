# 🚀 Guía de Upgrade a Firebase Blaze Plan

## ⚠️ Situación Actual

**Problema:** No puedes deployar Cloud Functions porque tu proyecto `furgokid` está en el **Spark Plan (gratuito)**.

**Error recibido:**

```
Your project furgokid must be on the Blaze (pay-as-you-go) plan to complete this command.
Required API cloudbuild.googleapis.com can't be enabled until the upgrade is complete.
```

---

## 💰 Costos del Blaze Plan

### **¿Cuánto cuesta?**

**Respuesta corta:** $0/mes para proyectos pequeños como Furgokid

**Tier gratuito incluido en Blaze:**

- ✅ **2,000,000 invocaciones/mes** - GRATIS
- ✅ **400,000 GB-seconds/mes** - GRATIS
- ✅ **200,000 CPU-seconds/mes** - GRATIS
- ✅ **5 GB salida de red/mes** - GRATIS

**Después del tier gratuito (si lo excedes):**

- $0.40 por millón de invocaciones
- $0.0000025 por GB-second
- $0.0000100 por CPU-second
- $0.12 por GB de salida de red

### **Estimación para Furgokid:**

Con **100 usuarios activos diarios**:

- ~300 requests/día = 9,000 requests/mes
- **Costo: $0.00** (muy por debajo del tier gratuito)

Con **1,000 usuarios activos diarios**:

- ~3,000 requests/día = 90,000 requests/mes
- **Costo: $0.00** (aún dentro del tier gratuito)

Con **10,000 usuarios activos diarios**:

- ~30,000 requests/día = 900,000 requests/mes
- **Costo: $0.00** (aún dentro del tier gratuito)

**Necesitarías 70,000+ usuarios activos diarios para pagar algo.**

---

## 🔧 Cómo Hacer el Upgrade (5 minutos)

### **Paso 1: Abrir Firebase Console**

Click aquí: [Upgrade Furgokid a Blaze](https://console.firebase.google.com/project/furgokid/usage/details)

O manualmente:

1. Ir a https://console.firebase.google.com/
2. Seleccionar proyecto "furgokid"
3. Click en ⚙️ Settings (arriba izquierda)
4. Click en "Usage and billing"

### **Paso 2: Upgrade a Blaze**

1. Click en el botón **"Upgrade to Blaze plan"**
2. Verás un modal con información del plan

### **Paso 3: Configurar Método de Pago**

**Opción A: Tarjeta de Crédito/Débito**

1. Ingresar datos de tarjeta
2. Nombre del titular
3. Dirección de facturación
4. Click "Confirm"

**Opción B: Cuenta de Facturación de Google Cloud existente**

1. Si ya tienes cuenta de Google Cloud, selecciónala
2. Click "Link account"

### **Paso 4: Configurar Presupuesto (RECOMENDADO)**

Para evitar sorpresas:

1. En la misma página, click "Set budget alert"
2. Configurar:
   - **Budget amount:** $10/mes
   - **Alert threshold:** 80% ($8)
   - **Email notification:** tu email
3. Click "Save"

**Esto te alertará si llegas a $8 de uso (casi imposible con tu tráfico)**

### **Paso 5: Verificar Upgrade**

```powershell
# Refrescar estado
firebase projects:list

# Deberías ver "furgokid" con plan Blaze
```

---

## 🚀 Deploy Después del Upgrade

Una vez que Blaze esté activo (toma ~2 minutos):

```powershell
# 1. Verificar que estás en el proyecto correcto
firebase use furgokid

# 2. Deploy Functions
firebase deploy --only functions

# 3. Validar deploy
npm run smoke:test

# 4. Verificar Functions deployadas
firebase functions:list
```

---

## 🛡️ Protecciones de Seguridad

### **1. Budget Alerts (Ya configuradas arriba)**

- Te avisa si gastas más de lo esperado

### **2. Quotas en Firebase Console**

Puedes limitar invocaciones:

1. Firebase Console > Functions
2. Click en una función
3. Tab "Usage"
4. Set quota: 100,000 invocations/day

### **3. Monitoring Script (Ya implementado)**

```powershell
# Monitorear uso en tiempo real
npm run monitor:health
```

### **4. Cost Analysis Dashboard**

- Firebase Console > Usage and billing > Cost analysis
- Revisa costos diarios/semanales/mensuales

---

## ❓ Preguntas Frecuentes

### **Q: ¿Me cobrarán algo si no uso el proyecto?**

**A:** No. Solo pagas por lo que usas. Si no hay invocaciones, costo = $0.

### **Q: ¿Puedo volver al Spark Plan después?**

**A:** No. Una vez en Blaze, no puedes downgrade. Pero puedes eliminar Functions para no pagar.

### **Q: ¿Qué pasa si mi tarjeta se rechaza?**

**A:** Tus Functions dejarán de funcionar después de 7 días. Recibirás emails de advertencia.

### **Q: ¿Cuánto tardará en activarse Blaze?**

**A:** Inmediato (1-2 minutos). El deploy puede tardar 5-10 minutos.

### **Q: ¿Necesito Blaze para el emulator?**

**A:** No. Emulators son 100% gratis y funcionan sin Blaze.

---

## 🔄 Alternativas Sin Upgrade

### **Opción 1: Emulators (Local Testing)**

**Ya configurado en tu proyecto:**

```powershell
npm run emulators
```

**Pros:**

- ✅ 100% gratis
- ✅ Testing instantáneo
- ✅ No requiere internet

**Contras:**

- ❌ Solo local (no accesible desde app en producción)
- ❌ No testing con usuarios reales

### **Opción 2: Usar Proyecto Staging**

Si `furgokid-staging` tiene Blaze:

```powershell
firebase use staging
firebase deploy --only functions
```

### **Opción 3: Backend Alternativo**

Usar servicios con tier gratuito más generoso:

- **Vercel Functions** - 100 GB-hours/mes gratis
- **Netlify Functions** - 125,000 requests/mes gratis
- **AWS Lambda** - 1,000,000 requests/mes gratis

**Contras:** Requiere reescribir código (no compatible con Firebase Functions)

---

## ✅ Recomendación Final

**Para Furgokid en producción:**

1. ✅ **Hacer upgrade a Blaze** (< 5 min)

   - Costo real: $0-$2/mes para 1,000+ usuarios
   - Tier gratuito muy generoso
   - Profesional y escalable

2. ✅ **Configurar budget alert** a $10/mes

   - Protección contra costos inesperados

3. ✅ **Monitorear con `npm run monitor:health`**
   - Detecta problemas antes que afecten costos

**Tiempo total: 5 minutos | Costo mensual estimado: $0**

---

## 📞 Soporte

**Si tienes problemas con el upgrade:**

- Firebase Support: https://firebase.google.com/support
- Google Cloud Billing Support: https://cloud.google.com/billing/docs/how-to/get-support
- Documentación: https://firebase.google.com/pricing

---

**Última actualización:** 2026-01-10  
**Proyecto:** Furgokid  
**Plan actual:** Spark (gratuito)  
**Plan recomendado:** Blaze (pay-as-you-go)
