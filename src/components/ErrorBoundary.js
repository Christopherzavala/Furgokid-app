// ErrorBoundary.js - Componente para capturar errores de React
import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES } from '../config/constants';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error) {
        // Actualizar estado para mostrar UI de error
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // Capturar detalles del error
        this.setState({
            error,
            errorInfo,
        });

        // Aquí puedes enviar el error a un servicio de logging
        console.error('Error capturado por ErrorBoundary:', error, errorInfo);

        // TODO: Enviar a servicio de logging (ej: Sentry, Firebase Crashlytics)
        // logErrorToService(error, errorInfo);
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <ScrollView contentContainerStyle={styles.scrollContent}>
                        <View style={styles.iconContainer}>
                            <Ionicons
                                name="alert-circle"
                                size={80}
                                color={COLORS.error}
                            />
                        </View>

                        <Text style={styles.title}>¡Oops! Algo salió mal</Text>
                        <Text style={styles.subtitle}>
                            La aplicación encontró un error inesperado
                        </Text>

                        {__DEV__ && this.state.error && (
                            <View style={styles.errorDetails}>
                                <Text style={styles.errorTitle}>Detalles del Error:</Text>
                                <Text style={styles.errorText}>
                                    {this.state.error.toString()}
                                </Text>
                                {this.state.errorInfo && (
                                    <Text style={styles.errorStack}>
                                        {this.state.errorInfo.componentStack}
                                    </Text>
                                )}
                            </View>
                        )}

                        <TouchableOpacity
                            style={styles.button}
                            onPress={this.handleReset}
                        >
                            <Ionicons name="refresh" size={20} color="#fff" />
                            <Text style={styles.buttonText}>Intentar de Nuevo</Text>
                        </TouchableOpacity>

                        <Text style={styles.helpText}>
                            Si el problema persiste, por favor contacta a soporte
                        </Text>
                    </ScrollView>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: SIZES.xl,
    },
    iconContainer: {
        marginBottom: SIZES.lg,
    },
    title: {
        fontSize: SIZES.fontXXL,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
        marginBottom: SIZES.sm,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: SIZES.fontMD,
        color: COLORS.textSecondary,
        marginBottom: SIZES.xl,
        textAlign: 'center',
    },
    errorDetails: {
        width: '100%',
        backgroundColor: COLORS.surface,
        padding: SIZES.md,
        borderRadius: SIZES.radiusMD,
        marginBottom: SIZES.lg,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.error,
    },
    errorTitle: {
        fontSize: SIZES.fontMD,
        fontWeight: 'bold',
        color: COLORS.error,
        marginBottom: SIZES.sm,
    },
    errorText: {
        fontSize: SIZES.fontSM,
        color: COLORS.textPrimary,
        fontFamily: 'monospace',
        marginBottom: SIZES.sm,
    },
    errorStack: {
        fontSize: SIZES.fontXS,
        color: COLORS.textSecondary,
        fontFamily: 'monospace',
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: SIZES.xl,
        paddingVertical: SIZES.md,
        borderRadius: SIZES.radiusMD,
        marginBottom: SIZES.md,
    },
    buttonText: {
        color: COLORS.textWhite,
        fontSize: SIZES.fontMD,
        fontWeight: 'bold',
        marginLeft: SIZES.sm,
    },
    helpText: {
        fontSize: SIZES.fontSM,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: SIZES.md,
    },
});

export default ErrorBoundary;
