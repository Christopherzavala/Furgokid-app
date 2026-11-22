# MATRIZ DE CONFIGURACIÓN Y AISLAMIENTO DE ENTORNOS: FKG-GATE-028 (FASE 1.1)

**Proyecto:** FurgoKid  
**Ecosistema:** Framework Z (FWZ)  
**Estado del Documento:** ESPECIFICACIÓN TÉCNICA OFICIAL

---

## 1. Matriz de Configuración por Variante de Aplicación (`APP_VARIANT`)

| Parámetro / Entorno         | Development (`APP_VARIANT=development`) | Staging (`APP_VARIANT=staging`)            | Production (`APP_VARIANT=production`) | Regla de Validación                |
| :-------------------------- | :-------------------------------------- | :----------------------------------------- | :------------------------------------ | :--------------------------------- |
| **Android `package`**       | `com.furgokid.app.dev`                  | **`com.furgokid.app.staging`**             | **`com.furgokid.app`**                | Enforced por `app.config.js`       |
| **iOS `bundleIdentifier`**  | `com.furgokid.app.dev`                  | **`com.furgokid.app.staging`**             | **`com.furgokid.app`**                | Enforced por `app.config.js`       |
| **Deep Link Scheme**        | `furgokid-dev://`                       | **`furgokid-staging://`**                  | **`furgokid://`**                     | Enforced por `app.config.js`       |
| **`googleServicesFile`**    | `./google-services.dev.json` (Opt)      | **`./google-services.staging.json` (Req)** | **`./google-services.json` (Req)**    | **Error si falta en Staging/Prod** |
| **Firebase Project ID**     | `demo-furgokid`                         | **`furgokid-staging`**                     | **`furgokid`**                        | Coincidencia en JSON y JS SDK      |
| **Firebase Project Number** | `000000000000`                          | **`1030782410558`**                        | **`1061722538586`**                   | Validado en `google-services.json` |
| **EAS Channel**             | `development`                           | **`staging`**                              | **`production`**                      | Enforced en `eas.json`             |

---

## 2. Bloqueo de Staging por Falta de Configuración Legítima

Si el archivo `./google-services.staging.json` no existe en la raíz cuando `APP_VARIANT === 'staging'`, `app.config.js` lanza un error crítico y aborta la compilación de Expo/EAS. **Queda estrictamente prohibido usar el archivo `google-services.json` de producción como respaldo de Staging**.
