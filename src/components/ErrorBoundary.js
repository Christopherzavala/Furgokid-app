import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import analyticsService from '../services/analyticsService';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.log('ErrorBoundary caught:', error, info);
    try {
      analyticsService.trackAppError(error?.message || 'Unknown error', {
        name: error?.name,
        stack: error?.stack,
        componentStack: info?.componentStack,
        fatal: true,
      });
    } catch {
      // no-op
    }
  }

  handleReset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>Algo faló</Text>
          <Text style={{ color: '#888', textAlign: 'center', marginBottom: 16 }}>
            Reinicia o intenta nuevamente.
          </Text>
          <TouchableOpacity
            onPress={this.handleReset}
            style={{ backgroundColor: '#2d6cdf', padding: 12, borderRadius: 8 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}
