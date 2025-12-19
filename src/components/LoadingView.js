import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

const LoadingView = ({ message = 'Cargando...' }) => {
    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" color="#2196F3" />
            {message && <Text style={styles.text}>{message}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 20,
    },
    text: {
        marginTop: 10,
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
});

export default LoadingView;
