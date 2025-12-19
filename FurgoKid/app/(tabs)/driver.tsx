import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function DriverScreen() {
    const driverInfo = {
        name: 'Juan Pérez',
        phone: '+56 9 1234 5678',
        license: 'A-1234567',
        vehicle: {
            brand: 'Mercedes-Benz',
            model: 'Sprinter',
            plate: 'ABC-123',
            year: '2022',
            capacity: '20 pasajeros',
        },
    };

    const handleCall = () => {
        Linking.openURL(`tel:${driverInfo.phone}`);
    };

    const handleWhatsApp = () => {
        const phoneNumber = driverInfo.phone.replace(/\s/g, '');
        Linking.openURL(`whatsapp://send?phone=${phoneNumber}`);
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={60} color="#2196F3" />
                </View>
                <Text style={styles.driverName}>{driverInfo.name}</Text>
                <Text style={styles.driverLicense}>Licencia: {driverInfo.license}</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Contacto</Text>
                <View style={styles.card}>
                    <View style={styles.contactRow}>
                        <Ionicons name="call" size={24} color="#2196F3" />
                        <Text style={styles.contactText}>{driverInfo.phone}</Text>
                    </View>
                    <View style={styles.buttonRow}>
                        <TouchableOpacity style={styles.contactButton} onPress={handleCall}>
                            <Ionicons name="call" size={20} color="#fff" />
                            <Text style={styles.contactButtonText}>Llamar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.contactButton, styles.whatsappButton]}
                            onPress={handleWhatsApp}
                        >
                            <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                            <Text style={styles.contactButtonText}>WhatsApp</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Información del Vehículo</Text>
                <View style={styles.card}>
                    <View style={styles.infoRow}>
                        <Ionicons name="car" size={24} color="#2196F3" />
                        <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>Marca y Modelo</Text>
                            <Text style={styles.infoValue}>
                                {driverInfo.vehicle.brand} {driverInfo.vehicle.model}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="document-text" size={24} color="#4CAF50" />
                        <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>Patente</Text>
                            <Text style={styles.infoValue}>{driverInfo.vehicle.plate}</Text>
                        </View>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="calendar" size={24} color="#FF9800" />
                        <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>Año</Text>
                            <Text style={styles.infoValue}>{driverInfo.vehicle.year}</Text>
                        </View>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="people" size={24} color="#9C27B0" />
                        <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>Capacidad</Text>
                            <Text style={styles.infoValue}>{driverInfo.vehicle.capacity}</Text>
                        </View>
                    </View>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Seguridad</Text>
                <View style={styles.card}>
                    <View style={styles.safetyItem}>
                        <Ionicons name="shield-checkmark" size={24} color="#4CAF50" />
                        <Text style={styles.safetyText}>Conductor verificado</Text>
                    </View>
                    <View style={styles.safetyItem}>
                        <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                        <Text style={styles.safetyText}>Licencia vigente</Text>
                    </View>
                    <View style={styles.safetyItem}>
                        <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                        <Text style={styles.safetyText}>Vehículo con revisión técnica</Text>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        backgroundColor: '#fff',
        padding: 24,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    avatarPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#E3F2FD',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    driverName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    driverLicense: {
        fontSize: 14,
        color: '#666',
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
    contactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    contactText: {
        fontSize: 18,
        color: '#333',
        marginLeft: 12,
        fontWeight: '500',
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
    },
    contactButton: {
        flex: 1,
        backgroundColor: '#2196F3',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
    },
    whatsappButton: {
        backgroundColor: '#25D366',
    },
    contactButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 6,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    infoContent: {
        marginLeft: 16,
        flex: 1,
    },
    infoLabel: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    safetyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    safetyText: {
        fontSize: 16,
        color: '#333',
        marginLeft: 12,
    },
});
