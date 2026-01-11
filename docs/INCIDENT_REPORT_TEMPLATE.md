# Incident Report Template

**Incident ID:** [Ej: INC-2026-001]  
**Date:** [YYYY-MM-DD]  
**Reported by:** [Nombre]  
**Severity:** [Critical / High / Medium / Low]

---

## 📋 Summary

[Breve descripción de 1-2 líneas sobre qué falló]

---

## ⏰ Timeline

| Time  | Event                          |
| ----- | ------------------------------ |
| HH:MM | Deploy iniciado                |
| HH:MM | Primeros errores detectados    |
| HH:MM | Alerta de monitoring triggered |
| HH:MM | Equipo notificado              |
| HH:MM | Rollback iniciado              |
| HH:MM | Servicio restaurado            |

**Total downtime:** [X minutos]

---

## 🎯 Impact

### **Users Affected**

- **Total users impacted:** [Número o "All users"]
- **% of user base:** [Ej: 100%]
- **Types affected:** [Parents / Drivers / Both]

### **Functional Impact**

- [ ] Push notifications not sending
- [ ] Cloud Functions not executing
- [ ] App crashes on startup
- [ ] Authentication failures
- [ ] Database operations failing
- [ ] Other: [Especificar]

### **Business Impact**

- **Notifications lost:** [Número]
- **Requests not processed:** [Número]
- **Revenue impact:** [Ej: $0 - no revenue yet]
- **Reputation impact:** [Low / Medium / High]

---

## 🔍 Root Cause Analysis

### **What Happened?**

[Descripción detallada del problema técnico]

**Example:**

```
Deploy de Cloud Functions v1.2.0 incluyó un bug en notifyDriversNewRequest:
- Código intentaba acceder a pushToken sin validar existencia
- Causó throw de error en 100% de los casos
- Cloud Function crasheaba inmediatamente después de trigger
```

### **Why Did It Happen?**

[Causa raíz - qué faltó que permitió que esto pasara]

**Example:**

```
1. Cambio en estructura de datos de users collection (pushToken → pushTokens array)
2. Código no actualizado para manejar nuevo formato
3. Tests unitarios no cubrían este edge case
4. No se testeó en staging antes de production deploy
```

### **Why Wasn't It Caught Earlier?**

- [ ] Missing test coverage
- [ ] Staging environment not used
- [ ] Smoke tests insufficient
- [ ] Code review missed issue
- [ ] Documentation outdated
- [ ] Other: [Especificar]

---

## 🛠️ Resolution

### **Immediate Actions Taken**

1. [Ej: Ejecutado `npm run rollback -- -All -Force`]
2. [Ej: Verificado que Functions fueron eliminadas]
3. [Ej: Confirmado error rate bajó a 0%]
4. [Ej: Monitoreado sistema por 30 minutos]

### **Fix Applied**

[Descripción del fix implementado]

**Code changes:**

```javascript
// BEFORE (buggy)
const pushToken = userData.pushToken;

// AFTER (fixed)
const pushToken = userData.pushToken || userData.pushTokens?.[0];
if (!pushToken) {
  console.warn('User has no push token');
  return;
}
```

**Files modified:**

- `functions/index.js` (línea 45-52)

**Testing performed:**

- [x] Unit tests updated and passing
- [x] Deployed to staging
- [x] Smoke tests passing in staging
- [x] Manual E2E test in staging
- [x] Deployed to production
- [x] Smoke tests passing in production

---

## 📊 Metrics

### **Error Rate**

- **Before rollback:** 100% (50/50 failed)
- **After rollback:** 0%
- **After fix deploy:** 0% (validated for 2 hours)

### **Performance**

- **Function execution time:** [Ej: 1.2s avg (normal)]
- **Memory usage:** [Ej: 128MB avg (normal)]
- **Invocations:** [Ej: 15 in 2h test period]

### **Cost Impact**

- **Failed function invocations:** 50
- **Estimated wasted cost:** $0.001 (insignificant)

---

## 🚫 Prevention Measures

### **Immediate Actions (Already Implemented)**

- [x] [Ej: Agregado test coverage para pushToken validation]
- [x] [Ej: Actualizada documentación de users schema]
- [x] [Ej: Agregado validation en pre-deploy checklist]

### **Short-term Actions (This Week)**

- [ ] [Ej: Implementar staging environment obligatorio]
- [ ] [Ej: Agregar alertas de error rate > 10%]
- [ ] [Ej: Crear runbook para rollbacks]

### **Long-term Actions (This Month)**

- [ ] [Ej: Implementar automated canary deployments]
- [ ] [Ej: Agregar E2E tests en CI/CD]
- [ ] [Ej: Setup monitoring dashboards]

---

## 📚 Lessons Learned

### **What Went Well**

- ✅ [Ej: Rollback script funcionó perfectamente]
- ✅ [Ej: Detección rápida del problema (5 min)]
- ✅ [Ej: Backup de Firestore salvó data]

### **What Could Be Improved**

- ⚠️ [Ej: Staging environment no estaba configurado]
- ⚠️ [Ej: Code review no catcheó el bug]
- ⚠️ [Ej: Monitoring alerts tardaron 10 min en disparar]

### **Action Items**

1. **[Responsable]** - [Acción específica] - **Due:** [Fecha]

   - Ejemplo: **@DevLead** - Setup staging Firebase project - **Due:** 2026-01-15

2. **[Responsable]** - [Acción específica] - **Due:** [Fecha]

   - Ejemplo: **@QA** - Create E2E test suite - **Due:** 2026-01-20

3. **[Responsable]** - [Acción específica] - **Due:** [Fecha]
   - Ejemplo: **@DevOps** - Configure error rate alerts - **Due:** 2026-01-12

---

## 🔗 Related Links

- **Firebase Console Logs:** [URL]
- **GitHub PR with fix:** [URL]
- **Slack thread:** [URL]
- **Postmortem meeting notes:** [URL]

---

## ✍️ Sign-off

**Incident resolved:** [Yes / No]  
**Production stable:** [Yes / No]  
**Monitoring active:** [Yes / No]

**Reviewed by:**

- [ ] Tech Lead
- [ ] Product Manager
- [ ] QA Lead

**Date closed:** [YYYY-MM-DD]

---

## 📝 Notes

[Cualquier información adicional, observaciones, o contexto relevante]

---

**Template version:** 1.0  
**Last updated:** 2026-01-10
