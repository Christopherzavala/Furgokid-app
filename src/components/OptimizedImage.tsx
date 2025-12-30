/**
 * Image Optimization Utility
 * Wrapper around react-native-fast-image for optimized image loading
 */

import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import FastImage, { FastImageProps, Priority } from 'react-native-fast-image';

interface OptimizedImageProps extends Omit<FastImageProps, 'source'> {
  uri: string;
  fallbackUri?: string;
  priority?: Priority;
  cache?: 'immutable' | 'web' | 'cacheOnly';
  showLoader?: boolean;
}

/**
 * Optimized Image component with caching and placeholder support
 *
 * @example
 * <OptimizedImage
 *   uri="https://example.com/image.jpg"
 *   style={{ width: 200, height: 200 }}
 *   priority="high"
 * />
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  uri,
  fallbackUri,
  priority = 'normal',
  cache = 'immutable',
  showLoader = true,
  style,
  ...props
}) => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const imageSource = React.useMemo(() => {
    const finalUri = error && fallbackUri ? fallbackUri : uri;
    return {
      uri: finalUri,
      priority: FastImage.priority[priority],
      cache: FastImage.cacheControl[cache],
    };
  }, [uri, fallbackUri, error, priority, cache]);

  return (
    <View style={[styles.container, style]}>
      <FastImage
        {...props}
        source={imageSource}
        style={[styles.image, style]}
        onLoadStart={() => setLoading(true)}
        onLoad={() => setLoading(false)}
        onError={() => {
          setError(true);
          setLoading(false);
        }}
        resizeMode={props.resizeMode || FastImage.resizeMode.cover}
      />
      {loading && showLoader && (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="small" color="#2196F3" />
        </View>
      )}
    </View>
  );
};

/**
 * Avatar component with circular crop and fallback
 */
export const OptimizedAvatar: React.FC<{
  uri?: string;
  size?: number;
  fallbackUri?: string;
}> = ({ uri, size = 50, fallbackUri = 'https://via.placeholder.com/150' }) => {
  return (
    <OptimizedImage
      uri={uri || fallbackUri}
      fallbackUri={fallbackUri}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
      }}
      priority="high"
    />
  );
};

/**
 * Preload images for better UX
 * Call this for images that will be shown soon
 */
export const preloadImages = (uris: string[]) => {
  const sources = uris.map((uri) => ({
    uri,
    priority: FastImage.priority.high,
  }));
  FastImage.preload(sources);
};

/**
 * Clear image cache (useful for logout or memory management)
 */
export const clearImageCache = async () => {
  await FastImage.clearMemoryCache();
  await FastImage.clearDiskCache();
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loaderContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
});
