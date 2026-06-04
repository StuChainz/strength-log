import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { RootStackParamList } from '@/navigation/types';
import type { NavigationContainerRef } from '@react-navigation/native';
import type { RefObject } from 'react';

const REST_NOTIFICATION_TYPE = 'rest_timer_complete';
const REST_NOTIFICATION_CHANNEL_ID = 'rest-timers';
const REST_NOTIFICATION_TITLE = 'Rest Complete';
const REST_NOTIFICATION_BODY = 'Ready for your next set.';

let activeRestNotificationId: string | null = null;
let operationChain: Promise<void> = Promise.resolve();

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type RestNotificationData = {
  type?: unknown;
  sessionId?: unknown;
};

function isRestNotificationData(data: RestNotificationData): data is {
  type: typeof REST_NOTIFICATION_TYPE;
  sessionId: string;
} {
  return data.type === REST_NOTIFICATION_TYPE && typeof data.sessionId === 'string';
}

function queueOperation(operation: () => Promise<void>): Promise<void> {
  operationChain = operationChain.catch(() => undefined).then(operation);
  return operationChain;
}

async function ensureRestNotificationPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (existing.status !== Notifications.PermissionStatus.UNDETERMINED) return false;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

async function ensureRestNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(REST_NOTIFICATION_CHANNEL_ID, {
    name: 'Rest timers',
    importance: Notifications.AndroidImportance.MAX,
  });
}

async function cancelKnownRestNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const notificationIds = new Set<string>();

  if (activeRestNotificationId) notificationIds.add(activeRestNotificationId);
  for (const notification of scheduled) {
    const data = notification.content.data as RestNotificationData;
    if (isRestNotificationData(data)) notificationIds.add(notification.identifier);
  }

  await Promise.all(
    [...notificationIds].map((identifier) =>
      Notifications.cancelScheduledNotificationAsync(identifier),
    ),
  );
  activeRestNotificationId = null;
}

export function scheduleRestTimerNotification({
  durationSeconds,
  sessionId,
}: {
  durationSeconds: number;
  sessionId: string;
}): Promise<void> {
  return queueOperation(async () => {
    await cancelKnownRestNotifications();

    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return;
    const hasPermission = await ensureRestNotificationPermission();
    if (!hasPermission) return;

    await ensureRestNotificationChannel();
    activeRestNotificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: REST_NOTIFICATION_TITLE,
        body: REST_NOTIFICATION_BODY,
        sound: true,
        data: {
          type: REST_NOTIFICATION_TYPE,
          sessionId,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        channelId: REST_NOTIFICATION_CHANNEL_ID,
        seconds: Math.max(1, Math.floor(durationSeconds)),
        repeats: false,
      },
    });
  }).catch(() => {
    activeRestNotificationId = null;
  });
}

export function cancelRestTimerNotification(): Promise<void> {
  return queueOperation(cancelKnownRestNotifications).catch(() => {
    activeRestNotificationId = null;
  });
}

export function registerRestTimerNotificationNavigation(
  navigationRef: RefObject<NavigationContainerRef<RootStackParamList> | null>,
): () => void {
  const retryTimeouts: ReturnType<typeof setTimeout>[] = [];
  const pendingSessionId = { current: null as string | null };

  const navigateToWorkout = (sessionId: string, attemptsRemaining = 20) => {
    if (navigationRef.current?.isReady()) {
      pendingSessionId.current = null;
      navigationRef.current.navigate('LiveWorkout', { sessionId });
      return;
    }

    pendingSessionId.current = sessionId;
    if (attemptsRemaining <= 0) return;

    retryTimeouts.push(
      setTimeout(() => {
        if (pendingSessionId.current) {
          navigateToWorkout(pendingSessionId.current, attemptsRemaining - 1);
        }
      }, 50),
    );
  };

  const navigateToNotificationWorkout = (data: RestNotificationData) => {
    if (!isRestNotificationData(data)) return;
    navigateToWorkout(data.sessionId);
  };

  void Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) {
        navigateToNotificationWorkout(response.notification.request.content.data);
      }
    })
    .catch(() => {});

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    navigateToNotificationWorkout(response.notification.request.content.data);
  });

  return () => {
    retryTimeouts.forEach((timeout) => clearTimeout(timeout));
    subscription.remove();
  };
}

export const restTimerNotificationTestIds = {
  type: REST_NOTIFICATION_TYPE,
  channelId: REST_NOTIFICATION_CHANNEL_ID,
  title: REST_NOTIFICATION_TITLE,
  body: REST_NOTIFICATION_BODY,
} as const;

export function resetRestTimerNotificationStateForTests() {
  activeRestNotificationId = null;
  operationChain = Promise.resolve();
}
