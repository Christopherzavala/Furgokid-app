import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '@/src/config/firebase';
import { signOut } from 'firebase/auth';
import { router } from 'expo-router';

export default function SettingsScreen() {
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [locationEnabled, setLocationEnabled] = useState(true);
    const [soundEnabled, setSoundEnabled] = useState(true);

    const handleLogout = async () => {
        Alert.alert(
            'Cerrar Sesión',
            '¿Estás seguro que deseas cerrar sesión?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Cerrar Sesión',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await signOut(auth);
                            router.replace('/login' as any);
                        } catch (error) {
                            console.error('Error signing out:', error);
                        }
                    },
                },
            ]
        );
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Cuenta</Text>
                <View style={styles.card}>
                    <View style={styles.accountInfo}>
                        <Ionicons name="person-circle" size={60} color="#2196F3" />
                        <View style={styles.accountDetails}>
                            <Text style={styles.accountName}>Usuario</Text>
                            <Text style={styles.accountEmail}>{auth.currentUser?.email}</Text>
                        </View>
                    </View>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notificaciones</Text>
                <View style={styles.card}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="notifications" size={24} color="#2196F3" />
                            <View style={styles.settingText}>
                                <Text style={styles.settingTitle}>Notificaciones Push</Text>
                                <Text style={styles.settingSubtitle}>Recibe alertas en tiempo real</Text>
                            </View>
                        </View>
                        <Switch
                            value={notificationsEnabled}
                            onValueChange={setNotificationsEnabled}
                            trackColor={{ false: '#ddd', true: '#90CAF9' }}
                            thumbColor={notificationsEnabled ? '#2196F3' : '#f4f3f4'}
                        />
                    </View>

                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="volume-high" size={24} color="#4CAF50" />
                            <View style={styles.settingText}>
                                <Text style={styles.settingTitle}>Sonido</Text>
                                <Text style={styles.settingSubtitle}>Alertas sonoras</Text>
                            </View>
                        </View>
                        <Switch
                            value={soundEnabled}
                            onValueChange={setSoundEnabled}
                            trackColor={{ false: '#ddd', true: '#90CAF9' }}
                            thumbColor={soundEnabled ? '#2196F3' : '#f4f3f4'}
                        />
                    </View>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Privacidad</Text>
                <View style={styles.card}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Ionicons name="location" size={24} color="#FF9800" />
                            <View style={styles.settingText}>
                                <Text style={styles.settingTitle}>Ubicación</Text>
                                <Text style={styles.settingSubtitle}>Compartir ubicación GPS</Text>
                            </View>
                        </View>
                        <Switch
                            value={locationEnabled}
                            onValueChange={setLocationEnabled}
                            trackColor={{ false: '#ddd', true: '#90CAF9' }}
                            thumbColor={locationEnabled ? '#2196F3' : '#f4f3f4'}
                        />
                    </View>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Información</Text>
                <View style={styles.card}>
                    <TouchableOpacity style={styles.menuItem}>
                        <Ionicons name="help-circle" size={24} color="#2196F3" />
                        <Text style={styles.menuText}>Ayuda y Soporte</Text>
                        <Ionicons name="chevron-forward" size={24} color="#999" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem}>
                        <Ionicons name="document-text" size={24} color="#4CAF50" />
                        <Text style={styles.menuText}>Términos y Condiciones</Text>
                        <Ionicons name="chevron-forward" size={24} color="#999" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem}>
                        <Ionicons name="shield-checkmark" size={24} color="#FF9800" />
                        <Text style={styles.menuText}>Política de Privacidad</Text>
                        <Ionicons name="chevron-forward" size={24} color="#999" />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem}>
                        <Ionicons name="information-circle" size={24} color="#9C27B0" />
                        <Text style={styles.menuText}>Acerca de FurgoKid</Text>
                        <Ionicons name="chevron-forward" size={24} color="#999" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.section}>
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Ionicons name="log-out" size={24} color="#fff" />
                    <Text style={styles.logoutText}>Cerrar Sesión</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.footer}>
                <Text style={styles.version}>Versión 1.0.0</Text>
                <Text style={styles.copyright}>FurgoKid © 2025</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    section: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    accountInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    accountDetails: {
        marginLeft: 16,
        flex: 1,
    },
    accountName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    accountEmail: {
        fontSize: 14,
        color: '#666',
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    settingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    settingText: {
        marginLeft: 16,
        flex: 1,
    },
    settingTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 2,
    },
    settingSubtitle: {
        fontSize: 14,
        color: '#666',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    menuText: {
        fontSize: 16,
        color: '#333',
        marginLeft: 16,
        flex: 1,
    },
    logoutButton: {
        backgroundColor: '#f44336',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
    },
    logoutText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    footer: {
        alignItems: 'center',
        padding: 20,
    },
    version: {
        fontSize: 14,
        color: '#999',
        marginBottom: 4,
    },
    copyright: {
        fontSize: 12,
        color: '#bbb',
    },
});
