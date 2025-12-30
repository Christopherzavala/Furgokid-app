/**
 * Error Retry Utility
 * Implements exponential backoff for failed async operations
 */

export interface RetryConfig {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: Error) => boolean;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  shouldRetry: (error: Error) => {
    // Don't retry client errors (400-499) except 429 (rate limit)
    if (error.message.includes('auth/') || error.message.includes('permission')) {
      return false;
    }
    return true;
  },
};

/**
 * Retry an async operation with exponential backoff
 *
 * @example
 * const data = await retryWithBackoff(
 *   () => fetchUserData(userId),
 *   { maxRetries: 5, initialDelay: 2000 }
 * );
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  let lastError: Error;

  for (let attempt = 0; attempt < finalConfig.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry
      if (!finalConfig.shouldRetry(lastError)) {
        throw lastError;
      }

      // Don't wait after the last attempt
      if (attempt === finalConfig.maxRetries - 1) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        finalConfig.initialDelay * Math.pow(finalConfig.backoffMultiplier, attempt),
        finalConfig.maxDelay
      );

      console.log(
        `[Retry] Attempt ${attempt + 1}/${
          finalConfig.maxRetries
        } failed. Retrying in ${delay}ms...`,
        lastError.message
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Wrapper for Firebase operations with automatic retry
 */
export async function retryFirebaseOperation<T>(
  operation: () => Promise<T>,
  customConfig?: RetryConfig
): Promise<T> {
  return retryWithBackoff(operation, {
    maxRetries: 3,
    initialDelay: 1000,
    shouldRetry: (error: Error) => {
      const message = error.message.toLowerCase();
      // Retry network errors and server errors
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('unavailable') ||
        message.includes('internal')
      );
    },
    ...customConfig,
  });
}

/**
 * Wrapper for API calls with automatic retry
 */
export async function retryApiCall<T>(
  apiCall: () => Promise<T>,
  customConfig?: RetryConfig
): Promise<T> {
  return retryWithBackoff(apiCall, {
    maxRetries: 4,
    initialDelay: 500,
    maxDelay: 5000,
    shouldRetry: (error: Error) => {
      const message = error.message.toLowerCase();
      // Retry 5xx errors and network issues
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('500') ||
        message.includes('502') ||
        message.includes('503') ||
        message.includes('504')
      );
    },
    ...customConfig,
  });
}
