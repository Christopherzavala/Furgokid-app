// NotificationService.js - Push Notifications Management
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { doc, updateDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '../config/firebase';
import analyticsService from './analyticsService';

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

      console.log('✅ Push token obtained:', this.token);

      // Save token to Firestore user profile
      if (userId) {
        await updateDoc(doc(db, 'users', userId), {
          pushToken: this.token,
          pushTokenUpdatedAt: new Date(),
          platform: Platform.OS,
        });
        console.log('✅ Push token saved to Firestore');
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

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('✅ All notifications canceled');
  }

  /**
   * Set up listeners for notifications
   * @param {function} onNotificationReceived - Called when notification is received (foreground)
   * @param {function} onNotificationTapped - Called when notification is tapped
   */
  setupListeners(onNotificationReceived, onNotificationTapped) {
    // Listener for notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener((notification) => {
      console.log('📬 Notification received:', notification);
      analyticsService.trackEvent('notification_received', {
        title: notification.request.content.title,
        type: notification.request.content.data?.type,
      });

      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    });

    // Listener for when user taps on a notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('👆 Notification tapped:', response);
      analyticsService.trackEvent('notification_tapped', {
        title: response.notification.request.content.title,
        type: response.notification.request.content.data?.type,
      });

      if (onNotificationTapped) {
        onNotificationTapped(response);
      }
    });
  }

  /**
   * Remove notification listeners (call on unmount)
   */
  removeListeners() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }

  /**
   * Get current badge count (iOS only)
   */
  async getBadgeCount() {
    return await Notifications.getBadgeCountAsync();
  }

  /**
   * Set badge count (iOS only)
   * @param {number} count
   */
  async setBadgeCount(count) {
    await Notifications.setBadgeCountAsync(count);
  }

  /**
   * Clear all delivered notifications
   */
  async dismissAllNotifications() {
    await Notifications.dismissAllNotificationsAsync();
  }
}

export default new NotificationService();
