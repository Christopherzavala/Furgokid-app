/**
 * Health Monitoring Script
 *
 * Monitorea continuamente el estado del backend y alerta sobre problemas.
 * Ejecutar en servidor o localmente con: node scripts/monitor-health.js
 */

const admin = require('firebase-admin');
const https = require('https');

// Configuración
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos
const ERROR_RATE_THRESHOLD = 50; // %
const MIN_SAMPLES = 10; // Mínimo de muestras para calcular error rate
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL; // Opcional

// Colores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

// Inicializar Firebase Admin
let serviceAccountPath = './serviceAccountKey.json';
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

try {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  console.log(`${colors.green}✅ Firebase Admin inicializado${colors.reset}\n`);
} catch (error) {
  console.error(
    `${colors.red}❌ Error inicializando Firebase Admin:${colors.reset}`,
    error.message
  );
  console.log(
    `${colors.yellow}💡 Asegúrate de tener serviceAccountKey.json o GOOGLE_APPLICATION_CREDENTIALS${colors.reset}`
  );
  process.exit(1);
}

const db = admin.firestore();

/**
 * Envía alerta a Slack (opcional)
 */
function sendSlackAlert(message, severity = 'warning') {
  if (!SLACK_WEBHOOK_URL) return;

  const emoji = severity === 'critical' ? '🚨' : '⚠️';
  const payload = JSON.stringify({
    text: `${emoji} *Furgokid Alert*: ${message}`,
    username: 'Health Monitor',
    icon_emoji: ':chart_with_upwards_trend:',
  });

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': payload.length,
    },
  };

  const req = https.request(SLACK_WEBHOOK_URL, options, (res) => {
    if (res.statusCode !== 200) {
      console.log(`${colors.yellow}⚠️  Slack alert failed: ${res.statusCode}${colors.reset}`);
    }
  });

  req.on('error', (error) => {
    console.log(`${colors.yellow}⚠️  Slack alert error: ${error.message}${colors.reset}`);
  });

  req.write(payload);
  req.end();
}

/**
 * Verifica el delivery rate de notificaciones
 */
async function checkDeliveryRate() {
  const fiveMinutesAgo = new Date(Date.now() - CHECK_INTERVAL);

  try {
    const logsSnapshot = await db
      .collection('notification_logs')
      .where('timestamp', '>=', fiveMinutesAgo)
      .get();

    const total = logsSnapshot.size;

    if (total === 0) {
      console.log(`${colors.cyan}📊 No hay notificaciones en los últimos 5 minutos${colors.reset}`);
      return { healthy: true, total: 0, successful: 0, deliveryRate: 100 };
    }

    const successful = logsSnapshot.docs.filter((doc) => doc.data().status === 'success').length;

    const deliveryRate = total > 0 ? (successful / total) * 100 : 0;

    console.log(`${colors.cyan}📊 Delivery Rate: ${deliveryRate.toFixed(2)}%${colors.reset}`);
    console.log(`   ✅ Successful: ${successful}`);
    console.log(`   📊 Total: ${total}`);

    if (deliveryRate < 90 && total >= MIN_SAMPLES) {
      console.log(`${colors.yellow}⚠️  WARNING: Delivery rate < 90%${colors.reset}`);
      sendSlackAlert(
        `Delivery rate bajo: ${deliveryRate.toFixed(2)}% (${successful}/${total})`,
        'warning'
      );
    }

    if (deliveryRate < 50 && total >= MIN_SAMPLES) {
      console.log(`${colors.red}🚨 CRITICAL: Delivery rate < 50%${colors.reset}`);
      sendSlackAlert(
        `CRITICAL: Delivery rate ${deliveryRate.toFixed(2)}% - Posible rollback necesario`,
        'critical'
      );
    }

    return {
      healthy: deliveryRate >= 90 || total < MIN_SAMPLES,
      total,
      successful,
      deliveryRate: deliveryRate.toFixed(2),
    };
  } catch (error) {
    console.error(`${colors.red}❌ Error checking delivery rate:${colors.reset}`, error.message);
    return { healthy: false, error: error.message };
  }
}

/**
 * Analiza errores recientes
 */
async function checkErrors() {
  const fiveMinutesAgo = new Date(Date.now() - CHECK_INTERVAL);

  try {
    const errorsSnapshot = await db
      .collection('notification_errors')
      .where('timestamp', '>=', fiveMinutesAgo)
      .get();

    const errorCount = errorsSnapshot.size;

    if (errorCount === 0) {
      console.log(`${colors.green}✅ No hay errores en los últimos 5 minutos${colors.reset}`);
      return { healthy: true, errorCount: 0, errorTypes: {} };
    }

    console.log(`${colors.yellow}❌ Errores encontrados: ${errorCount}${colors.reset}`);

    // Agrupar por tipo de error
    const errorTypes = {};
    errorsSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const errorCode = data.error?.code || data.error?.message || 'unknown';
      errorTypes[errorCode] = (errorTypes[errorCode] || 0) + 1;
    });

    console.log(`${colors.cyan}   Por tipo:${colors.reset}`);
    Object.entries(errorTypes).forEach(([type, count]) => {
      console.log(`   - ${type}: ${count}`);
    });

    if (errorCount > 20) {
      console.log(`${colors.red}🚨 CRITICAL: Muchos errores (${errorCount})${colors.reset}`);
      sendSlackAlert(`Alto número de errores: ${errorCount} en 5 minutos`, 'critical');
    }

    return { healthy: errorCount < 10, errorCount, errorTypes };
  } catch (error) {
    console.error(`${colors.red}❌ Error checking errors:${colors.reset}`, error.message);
    return { healthy: false, error: error.message };
  }
}

/**
 * Verifica usuarios activos recientes
 */
async function checkActiveUsers() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  try {
    const usersSnapshot = await db.collection('users').where('updatedAt', '>=', oneHourAgo).get();

    const activeUsers = usersSnapshot.size;
    console.log(`${colors.cyan}👥 Usuarios activos (1h): ${activeUsers}${colors.reset}`);

    return { healthy: true, activeUsers };
  } catch (error) {
    console.error(`${colors.red}❌ Error checking active users:${colors.reset}`, error.message);
    return { healthy: false, error: error.message };
  }
}

/**
 * Verifica requests pendientes
 */
async function checkPendingRequests() {
  try {
    const requestsSnapshot = await db.collection('requests').where('status', '==', 'pending').get();

    const pendingCount = requestsSnapshot.size;
    console.log(`${colors.cyan}📋 Requests pendientes: ${pendingCount}${colors.reset}`);

    if (pendingCount > 50) {
      console.log(
        `${colors.yellow}⚠️  WARNING: Muchas requests pendientes (${pendingCount})${colors.reset}`
      );
    }

    return { healthy: true, pendingCount };
  } catch (error) {
    console.error(`${colors.red}❌ Error checking pending requests:${colors.reset}`, error.message);
    return { healthy: false, error: error.message };
  }
}

/**
 * Health check completo
 */
async function performHealthCheck() {
  const timestamp = new Date().toISOString();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${colors.cyan}🏥 Health Check - ${timestamp}${colors.reset}`);
  console.log('='.repeat(60));
  console.log('');

  const results = {
    timestamp,
    deliveryRate: await checkDeliveryRate(),
    errors: await checkErrors(),
    activeUsers: await checkActiveUsers(),
    pendingRequests: await checkPendingRequests(),
  };

  // Determinar estado general
  const allHealthy =
    results.deliveryRate.healthy &&
    results.errors.healthy &&
    results.activeUsers.healthy &&
    results.pendingRequests.healthy;

  console.log('\n' + '='.repeat(60));
  if (allHealthy) {
    console.log(`${colors.green}✅ SISTEMA SALUDABLE${colors.reset}`);
  } else {
    console.log(`${colors.yellow}⚠️  SISTEMA CON PROBLEMAS - Revisar arriba${colors.reset}`);
  }
  console.log('='.repeat(60));

  // Guardar log (opcional)
  const logEntry = {
    timestamp,
    healthy: allHealthy,
    metrics: {
      deliveryRate: results.deliveryRate.deliveryRate,
      totalNotifications: results.deliveryRate.total,
      errorCount: results.errors.errorCount,
      activeUsers: results.activeUsers.activeUsers,
      pendingRequests: results.pendingRequests.pendingCount,
    },
  };

  // Log a archivo si se quiere
  // fs.appendFileSync('logs/health-monitor.log', JSON.stringify(logEntry) + '\n');

  return results;
}

/**
 * Loop de monitoreo continuo
 */
async function startMonitoring() {
  console.log(`${colors.cyan}🚀 Iniciando Health Monitor...${colors.reset}`);
  console.log(
    `${colors.cyan}📊 Check interval: ${CHECK_INTERVAL / 1000}s (${
      CHECK_INTERVAL / 60000
    } minutos)${colors.reset}`
  );
  console.log(
    `${colors.cyan}🔔 Slack alerts: ${SLACK_WEBHOOK_URL ? 'Enabled' : 'Disabled'}${colors.reset}`
  );
  console.log('');

  // Health check inicial
  await performHealthCheck();

  // Loop continuo
  setInterval(async () => {
    await performHealthCheck();
  }, CHECK_INTERVAL);
}

// Manejo de errores no capturados
process.on('unhandledRejection', (error) => {
  console.error(`${colors.red}❌ Unhandled rejection:${colors.reset}`, error);
});

process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}👋 Health Monitor detenido${colors.reset}`);
  process.exit(0);
});

// Iniciar monitoring
if (require.main === module) {
  startMonitoring().catch((error) => {
    console.error(`${colors.red}❌ Monitor crashed:${colors.reset}`, error);
    process.exit(1);
  });
}

module.exports = { performHealthCheck, checkDeliveryRate, checkErrors };
