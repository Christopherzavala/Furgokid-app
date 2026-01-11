# 🔍 AUDITORÍA BIG TECH COMPLETA - FurgoKid

## Prompt para GitHub Copilot con Múltiples Roles Especializados

---

## 🎯 OBJETIVO

Realizar una auditoría exhaustiva de nivel Big Tech (Google/Meta/Amazon) del proyecto FurgoKid, aplicando estándares de:

- **Reliability Engineering** (SRE)
- **Security & Privacy** (InfoSec)
- **Performance Optimization** (Perf)
- **Cost Efficiency** (FinOps)
- **User Experience** (UX/Product)
- **Code Quality** (Platform Engineering)
- **Monetization Strategy** (Growth/Revenue)

---

## 📋 PROMPT COMPLETO PARA COPILOT

```
Actúa como un EQUIPO DE AUDITORÍA BIG TECH compuesto por 7 roles especializados.
Analiza el proyecto FurgoKid (React Native + Expo + Firebase) con profundidad profesional.

CONTEXTO DEL PROYECTO:
- App: Transporte escolar con GPS tracking en tiempo real
- Stack: React Native 0.81, Expo SDK 54, Firebase (Firestore, Functions, Auth)
- Monetización: Google AdMob (banners, interstitials, rewarded)
- Estado: Pre-lanzamiento (AAB generado, esperando Play Console $25)
- Usuarios objetivo: Padres + Conductores de Chile

---

### ROL 1: 🔴 SRE (Site Reliability Engineer)
**Enfoque**: Uptime, observabilidad, incident response

AUDITAR:
1. **Monitoreo & Alerting**
   - ✅ ¿Sentry configurado con tags de negocio (userId, screen, release)?
   - ✅ ¿Firebase Performance Monitoring activo?
   - ⚠️ ¿Hay alertas configuradas para errores críticos (spike, usuarios afectados)?
   - ⚠️ ¿Dashboard centralizado para métricas clave?

2. **Error Budget & SLO**
   - ⚠️ ¿Definido % de crash-free sessions aceptable? (Rec: 99.5%)
   - ⚠️ ¿P99 latency target para API calls? (Rec: <2s)
   - ⚠️ ¿Proceso de rollback automatizado?

3. **Resiliencia**
   - ✅ ¿Offline-first con cache local (AsyncStorage)?
   - ✅ ¿Retry logic en llamadas Firebase?
   - ⚠️ ¿Circuit breakers para APIs externas (Google Maps)?
   - ⚠️ ¿Graceful degradation si Firestore falla?

4. **Incident Management**
   - ⚠️ ¿Runbook de incidentes documentado?
   - ⚠️ ¿On-call rotation definida?
   - ⚠️ ¿Post-mortem template preparado?

ENTREGABLE: Lista de gaps con prioridad (P0/P1/P2) y tiempo estimado de fix.

---

### ROL 2: 🔒 InfoSec (Security & Privacy Engineer)
**Enfoque**: OWASP, GDPR, data leaks, compliance

AUDITAR:
1. **Autenticación & Autorización**
   - ✅ ¿Firebase Auth con email verification obligatoria?
   - ⚠️ ¿Rate limiting en login/signup (prevenir brute force)?
   - ⚠️ ¿Firestore Security Rules validadas? (users/{uid} solo accesible por owner)
   - ⚠️ ¿API Keys rotadas regularmente?

2. **Data Privacy (GDPR/CCPA)**
   - ✅ ¿Privacy Policy publicada y accesible?
   - ⚠️ ¿Consent management implementado (banner + tracking)?
   - ⚠️ ¿Derecho al olvido (delete account + data erasure)?
   - ⚠️ ¿PII (email, phone) encriptada en Firestore?

3. **Secrets Management**
   - ✅ ¿API keys en .env (no commiteadas)?
   - ⚠️ ¿EAS Secrets para production builds?
   - ⚠️ ¿Firebase API Key con restricciones (Android/iOS bundle ID)?
   - ⚠️ ¿Sentry DSN con rate limits?

4. **OWASP Mobile Top 10**
   - ⚠️ ¿ProGuard/R8 habilitado (ofuscar código)?
   - ⚠️ ¿Certificate pinning para Firebase/APIs?
   - ⚠️ ¿Input validation en formularios (XSS, SQL injection)?
   - ⚠️ ¿Logs sanitizados (no loguear passwords/tokens)?

ENTREGABLE: Security scorecard (0-100) + roadmap de remediación.

---

### ROL 3: ⚡ Performance Engineer
**Enfoque**: Bundle size, render speed, memoria

AUDITAR:
1. **Bundle Optimization**
   - ✅ ¿Hermes JS engine habilitado?
   - ⚠️ ¿Bundle analyzer ejecutado? (npm run analyze:bundle)
   - ⚠️ ¿Tree-shaking de dependencias no usadas?
   - ⚠️ ¿Code splitting por rutas (React.lazy)?

2. **Startup Performance**
   - ⚠️ ¿App startup time < 3s? (medir con Firebase Performance)
   - ⚠️ ¿Splash screen optimizada (no lazy load)?
   - ⚠️ ¿Defer de inicializaciones pesadas (AdMob, Analytics)?

3. **Runtime Performance**
   - ⚠️ ¿FlatList virtualizado (no ScrollView para listas largas)?
   - ⚠️ ¿Imágenes optimizadas (react-native-fast-image)?
   - ⚠️ ¿Memoization de componentes pesados (React.memo)?
   - ⚠️ ¿Detox E2E tests para regresar performance?

4. **Networking**
   - ⚠️ ¿GraphQL/REST con pagination?
   - ⚠️ ¿Cache de respuestas Firebase (persist)?
   - ⚠️ ¿Compresión de payloads grandes?

ENTREGABLE: Performance budget + plan de optimización.

---

### ROL 4: 💰 FinOps (Cost Optimization)
**Enfoque**: Firebase costs, AdMob revenue, ROI

AUDITAR:
1. **Firebase Costs**
   - ✅ ¿En plan Blaze con presupuesto mensual configurado?
   - ⚠️ ¿Alerts de Firebase cuando gasto > $10/mes?
   - ⚠️ ¿Firestore queries optimizadas (indexes, límites)?
   - ⚠️ ¿Cloud Functions con max instances limitados?
   - ⚠️ ¿Eliminar datos antiguos (TTL en Firestore)?

2. **AdMob Revenue Optimization**
   - ⚠️ ¿Mediation configurada (AdMob + Facebook Audience Network)?
   - ⚠️ ¿Ad placement strategy documentada?
   - ⚠️ ¿A/B tests de ad frequency?
   - ⚠️ ¿ARPU (Average Revenue Per User) trackeado?

3. **Unit Economics**
   - ⚠️ ¿CAC (Customer Acquisition Cost) vs. LTV calculado?
   - ⚠️ ¿Break-even point estimado?
   - ⚠️ ¿Churn rate monitoreado?

ENTREGABLE: Financial model + cost reduction opportunities.

---

### ROL 5: 🎨 UX/Product Engineer
**Enfoque**: User journey, accessibility, retention

AUDITAR:
1. **Onboarding & First-Time UX**
   - ✅ ¿Onboarding screen para nuevos usuarios?
   - ⚠️ ¿Tutorial interactivo (tooltips)?
   - ⚠️ ¿Email verification con retry UX amigable?
   - ⚠️ ¿Loading states informativos (no solo spinners)?

2. **Accessibility (WCAG 2.1)**
   - ⚠️ ¿Contraste de colores > 4.5:1?
   - ⚠️ ¿Labels de accesibilidad en botones (screen readers)?
   - ⚠️ ¿Font scaling respetado?
   - ⚠️ ¿Navegación por teclado funcional?

3. **User Engagement**
   - ⚠️ ¿Push notifications con deep linking?
   - ⚠️ ¿In-app messaging para features nuevas?
   - ⚠️ ¿Gamification (badges, streaks)?
   - ⚠️ ¿Net Promoter Score (NPS) survey?

4. **Error Recovery**
   - ✅ ¿ErrorBoundary con UI amigable?
   - ⚠️ ¿Toast/Snackbar para feedback de acciones?
   - ⚠️ ¿Botón "Retry" en fallos de red?

ENTREGABLE: UX audit report + wireframes de mejoras.

---

### ROL 6: 🏗️ Platform/Code Quality Engineer
**Enfoque**: Arquitectura, testing, maintainability

AUDITAR:
1. **Arquitectura**
   - ✅ ¿Context API para state management (AuthContext)?
   - ⚠️ ¿Separation of concerns (services vs. screens)?
   - ⚠️ ¿Dependency injection para testability?
   - ⚠️ ¿Design patterns consistentes (factory, observer)?

2. **Testing**
   - ⚠️ ¿Unit tests coverage > 60%? (jest)
   - ⚠️ ¿Integration tests para flujos críticos?
   - ⚠️ ¿E2E tests con Detox (login, create request)?
   - ⚠️ ¿Smoke tests en CI/CD?

3. **Code Quality**
   - ✅ ¿ESLint + Prettier configurados?
   - ✅ ¿TypeScript para type safety?
   - ⚠️ ¿SonarQube/CodeClimate para code smells?
   - ⚠️ ¿Cyclomatic complexity < 10?

4. **DevOps**
   - ⚠️ ¿CI/CD pipeline (GitHub Actions)?
   - ⚠️ ¿Automated versioning (semantic-release)?
   - ⚠️ ¿Canary deployments para releases?
   - ⚠️ ¿Dependency updates automatizadas (Renovate)?

ENTREGABLE: Code health score + refactoring roadmap.

---

### ROL 7: 📈 Growth/Revenue Engineer
**Enfoque**: Viral loops, conversion funnels, monetization

AUDITAR:
1. **Analytics Instrumentation**
   - ✅ ¿Firebase Analytics configurado?
   - ⚠️ ¿Funnels definidos (signup → first ride → retention)?
   - ⚠️ ¿Custom events para acciones clave?
   - ⚠️ ¿Cohort analysis implementada?

2. **Conversion Optimization**
   - ⚠️ ¿A/B tests framework (Firebase Remote Config)?
   - ⚠️ ¿Signup friction reducida (social login)?
   - ⚠️ ¿Referral program (invite friends)?
   - ⚠️ ¿Paywall optimization para premium?

3. **Retention Strategies**
   - ⚠️ ¿Email drip campaigns (welcome, re-engagement)?
   - ⚠️ ¿Push notification segmentation (drivers vs parents)?
   - ⚠️ ¿Win-back campaigns para churned users?

4. **Monetization Mix**
   - ✅ ¿AdMob implementado (banners, interstitials)?
   - ⚠️ ¿Rewarded ads con incentivos claros?
   - ⚠️ ¿Premium subscriptions consideradas?
   - ⚠️ ¿ARPDAU (Average Revenue Per Daily Active User) trackeado?

ENTREGABLE: Growth model + 90-day action plan.

---

## 🎯 FORMATO DE ENTREGA

Para cada rol, genera:

1. **EXECUTIVE SUMMARY** (3-5 bullets)
   - Estado general: 🟢 Excelente | 🟡 Necesita atención | 🔴 Crítico
   - Top 3 fortalezas
   - Top 3 gaps críticos

2. **FINDINGS DETALLADOS**
   - Tabla con: Item | Status (✅/⚠️/❌) | Severidad (P0/P1/P2) | Esfuerzo (S/M/L)

3. **ACTIONABLE RECOMMENDATIONS**
   - Quick wins (< 1 semana)
   - Medium-term (1-4 semanas)
   - Long-term (1-3 meses)

4. **METRICS TO TRACK**
   - KPIs sugeridos por rol

---

## 🚦 PRIORIZACIÓN GLOBAL

Después de los 7 roles, genera un **MASTER ROADMAP**:

**Semana 1-2 (Pre-Launch Critical)**
- [ ] P0 Security fixes
- [ ] P0 Performance blockers
- [ ] P0 Monitoring gaps

**Mes 1 (Post-Launch Stabilization)**
- [ ] P1 Cost optimizations
- [ ] P1 UX improvements
- [ ] P1 Analytics completeness

**Mes 2-3 (Growth & Scale)**
- [ ] P2 Code quality refactors
- [ ] P2 Advanced features
- [ ] P2 A/B testing framework

---

## 📊 OUTPUT FINAL

Genera un dashboard markdown con:
- Overall Health Score (0-100)
- Score por categoría (cada rol)
- Top 10 issues priorizados
- Estimated effort (person-weeks)
- ROI esperado de cada fix

---

PROCEDE CON LA AUDITORÍA COMPLETA AHORA.
```

---

## 📝 CÓMO USAR ESTE PROMPT

1. **Copia el prompt completo** (desde "Actúa como..." hasta "PROCEDE CON...")
2. **Pégalo en GitHub Copilot Chat**
3. **Espera 2-5 minutos** (análisis complejo)
4. **Revisa el output** por secciones
5. **Prioriza fixes** según tu timeline

---

## ⚡ QUICK START (Si tienes poco tiempo)

Si solo quieres auditoría de 1-2 roles:

### Solo SRE + Security:

```
Actúa como SRE y Security Engineer de Google. Audita FurgoKid enfocándote en:
1. Monitoring gaps (Sentry, Firebase Performance)
2. Security vulnerabilities (OWASP Mobile, Firestore Rules)
3. Privacy compliance (GDPR, Play Store requirements)

Formato: Tabla con Finding | Severity | Fix Effort
```

### Solo Performance + Cost:

```
Actúa como Performance y FinOps Engineer de Meta. Audita FurgoKid:
1. Bundle size y startup time
2. Firebase costs vs. presupuesto
3. AdMob revenue optimization

Genera: Quick wins (<1 week) para reducir costos 30%
```

---

## 🎯 MÉTRICAS DE ÉXITO DE LA AUDITORÍA

- **Completitud**: ¿Se auditaron los 7 roles?
- **Accionabilidad**: ¿Cada finding tiene un fix claro?
- **Priorización**: ¿ROI vs. Esfuerzo calculado?
- **Timeline**: ¿Roadmap realista con fechas?

---

## 📚 REFERENCIAS

- [Google SRE Book](https://sre.google/sre-book/table-of-contents/)
- [OWASP Mobile Top 10](https://owasp.org/www-project-mobile-top-10/)
- [Firebase Best Practices](https://firebase.google.com/docs/projects/best-practices)
- [React Native Performance](https://reactnative.dev/docs/performance)

---

**Última actualización**: 2026-01-11  
**Versión del proyecto**: v1.0.0 (Pre-lanzamiento)  
**Maintainer**: Christopher Zavala
