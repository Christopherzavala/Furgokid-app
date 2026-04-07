# 📈 Analytics Funnels & Custom Events - FurgoKid

## Objetivo

Definir funnels críticos y eventos custom para medir conversión y retención.

## 📋 Funnels sugeridos (pendiente usuario)

### Funnel 1: Signup → First Ride

1. screen_view: RegisterScreen
2. signup_complete
3. email_verified
4. first_login
5. create_request_start
6. create_request_complete
7. driver_matched

### Funnel 2: Retención 7 días

1. first_login
2. day_1_active
3. day_3_active
4. day_7_active

---

## Eventos custom recomendados

- create_request_start (ParentRequestScreen)
- create_request_complete (ParentRequestScreen)
- ad_revenue (track ARPU)
- push_notification_opened
- premium_feature_unlocked

---

## Cohort Analysis

- [ ] Implementar cohortes en Firebase Analytics
- [ ] Medir retención semanal/mensual

---

## Instrucciones (pendiente usuario)

- [ ] Agregar estos eventos en código (analyticsService.trackEvent)
- [ ] Configurar funnels y cohortes en Firebase Console
- [ ] Validar tracking en QA

---

## Funnel 1: Signup

1. `screen_view` Register
2. `sign_up`
3. `email_verified`
4. `login`

## Funnel 2: Primera solicitud (Parent)

1. `screen_view` ParentHome
2. `create_request_start`
3. `create_request_complete`
4. `driver_matched`

## Referencias

- [Firebase Funnels](https://firebase.google.com/docs/analytics/funnels)
- [Custom Events](https://firebase.google.com/docs/analytics/events)
