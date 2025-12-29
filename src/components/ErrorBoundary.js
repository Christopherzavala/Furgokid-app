import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import analyticsService from '../services/analyticsService';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.log('ErrorBoundary caught:', error, info);
    this.setState({ errorInfo: info });

    try {
      analyticsService.trackAppError(error?.message || 'Unknown error', {
        name: error?.name,
        stack: error?.stack,
        componentStack: info?.componentStack,
        fatal: true,
        tag: 'ErrorBoundary',
        action: 'componentDidCatch',
      });
    } catch {
      // no-op
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <Ionicons name="warning" size={64} color="#FF9800" />
          </View>
          <Text style={styles.title}>¡Oops! Algo salió mal</Text>
          <Text style={styles.message}>
            La aplicación encontró un error inesperado. Esto ha sido reportado automáticamente.
          </Text>

          {__DEV__ && this.state.error && (
            <View style={styles.debugContainer}>
              <Text style={styles.debugTitle}>Debug Info:</Text>
              <Text style={styles.debugText}>{this.state.error.toString()}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.primaryButton} onPress={this.handleReset}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>Reintentar</Text>
          </TouchableOpacity>

          <Text style={styles.helpText}>
            Si el problema persiste, contacta a soporte@furgokid.com
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8f9fa',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFF3E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  debugContainer: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
    width: '100%',
  },
  debugTitle: {
    fontWeight: 'bold',
    color: '#c62828',
    marginBottom: 4,
  },
  debugText: {
    fontSize: 12,
    color: '#c62828',
    fontFamily: 'monospace',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    gap: 8,
    marginBottom: 24,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});
