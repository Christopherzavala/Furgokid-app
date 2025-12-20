// LocationContext.js - Context API for GPS Location State Management
import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as locationService from '../services/locationService';
import { auth } from '../config/firebase';

const LocationContext = createContext();

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within LocationProvider');
  }
  return context;
};

export const LocationProvider = ({ children }) => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationHistory, setLocationHistory] = useState([]);
  const [permissions, setPermissions] = useState({
    foreground: false,
    background: false
  });
  const [error, setError] = useState(null);
  const appState = useRef(AppState.currentState);

  /**
   * Initialize location permissions on mount
   */
  useEffect(() => {
    checkPermissions();
    
    // Listen to app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
      stopTracking(); // Cleanup on unmount
    };
  }, []);

  /**
   * Check current location permissions
   */
  const checkPermissions = async () => {
    try {
      const perms = await locationService.requestLocationPermissions();
      setPermissions(perms);
      return perms;
    } catch (err) {
      console.error('Error checking permissions:', err);
      setError('Failed to check location permissions');
      return { foreground: false, background: false };
    }
  };

  /**
   * Handle app state changes (foreground/background)
   */
  const handleAppStateChange = async (nextAppState) => {
    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      // App came to foreground
      console.log('App came to foreground');
      await refreshLocation();
    }
    
    appState.current = nextAppState;
  };

  /**
   * Start GPS tracking
   */
  const startTracking = async () => {
    try {
      setError(null);
      
      const perms = await checkPermissions();
      
      if (!perms.foreground) {
        throw new Error('Location permission required');
      }
      
      let success;
      
      // Try background tracking first, fallback to foreground
      if (perms.background) {
        success = await locationService.startBackgroundLocationTracking();
      } else {
        success = await locationService.startForegroundLocationTracking();
      }
      
      if (success) {
        setIsTracking(true);
        await refreshLocation();
        await loadLocationHistory();
      } else {
        throw new Error('Failed to start location tracking');
      }
    } catch (err) {
      console.error('Error starting tracking:', err);
      setError(err.message);
      setIsTracking(false);
    }
  };

  /**
   * Stop GPS tracking
   */
  const stopTracking = async () => {
    try {
      await locationService.stopLocationTracking();
      setIsTracking(false);
    } catch (err) {
      console.error('Error stopping tracking:', err);
      setError('Failed to stop tracking');
    }
  };

  /**
   * Refresh current location
   */
  const refreshLocation = async () => {
    try {
      const location = await locationService.getCurrentLocation();
      if (location) {
        setCurrentLocation(location);
      }
    } catch (err) {
      console.error('Error refreshing location:', err);
    }
  };

  /**
   * Load location history from Firebase
   */
  const loadLocationHistory = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const history = await locationService.getLastLocations(user.uid, 50);
        setLocationHistory(history);
      }
    } catch (err) {
      console.error('Error loading location history:', err);
    }
  };

  /**
   * Calculate distance from current location to target
   */
  const getDistanceTo = (targetCoords) => {
    if (!currentLocation) return null;
    
    return locationService.calculateDistance(currentLocation, targetCoords);
  };

  /**
   * Check if tracking is active
   */
  const checkTrackingStatus = async () => {
    try {
      const status = await locationService.isTrackingActive();
      setIsTracking(status.any);
      return status;
    } catch (err) {
      console.error('Error checking tracking status:', err);
      return { background: false, foreground: false, any: false };
    }
  };

  const value = {
    // State
    isTracking,
    currentLocation,
    locationHistory,
    permissions,
    error,
    
    // Actions
    startTracking,
    stopTracking,
    refreshLocation,
    loadLocationHistory,
    checkPermissions,
    getDistanceTo,
    checkTrackingStatus,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};

export default LocationContext;
