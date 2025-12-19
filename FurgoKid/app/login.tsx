import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/src/config/firebase';
import { router } from 'expo-router';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validatePassword = (password: string) => {
        return password.length >= 6;
    };

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Por favor ingresa email y contraseña');
            return;
        }

        if (!validateEmail(email)) {
            Alert.alert('Error', 'Por favor ingresa un email válido');
            return;
        }

        if (!validatePassword(password)) {
            Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setLoading(true);

        try {
            if (isSignUp) {
                if (password !== confirmPassword) {
                    Alert.alert('Error', 'Las contraseñas no coinciden');
                    setLoading(false);
                    return;
                }
                await createUserWithEmailAndPassword(auth, email, password);
                Alert.alert('¡Éxito!', 'Cuenta creada correctamente. Ahora puedes iniciar sesión.');
                setIsSignUp(false);
                setPassword('');
                setConfirmPassword('');
            } else {
                await signInWithEmailAndPassword(auth, email, password);
                router.replace('/(tabs)');
            }
        } catch (error: any) {
            let errorMessage = 'Error desconocido';

            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'No existe una cuenta con este email';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Contraseña incorrecta';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Email inválido';
                    break;
                case 'auth/email-already-in-use':
                    errorMessage = 'Este email ya está registrado';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'La contraseña es muy débil';
                    break;
                default:
                    errorMessage = error.message;
            }

            Alert.alert('Error', errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const toggleMode = () => {
        setIsSignUp(!isSignUp);
        setPassword('');
        setConfirmPassword('');
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.gradient}>
                <ScrollView contentContainerStyle={styles.scrollContainer}>
                    <View style={styles.header}>
                        <View style={styles.logoPlaceholder}>
                            <Ionicons name="bus" size={60} color="#2196F3" />
                        </View>
                        <Text style={styles.title}>FurgoKid</Text>
                        <Text style={styles.subtitle}>
                            Sistema de Rastreo Escolar
                        </Text>
                    </View>

                    <View style={styles.form}>
                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        <View style={styles.passwordContainer}>
                            <TextInput
                                style={styles.passwordInput}
                                placeholder="Contraseña"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity
                                style={styles.eyeIcon}
                                onPress={() => setShowPassword(!showPassword)}
                            >
                                <Ionicons
                                    name={showPassword ? 'eye-off' : 'eye'}
                                    size={24}
                                    color="#666"
                                />
                            </TouchableOpacity>
                        </View>

                        {isSignUp && (
                            <View style={styles.passwordContainer}>
                                <TextInput
                                    style={styles.passwordInput}
                                    placeholder="Confirmar Contraseña"
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                />
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.buttonText}>
                                    {isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
                                </Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.switchButton}
                            onPress={toggleMode}
                        >
                            <Text style={styles.switchText}>
                                {isSignUp
                                    ? '¿Ya tienes cuenta? Inicia Sesión'
                                    : '¿No tienes cuenta? Regístrate'
                                }
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.dividerContainer}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>O continúa con</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <TouchableOpacity
                            style={styles.googleButton}
                            onPress={() => Alert.alert('Próximamente', 'El inicio de sesión con Google estará disponible pronto')}
                        >
                            <Ionicons name="logo-google" size={24} color="#DB4437" />
                            <Text style={styles.googleButtonText}>Ingresar con Google</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.features}>
                        <Text style={styles.featuresTitle}>Características de FurgoKid:</Text>
                        <View style={styles.feature}>
                            <Ionicons name="location" size={20} color="#2196F3" />
                            <Text style={styles.featureText}>Seguimiento GPS en tiempo real</Text>
                        </View>
                        <View style={styles.feature}>
                            <Ionicons name="shield-checkmark" size={20} color="#2196F3" />
                            <Text style={styles.featureText}>Máxima seguridad para niños</Text>
                        </View>
                        <View style={styles.feature}>
                            <Ionicons name="notifications" size={20} color="#2196F3" />
                            <Text style={styles.featureText}>Notificaciones automáticas</Text>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    gradient: {
        flex: 1,
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
    },
    logoPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#E3F2FD',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 15,
    },
    title: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#2196F3',
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    form: {
        backgroundColor: '#fff',
        padding: 25,
        borderRadius: 15,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        marginBottom: 20,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
        fontSize: 16,
        backgroundColor: '#f9f9f9',
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        marginBottom: 15,
        backgroundColor: '#f9f9f9',
    },
    passwordInput: {
        flex: 1,
        padding: 15,
        fontSize: 16,
    },
    eyeIcon: {
        padding: 15,
    },
    button: {
        backgroundColor: '#2196F3',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 10,
    },
    buttonDisabled: {
        backgroundColor: '#90CAF9',
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    switchButton: {
        alignItems: 'center',
        padding: 10,
    },
    switchText: {
        color: '#2196F3',
        fontSize: 16,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#ddd',
    },
    dividerText: {
        marginHorizontal: 10,
        color: '#666',
        fontSize: 14,
    },
    googleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#ddd',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
    },
    googleButtonText: {
        color: '#333',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 10,
    },
    features: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 15,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    featuresTitle: {
        color: '#333',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
        textAlign: 'center',
    },
    feature: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    featureText: {
        color: '#666',
        marginLeft: 10,
        fontSize: 14,
    },
});
