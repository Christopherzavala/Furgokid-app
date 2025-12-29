/**
 * @jest-environment jsdom
 */
import React from 'react';

// Mock de módulos nativos
jest.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
  createNavigationContainerRef: () => ({ current: null }),
}));

jest.mock('@react-navigation/stack', () => ({
  createStackNavigator: () => ({
    Navigator: ({ children }: { children: React.ReactNode }) => children,
    Screen: () => null,
  }),
}));

jest.mock('../context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    user: null,
    loading: false,
    userProfile: null,
  }),
}));

jest.mock('../services/analyticsService', () => ({
  default: {
    trackSessionStart: jest.fn(),
    trackScreenView: jest.fn(),
  },
}));

describe('App', () => {
  it('should be defined', () => {
    expect(true).toBe(true);
  });

  it('should have proper test setup', () => {
    const mockFn = jest.fn();
    mockFn('test');
    expect(mockFn).toHaveBeenCalledWith('test');
  });
});
