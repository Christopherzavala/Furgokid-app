/**
 * Hook for automatic performance tracking
 * Tracks screen load times and component mount/unmount
 */

import { useEffect, useRef } from 'react';
import performanceService from '../services/performanceService';

/**
 * Track screen load time automatically
 *
 * @example
 * function MyScreen() {
 *   usePerformanceTracking('MyScreen');
 *   // ... rest of component
 * }
 */
export function usePerformanceTracking(screenName: string, attributes?: Record<string, any>) {
  const startTimeRef = useRef<number>(Date.now());
  const trackedRef = useRef<boolean>(false);

  useEffect(() => {
    const traceName = `screen_${screenName}`;

    // Start trace on mount
    performanceService.startTrace(traceName, {
      screen: screenName,
      ...attributes,
    });

    return () => {
      // Stop trace on unmount
      if (!trackedRef.current) {
        const loadTime = Date.now() - startTimeRef.current;
        performanceService.stopTrace(traceName, {
          load_time: loadTime,
          ...attributes,
        });
        trackedRef.current = true;
      }
    };
  }, [screenName]);
}

/**
 * Track async operation performance
 *
 * @example
 * const trackOperation = useOperationTracking('fetch_data');
 * await trackOperation(async () => {
 *   return await fetchData();
 * });
 */
export function useOperationTracking(operationName: string) {
  return async <T>(operation: () => Promise<T>, attributes?: Record<string, any>): Promise<T> => {
    const traceName = `operation_${operationName}`;
    performanceService.startTrace(traceName, attributes);

    try {
      const result = await operation();
      performanceService.stopTrace(traceName, { success: true, ...attributes });
      return result;
    } catch (error) {
      performanceService.stopTrace(traceName, { success: false, error: true, ...attributes });
      throw error;
    }
  };
}

export default usePerformanceTracking;
