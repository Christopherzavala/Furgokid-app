# 💳 Guía de Integración de Pagos - FurgoKid

## 🎯 Objetivo
Implementar un sistema completo de pagos y facturación para monetizar FurgoKid.

---

## 📋 Opciones de Procesadores de Pago

### Opción 1: Stripe (Recomendado para Internacional)

**Ventajas:**
- ✅ Fácil integración con React Native
- ✅ Soporte para suscripciones recurrentes
- ✅ Acepta tarjetas de crédito/débito
- ✅ Webhooks para automatización
- ✅ Dashboard completo
- ✅ Documentación excelente

**Desventajas:**
- ❌ Comisión 2.9% + $0.30 por transacción
- ❌ Requiere cuenta bancaria en USA/Europa para algunos países

**Países soportados en LATAM:**
- México, Brasil, Chile, Colombia, Perú, Argentina (limitado)

---

### Opción 2: MercadoPago (Recomendado para LATAM)

**Ventajas:**
- ✅ Muy popular en LATAM
- ✅ Acepta métodos de pago locales
- ✅ Soporte para suscripciones
- ✅ Fácil integración
- ✅ Comisiones competitivas

**Desventajas:**
- ❌ Menos features que Stripe
- ❌ Documentación menos completa

**Países soportados:**
- Argentina, Brasil, Chile, Colombia, México, Perú, Uruguay

---

### Opción 3: PayPal

**Ventajas:**
- ✅ Reconocimiento mundial
- ✅ Fácil de usar
- ✅ Soporte para suscripciones

**Desventajas:**
- ❌ Comisiones más altas (3.4% + $0.30)
- ❌ Menos popular en LATAM
- ❌ Integración más compleja

---

## 🚀 Implementación con Stripe (Paso a Paso)

### 1. Crear Cuenta en Stripe

1. Ve a https://stripe.com
2. Crea una cuenta
3. Completa la verificación de identidad
4. Obtén tus API keys (Dashboard > Developers > API keys)

---

### 2. Instalar Dependencias

```bash
npm install @stripe/stripe-react-native
npm install stripe
```

---

### 3. Configurar Stripe en el Backend (Firebase Functions)

Crea `functions/src/stripe.ts`:

```typescript
import Stripe from 'stripe';
import * as functions from 'firebase-functions';
import { db } from './firebase';

const stripe = new Stripe(functions.config().stripe.secret_key, {
  apiVersion: '2023-10-16',
});

// Crear Customer en Stripe
export const createStripeCustomer = async (userId: string, email: string) => {
  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });

  await db.collection('users').doc(userId).update({
    stripeCustomerId: customer.id,
  });

  return customer.id;
};

// Crear Suscripción
export const createSubscription = async (
  customerId: string,
  priceId: string
) => {
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
  });

  return subscription;
};

// Webhook para eventos de Stripe
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = functions.config().stripe.webhook_secret;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Manejar eventos
  switch (event.type) {
    case 'customer.subscription.created':
      await handleSubscriptionCreated(event.data.object);
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object);
      break;
    case 'invoice.paid':
      await handleInvoicePaid(event.data.object);
      break;
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event.data.object);
      break;
  }

  res.json({ received: true });
});

// Handlers
async function handleSubscriptionCreated(subscription: any) {
  const userId = subscription.metadata.userId;
  await db.collection('subscriptions').doc(userId).set({
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
  });
}

async function handleSubscriptionUpdated(subscription: any) {
  const userId = subscription.metadata.userId;
  await db.collection('subscriptions').doc(userId).update({
    status: subscription.status,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
  });
}

async function handleSubscriptionDeleted(subscription: any) {
  const userId = subscription.metadata.userId;
  await db.collection('subscriptions').doc(userId).update({
    status: 'canceled',
    plan: 'free',
  });
}

async function handleInvoicePaid(invoice: any) {
  // Crear registro de factura
  await db.collection('invoices').add({
    userId: invoice.customer_metadata?.userId,
    amount: invoice.amount_paid / 100,
    currency: invoice.currency,
    status: 'paid',
    paidAt: new Date(invoice.status_transitions.paid_at * 1000),
    invoiceUrl: invoice.hosted_invoice_url,
    receiptUrl: invoice.receipt_url,
  });
}

async function handleInvoicePaymentFailed(invoice: any) {
  // Notificar al usuario
  console.log('Payment failed for invoice:', invoice.id);
}
```

---

### 4. Configurar Stripe en el Frontend

Crea `src/services/stripeService.ts`:

```typescript
import { initStripe, useStripe } from '@stripe/stripe-react-native';
import { functions } from '../config/firebase';
import { httpsCallable } from 'firebase/functions';

// Inicializar Stripe
export const initializeStripe = async () => {
  await initStripe({
    publishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
    merchantIdentifier: 'merchant.com.furgokid',
  });
};

// Crear Payment Intent
export const createPaymentIntent = async (amount: number, currency: string = 'usd') => {
  const createPaymentIntentFn = httpsCallable(functions, 'createPaymentIntent');
  const result = await createPaymentIntentFn({ amount, currency });
  return result.data;
};

// Crear Suscripción
export const createSubscription = async (priceId: string) => {
  const createSubscriptionFn = httpsCallable(functions, 'createSubscription');
  const result = await createSubscriptionFn({ priceId });
  return result.data;
};
```

---

### 5. Crear Pantalla de Pago

```typescript
import React, { useState } from 'react';
import { View, Button, Alert } from 'react-native';
import { CardField, useStripe } from '@stripe/stripe-react-native';
import { createPaymentIntent } from '../services/stripeService';

export default function PaymentScreen() {
  const { confirmPayment } = useStripe();
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);

    try {
      // 1. Crear Payment Intent en el backend
      const { clientSecret } = await createPaymentIntent(999); // $9.99

      // 2. Confirmar pago
      const { error, paymentIntent } = await confirmPayment(clientSecret, {
        paymentMethodType: 'Card',
      });

      if (error) {
        Alert.alert('Error', error.message);
      } else if (paymentIntent) {
        Alert.alert('¡Éxito!', 'Pago procesado correctamente');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <CardField
        postalCodeEnabled={false}
        style={{ height: 50, marginVertical: 20 }}
      />
      <Button title="Pagar $9.99" onPress={handlePayment} disabled={loading} />
    </View>
  );
}
```

---

### 6. Configurar Productos y Precios en Stripe

1. Ve a Stripe Dashboard > Products
2. Crea productos para cada plan:
   - **Plan Básico**: $9.99/mes
   - **Plan Familiar**: $19.99/mes
   - **Plan Escuela**: $99.99/mes

3. Copia los Price IDs:
   - `price_basic_monthly`
   - `price_family_monthly`
   - `price_school_monthly`

4. Actualiza en `src/types/subscription.ts`:

```typescript
export const STRIPE_PRICE_IDS = {
  basic: 'price_1234567890',
  family: 'price_0987654321',
  school: 'price_1122334455',
};
```

---

### 7. Configurar Webhooks

1. En Stripe Dashboard > Developers > Webhooks
2. Agrega endpoint: `https://tu-proyecto.cloudfunctions.net/stripeWebhook`
3. Selecciona eventos:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`

4. Copia el Webhook Secret
5. Configura en Firebase Functions:

```bash
firebase functions:config:set stripe.webhook_secret="whsec_..."
```

---

## 💰 Estructura de Precios Recomendada

| Plan | Precio Mensual | Precio Anual | Ahorro Anual |
|------|----------------|--------------|--------------|
| Básico | $9.99 | $99.99 | $19.89 (17%) |
| Familiar | $19.99 | $199.99 | $39.89 (17%) |
| Escuela | $99.99 | $999.99 | $199.89 (17%) |

---

## 📊 Métricas de Facturación

### KPIs Importantes

1. **MRR (Monthly Recurring Revenue)**
   - Ingresos recurrentes mensuales
   - Meta: $10,000 en 6 meses

2. **Churn Rate**
   - % de usuarios que cancelan
   - Meta: <5% mensual

3. **ARPU (Average Revenue Per User)**
   - Ingreso promedio por usuario
   - Meta: $15-20

4. **LTV (Lifetime Value)**
   - Valor total de un cliente
   - Meta: >$200

5. **CAC (Customer Acquisition Cost)**
   - Costo de adquirir un cliente
   - Meta: <$30

---

## 🔐 Seguridad y Compliance

### PCI Compliance
- ✅ Nunca almacenar datos de tarjetas
- ✅ Usar Stripe Elements/CardField
- ✅ HTTPS obligatorio
- ✅ Tokens en lugar de números de tarjeta

### GDPR/Privacidad
- ✅ Política de privacidad clara
- ✅ Términos y condiciones
- ✅ Opción de eliminar datos
- ✅ Consentimiento explícito

---

## 📧 Emails Transaccionales

Configura emails automáticos para:

1. **Bienvenida**: Al registrarse
2. **Confirmación de pago**: Al procesar pago
3. **Factura**: Mensualmente
4. **Recordatorio de pago**: Si falla el pago
5. **Cancelación**: Al cancelar suscripción
6. **Renovación**: 7 días antes de renovar

**Herramientas recomendadas:**
- SendGrid
- Mailgun
- Amazon SES

---

## 🚀 Próximos Pasos

1. ✅ **Semana 1-2**: Configurar Stripe/MercadoPago
2. ✅ **Semana 3**: Implementar pantalla de pago
3. ✅ **Semana 4**: Configurar webhooks
4. ✅ **Semana 5**: Testing exhaustivo
5. ✅ **Semana 6**: Lanzamiento beta con pagos

---

**Última actualización**: 2025-11-25  
**Versión**: 1.0
