// Smart Banner Component - Banner inteligente con auto-refresh
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { getBannerAdUnitId } from '@/src/services/adMobService';

interface SmartBannerProps {
    size?: BannerAdSize;
    position?: 'top' | 'bottom';
    enabled?: boolean;
}

export const SmartBanner: React.FC<SmartBannerProps> = ({
    size = BannerAdSize.BANNER,
    position = 'bottom',
    enabled = true,
}) => {
    const [adUnitId, setAdUnitId] = useState<string>('');

    useEffect(() => {
        const platform = Platform.OS as 'android' | 'ios';
        setAdUnitId(getBannerAdUnitId(platform));
    }, []);

    if (!enabled || !adUnitId) {
        return null;
    }

    const containerStyle = position === 'top' ? styles.topContainer : styles.bottomContainer;

    return (
        <View style={[styles.container, containerStyle]}>
            <BannerAd
                unitId={adUnitId}
                size={size}
                requestOptions={{
                    requestNonPersonalizedAdsOnly: false,
                }}
                onAdLoaded={() => {
                    console.log('✅ Banner ad loaded');
                }}
                onAdFailedToLoad={(error) => {
                    console.log('❌ Banner ad failed to load:', error);
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
    },
    topContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
    },
    bottomContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
    },
});
