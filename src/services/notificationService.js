// NotificationService.js - Push Notifications Management
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { httpsCallable } from 'firebase/functions';
import { Platform } from 'react-native';
import { functions } from '../config/firebase';
import analyticsService from './analyticsService';
import secureStorage from '../utils/secureStorage';

// Configure notification behavior when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

class NotificationService {
  constructor() {
    this.token = null;
    this.notificationListener = null;
    this.responseListener = null;
  }

  /**
   * Get or generate a stable persistent device ID
   */
  async getOrCreateDeviceId() {
    try {
      let deviceId = await secureStorage.getItem('furgokid_device_id');
      if (!deviceId) {
        deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
        await secureStorage.setItem('furgokid_device_id', deviceId);
      }
      return deviceId;
    } catch (err) {
      console.warn('⚠️ Error managing stable deviceId, falling back to random:', err);
      return 'dev_fallback_' + Date.now();
    }
  }

  /**
   * Request permissions and register for push notifications
   * @param {string} userId - Firebase user ID
   * @returns {string|null} - Expo push token or null if failed
   */
  async registerForPushNotifications(userId) {
    // Push notifications only work on physical devices
    if (!Device.isDevice) {
      console.warn('⚠️ Push notifications require a physical device');
      return null;
    }

    try {
      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not already granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('⚠️ Push notification permissions not granted');
        analyticsService.trackEvent('notification_permission_denied', { userId });
        return null;
      }

      // Get Expo push token
      const tokenData = await Notifications.getExpoPushTokenAsync();
      this.token = tokenData.data;

      console.log('✅ Push token obtained');

      // Register device via Cloud Function callable (secure backend registration & indexing)
      if (userId && this.token) {
        const deviceId = await this.getOrCreateDeviceId();
        const registerPushDeviceFn = httpsCallable(functions, 'registerPushDevice');
        await registerPushDeviceFn({
          expoPushToken: this.token,
          deviceId,
          platform: Platform.OS,
        });
        console.log('✅ Push device registered via Cloud Function successfully');
      }

      // Configure Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'FurgoKid Notifications',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#4ECDC4',
          sound: 'default',
          enableVibrate: true,
        });

        // High priority channel for urgent notifications
        await Notifications.setNotificationChannelAsync('urgent', {
          name: 'Urgent Notifications',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 500, 200, 500],
          lightColor: '#FF6B6B',
          sound: 'default',
          enableVibrate: true,
        });
      }

      analyticsService.trackEvent('notification_permission_granted', {
        userId,
        platform: Platform.OS,
      });

      return this.token;
    } catch (error) {
      console.error('❌ Error registering for push notifications:', error);
      analyticsService.trackAppError('notification_registration_failed', {
        message: error.message,
        userId,
      });
      return null;
    }
  }

  /**
   * Send a local notification (for testing or immediate alerts)
   * @param {string} title - Notification title
   * @param {string} body - Notification body
   * @param {object} data - Custom data payload
   * @param {number} delaySeconds - Delay before showing (0 = immediate)
   */
  async sendLocalNotification(title, body, data = {}, delaySeconds = 0) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          color: '#4ECDC4',
        },
        trigger: delaySeconds > 0 ? { seconds: delaySeconds } : null,
      });

      analyticsService.trackEvent('local_notification_sent', {
        title,
        delaySeconds,
      });
    } catch (error) {
      console.error('❌ Error sending local notification:', error);
    }
  }

  /**
   * Schedule a notification for a specific time
   * @param {string} title
   * @param {string} body
   * @param {Date} triggerDate
   * @param {object} data
   */
  async scheduleNotification(title, body, triggerDate, data = {}) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
        },
        trigger: triggerDate,
      });

      analyticsService.trackEvent('notification_scheduled', {
        title,
        scheduledFor: triggerDate.toISOString(),
      });
    } catch (error) {
      console.error('❌ Error scheduling notification:', error);
    }
  }
}

export default new NotificationService();
