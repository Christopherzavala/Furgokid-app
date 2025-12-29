/**
 * usePerformance - Hook para monitoreo de rendimiento
 *
 * Uso:
 * const { trackScreenLoad, trackApiCall, startTrace, stopTrace } = usePerformance();
 *
 * // En useEffect del componente
 * useEffect(() => {
 *   const endTrack = trackScreenLoad('HomeScreen');
 *   return () => endTrack();
 * }, []);
 */

import { useCallback, useEffect, useRef } from 'react';
import performanceService from '../services/performanceService';

interface UsePerformanceReturn {
  trackScreenLoad: (screenName: string) => () => void;
  trackApiCall: <T>(
    name: string,
    apiCall: () => Promise<T>,
    attributes?: Record<string, string | number | boolean>
  ) => Promise<T>;
  startTrace: (name: string, attributes?: Record<string, string | number | boolean>) => void;
  stopTrace: (
    name: string,
    additionalAttributes?: Record<string, string | number | boolean>
  ) => number;
  getAverageScreenLoadTime: (screenName: string) => number | null;
  printSummary: () => void;
}

export function usePerformance(): UsePerformanceReturn {
  const trackScreenLoad = useCallback((screenName: string) => {
    return performanceService.trackScreenLoad(screenName);
  }, []);

  const trackApiCall = useCallback(
    <T>(
      name: string,
      apiCall: () => Promise<T>,
      attributes: Record<string, string | number | boolean> = {}
    ) => {
      return performanceService.trackApiCall(name, apiCall, attributes);
    },
    []
  );

  const startTrace = useCallback(
    (name: string, attributes: Record<string, string | number | boolean> = {}) => {
      performanceService.startTrace(name, attributes);
    },
    []
  );

  const stopTrace = useCallback(
    (name: string, additionalAttributes: Record<string, string | number | boolean> = {}) => {
      return performanceService.stopTrace(name, additionalAttributes);
    },
    []
  );

  const getAverageScreenLoadTime = useCallback((screenName: string) => {
    return performanceService.getAverageScreenLoadTime(screenName);
  }, []);

  const printSummary = useCallback(() => {
    performanceService.printSummary();
  }, []);

  return {
    trackScreenLoad,
    trackApiCall,
    startTrace,
    stopTrace,
    getAverageScreenLoadTime,
    printSummary,
  };
}

/**
 * useScreenLoadTracking - Hook especializado para tracking de carga de pantalla
 *
 * Uso simple:
 * useScreenLoadTracking('HomeScreen');
 */
export function useScreenLoadTracking(screenName: string): void {
  const hasTracked = useRef(false);

  useEffect(() => {
    if (hasTracked.current) return;
    hasTracked.current = true;

    const endTrack = performanceService.trackScreenLoad(screenName);

    // Llamamos endTrack después del primer render completo
    requestAnimationFrame(() => {
      endTrack();
    });
  }, [screenName]);
}

export default usePerformance;
