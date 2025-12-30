/**
 * Loading/Skeleton Components
 * Provides skeleton screens for better perceived performance
 */

import React from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';

const { width } = Dimensions.get('window');

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

/**
 * Basic skeleton placeholder with shimmer effect
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width: w = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const shimmerValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    shimmerAnimation.start();
    return () => shimmerAnimation.stop();
  }, []);

  const opacity = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: w,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

/**
 * Skeleton for list items
 */
export const SkeletonListItem: React.FC = () => (
  <View style={styles.listItem}>
    <Skeleton width={60} height={60} borderRadius={30} style={{ marginRight: 12 }} />
    <View style={{ flex: 1 }}>
      <Skeleton width="80%" height={16} style={{ marginBottom: 8 }} />
      <Skeleton width="60%" height={14} />
    </View>
  </View>
);

/**
 * Skeleton for card components
 */
export const SkeletonCard: React.FC = () => (
  <View style={styles.card}>
    <Skeleton width="100%" height={180} borderRadius={8} style={{ marginBottom: 12 }} />
    <Skeleton width="90%" height={20} style={{ marginBottom: 8 }} />
    <Skeleton width="70%" height={16} style={{ marginBottom: 8 }} />
    <Skeleton width="50%" height={14} />
  </View>
);

/**
 * Skeleton for user profile
 */
export const SkeletonProfile: React.FC = () => (
  <View style={styles.profile}>
    <Skeleton width={100} height={100} borderRadius={50} style={{ marginBottom: 16 }} />
    <Skeleton width={200} height={24} style={{ marginBottom: 8 }} />
    <Skeleton width={150} height={16} />
  </View>
);

/**
 * Full screen loading skeleton
 */
export const SkeletonScreen: React.FC<{ type?: 'list' | 'card' | 'profile' }> = ({
  type = 'list',
}) => {
  if (type === 'card') {
    return (
      <View style={styles.container}>
        <SkeletonCard />
        <SkeletonCard />
      </View>
    );
  }

  if (type === 'profile') {
    return (
      <View style={styles.container}>
        <SkeletonProfile />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {[...Array(6)].map((_, i) => (
        <SkeletonListItem key={i} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E1E9EE',
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  card: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  profile: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
});
