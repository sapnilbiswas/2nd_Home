import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Safely lazy-load Notifications module only when NOT running inside Expo Go on Android
const getNotificationsModule = () => {
  if (isRunningInExpoGo() && Platform.OS === 'android') {
    return null;
  }
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
};

const Notifications = getNotificationsModule();

// Only initialize notification handler in standalone / development builds
if (Notifications) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (err) {
    console.warn('Notification handler init warning:', err);
  }
}

/**
 * Registers device for push notifications and saves the Expo token in profiles.push_token
 */
export const registerForPushNotifications = async (userId: string): Promise<string | null> => {
  const Notif = getNotificationsModule();
  if (!Notif) {
    console.log('[Push] Running in Expo Go: Remote push token registration bypassed');
    return null;
  }

  try {
    const { status: existingStatus } = await Notif.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notif.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return null;
    }

    // Android notification channel setup
    if (Platform.OS === 'android') {
      await Notif.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notif.AndroidImportance?.MAX ?? 5,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366F1',
      });
    }

    const tokenResponse = await Notif.getExpoPushTokenAsync();
    const token = tokenResponse?.data;

    if (token) {
      await supabase
        .from('profiles')
        .update({ push_token: token })
        .eq('id', userId);
    }

    return token;
  } catch (err) {
    console.warn('Failed to obtain push token:', err);
    return null;
  }
};

/**
 * Sends a push notification via Expo Push API (works across all platforms via HTTP REST)
 */
export const sendPushNotification = async (params: {
  pushToken: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}) => {
  if (!params.pushToken) return;

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: params.pushToken,
        title: params.title,
        body: params.body,
        data: params.data || {},
        sound: 'default',
      }),
    });

    return await response.json();
  } catch (err) {
    console.error('Error sending push notification:', err);
  }
};
