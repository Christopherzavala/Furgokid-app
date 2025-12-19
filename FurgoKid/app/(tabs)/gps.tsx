import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function GPSScreen() {
    return (
        <ScrollView style={styles.container}>
            <View style={styles.mapPlaceholder}>
                <Ionicons name="map" size={64} color="#2196F3" />
                <Text style={styles.mapText}>Mapa GPS</Text>
                <Text style={styles.mapSubtext}>Integración de mapa en desarrollo</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Ubicación Actual</Text>
                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Ionicons name="location" size={24} color="#2196F3" />
                        <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>Dirección</Text>
                            <Text style={styles.infoValue}>Av. Principal 123, Ciudad</Text>
                        </View>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="speedometer" size={24} color="#4CAF50" />
                        <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>Velocidad</Text>
                            <Text style={styles.infoValue}>45 km/h</Text>
                        </View>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="time" size={24} color="#FF9800" />
                        <View style={styles.infoContent}>
                            <Text style={styles.infoLabel}>Última actualización</Text>
                            <Text style={styles.infoValue}>Hace 2 minutos</Text>
                        </View>
                    </View>
                </View>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Acciones</Text>
                <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="refresh" size={24} color="#fff" />
                    <Text style={styles.actionButtonText}>Actualizar Ubicación</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]}>
                    <Ionicons name="navigate" size={24} color="#2196F3" />
                    <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>
                        Abrir en Google Maps
                    </Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    mapPlaceholder: {
        height: 300,
        backgroundColor: '#E3F2FD',
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    mapText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#2196F3',
        marginTop: 12,
    },
    mapSubtext: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
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
    infoCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
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
    actionButton: {
        backgroundColor: '#2196F3',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    actionButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    secondaryButton: {
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#2196F3',
    },
    secondaryButtonText: {
        color: '#2196F3',
    },
});
