/**
 * Structured Logging Service
 *
 * Provides centralized, structured logging with levels, correlation IDs,
 * and integration with Sentry for error tracking.
 *
 * @example
 * ```typescript
 * import logger from '@/utils/logger';
 *
 * logger.info('User logged in', { userId: '123', email: 'user@example.com' });
 * logger.error('Payment failed', { orderId: '456', reason: 'Invalid card' }, error);
 * ```
 */

import { addBreadcrumb, captureException } from '../config/sentry';

/**
 * Log levels following industry standards (RFC 5424)
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

/**
 * Log level priority for filtering
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
  [LogLevel.FATAL]: 4,
};

/**
 * Structured log entry
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
  correlationId?: string;
  userId?: string;
  environment: string;
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableSentry: boolean;
  enableRemote: boolean;
  remoteEndpoint?: string;
}

class Logger {
  private config: LoggerConfig;
  private correlationId: string | null = null;
  private userId: string | null = null;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      minLevel: __DEV__ ? LogLevel.DEBUG : LogLevel.INFO,
      enableConsole: true,
      enableSentry: !__DEV__, // Only in production
      enableRemote: false, // TODO: Implement remote logging
      ...config,
    };
  }

  /**
   * Set correlation ID for request tracing
   */
  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  /**
   * Clear correlation ID
   */
  clearCorrelationId(): void {
    this.correlationId = null;
  }

  /**
   * Set user ID for user-scoped logs
   */
  setUserId(userId: string): void {
    this.userId = userId;
  }

  /**
   * Clear user ID
   */
  clearUserId(): void {
    this.userId = null;
  }

  /**
   * Generate unique correlation ID
   */
  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.minLevel];
  }

  /**
   * Create structured log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error,
      correlationId: this.correlationId || undefined,
      userId: this.userId || undefined,
      environment: __DEV__ ? 'development' : 'production',
    };
  }

  /**
   * Format log entry for console
   */
  private formatConsoleLog(entry: LogEntry): string {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}]`;
    const correlation = entry.correlationId ? `[${entry.correlationId}]` : '';
    const user = entry.userId ? `[user:${entry.userId}]` : '';

    let message = `${prefix}${correlation}${user} ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      message += `\n  Context: ${JSON.stringify(entry.context, null, 2)}`;
    }

    if (entry.error) {
      message += `\n  Error: ${entry.error.message}`;
      message += `\n  Stack: ${entry.error.stack}`;
    }

    return message;
  }

  /**
   * Send log to console with appropriate method
   */
  private logToConsole(entry: LogEntry): void {
    if (!this.config.enableConsole) return;

    const formatted = this.formatConsoleLog(entry);

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.log(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formatted);
        break;
    }
  }

  /**
   * Send log to Sentry
   */
  private logToSentry(entry: LogEntry): void {
    if (!this.config.enableSentry) return;

    // Add breadcrumb for all levels
    addBreadcrumb(entry.message, 'log', entry.context);

    // Capture exception for errors and fatal
    if ((entry.level === LogLevel.ERROR || entry.level === LogLevel.FATAL) && entry.error) {
      captureException(entry.error, {
        level: entry.level === LogLevel.FATAL ? 'fatal' : 'error',
        extra: {
          message: entry.message,
          context: entry.context,
          correlationId: entry.correlationId,
          userId: entry.userId,
        },
      });
    }
  }

  /**
   * Send log to remote endpoint (future implementation)
   */
  private async logToRemote(entry: LogEntry): Promise<void> {
    if (!this.config.enableRemote || !this.config.remoteEndpoint) return;

    try {
      // TODO: Implement batch sending to prevent network overhead
      // Consider using a queue and sending in batches
      await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch (error) {
      // Fail silently to prevent logging errors from crashing app
      console.error('[Logger] Failed to send log to remote:', error);
    }
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, message, context, error);

    this.logToConsole(entry);
    this.logToSentry(entry);

    // Fire and forget for remote logging
    if (this.config.enableRemote) {
      this.logToRemote(entry).catch(() => {
        // Silently fail
      });
    }
  }

  /**
   * Log debug message (development only)
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log informational message
   */
  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log error message
   */
  error(message: string, context?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Log fatal error (critical system failure)
   */
  fatal(message: string, context?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.FATAL, message, context, error);
  }

  /**
   * Create a child logger with preset context
   */
  child(context: Record<string, any>): ChildLogger {
    return new ChildLogger(this, context);
  }
}

/**
 * Child logger with preset context
 */
class ChildLogger {
  constructor(private parent: Logger, private baseContext: Record<string, any>) {}

  private mergeContext(context?: Record<string, any>): Record<string, any> {
    return { ...this.baseContext, ...context };
  }

  debug(message: string, context?: Record<string, any>): void {
    this.parent.debug(message, this.mergeContext(context));
  }

  info(message: string, context?: Record<string, any>): void {
    this.parent.info(message, this.mergeContext(context));
  }

  warn(message: string, context?: Record<string, any>): void {
    this.parent.warn(message, this.mergeContext(context));
  }

  error(message: string, context?: Record<string, any>, error?: Error): void {
    this.parent.error(message, this.mergeContext(context), error);
  }

  fatal(message: string, context?: Record<string, any>, error?: Error): void {
    this.parent.fatal(message, this.mergeContext(context), error);
  }
}

// Export singleton instance
const logger = new Logger();

export default logger;

/**
 * Usage Examples:
 *
 * // Basic logging
 * logger.info('App started');
 * logger.warn('Low memory warning', { available: '50MB' });
 * logger.error('Failed to fetch data', { endpoint: '/api/users' }, error);
 *
 * // With correlation ID (for request tracing)
 * logger.setCorrelationId('req-12345');
 * logger.info('Processing payment');
 * logger.clearCorrelationId();
 *
 * // With user context
 * logger.setUserId('user-abc');
 * logger.info('User viewed profile');
 *
 * // Child logger with preset context
 * const authLogger = logger.child({ service: 'auth' });
 * authLogger.info('Login attempt', { email: 'user@example.com' });
 * authLogger.error('Login failed', { reason: 'Invalid password' });
 *
 * // Service-specific logger
 * const paymentLogger = logger.child({
 *   service: 'payment',
 *   version: '1.0.0'
 * });
 * paymentLogger.info('Payment initiated', {
 *   amount: 99.99,
 *   currency: 'USD'
 * });
 */
