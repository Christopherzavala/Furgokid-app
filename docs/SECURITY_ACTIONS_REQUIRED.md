# Security Actions Required (Manual)

Estas acciones se realizan en consola (no por código).

## 1) Restringir Firebase Web API Key (P0)

1. Ir a Google Cloud Console → APIs & Services → Credentials.
2. Ubicar la key usada por Firebase (Web API Key).
3. **Application restrictions**:
   - Android apps: agregar `Com.Furgokid.App` + SHA-1 del keystore.
   - iOS apps (si aplica): bundle id.
4. **API restrictions**:
   - Restringir a APIs necesarias (Firebase Auth/Firestore/etc.).
5. Guardar y validar login.

## 2) Restringir Google Maps API Key (P0/P1)

1. APIs & Services → Credentials → key de Maps.
2. Application restrictions: Android package + SHA-1.
3. API restrictions: solo Maps SDK / Places si se usa.

## 3) Revisión rápida OWASP Mobile

- No loggear PII (emails/tokens) en producción.
- Minimizar permisos (location background solo si necesario).
- Mantener dependencias actualizadas.
