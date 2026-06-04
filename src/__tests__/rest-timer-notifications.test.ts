jest.mock('expo-notifications', () => ({
  AndroidImportance: { MAX: 'max' },
  PermissionStatus: {
    UNDETERMINED: 'undetermined',
    DENIED: 'denied',
    GRANTED: 'granted',
  },
  SchedulableTriggerInputTypes: {
    TIME_INTERVAL: 'timeInterval',
  },
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  getLastNotificationResponseAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockNotifications = require('expo-notifications') as {
  AndroidImportance: { MAX: string };
  PermissionStatus: { UNDETERMINED: string; DENIED: string; GRANTED: string };
  SchedulableTriggerInputTypes: { TIME_INTERVAL: string };
  setNotificationHandler: jest.Mock;
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  setNotificationChannelAsync: jest.Mock;
  getAllScheduledNotificationsAsync: jest.Mock;
  cancelScheduledNotificationAsync: jest.Mock;
  scheduleNotificationAsync: jest.Mock;
  getLastNotificationResponseAsync: jest.Mock;
  addNotificationResponseReceivedListener: jest.Mock;
};

/* eslint-disable @typescript-eslint/no-require-imports */
const restTimerNotifications =
  require('@/notifications/restTimerNotifications') as typeof import('@/notifications/restTimerNotifications');
/* eslint-enable @typescript-eslint/no-require-imports */

const {
  cancelRestTimerNotification,
  registerRestTimerNotificationNavigation,
  resetRestTimerNotificationStateForTests,
  restTimerNotificationTestIds,
  scheduleRestTimerNotification,
} = restTimerNotifications;

function restNotification(identifier: string, sessionId = 'session-1') {
  return {
    identifier,
    content: {
      data: {
        type: 'rest_timer_complete',
        sessionId,
      },
    },
  };
}

describe('rest timer notification scheduling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetRestTimerNotificationStateForTests();
    mockNotifications.getPermissionsAsync.mockResolvedValue({
      granted: true,
      status: 'granted',
    });
    mockNotifications.requestPermissionsAsync.mockResolvedValue({
      granted: true,
      status: 'granted',
    });
    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    mockNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
    mockNotifications.scheduleNotificationAsync.mockResolvedValue('notification-1');
    mockNotifications.setNotificationChannelAsync.mockResolvedValue(undefined);
    mockNotifications.getLastNotificationResponseAsync.mockResolvedValue(null);
    mockNotifications.addNotificationResponseReceivedListener.mockReturnValue({
      remove: jest.fn(),
    });
  });

  it('schedules a local notification when a rest timer starts', async () => {
    await scheduleRestTimerNotification({ durationSeconds: 90, sessionId: 'session-1' });

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      content: {
        title: 'Rest Complete',
        body: 'Ready for your next set.',
        sound: true,
        data: {
          type: restTimerNotificationTestIds.type,
          sessionId: 'session-1',
        },
      },
      trigger: {
        type: 'timeInterval',
        channelId: restTimerNotificationTestIds.channelId,
        seconds: 90,
        repeats: false,
      },
    });
  });

  it('cancels an existing rest notification before replacing it', async () => {
    mockNotifications.scheduleNotificationAsync
      .mockResolvedValueOnce('notification-1')
      .mockResolvedValueOnce('notification-2');

    await scheduleRestTimerNotification({ durationSeconds: 60, sessionId: 'session-1' });
    await scheduleRestTimerNotification({ durationSeconds: 120, sessionId: 'session-1' });

    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'notification-1',
    );
    const cancelOrder =
      mockNotifications.cancelScheduledNotificationAsync.mock.invocationCallOrder[0];
    const secondScheduleOrder =
      mockNotifications.scheduleNotificationAsync.mock.invocationCallOrder[1];
    expect(cancelOrder).toBeLessThan(secondScheduleOrder);
  });

  it('removes the pending notification when a rest timer is cancelled', async () => {
    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      restNotification('pending-rest'),
      { identifier: 'other', content: { data: { type: 'not-rest' } } },
    ]);

    await cancelRestTimerNotification();

    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'pending-rest',
    );
  });

  it('serializes rapid starts so only the newest rest notification remains pending', async () => {
    mockNotifications.scheduleNotificationAsync
      .mockResolvedValueOnce('notification-1')
      .mockResolvedValueOnce('notification-2');

    await Promise.all([
      scheduleRestTimerNotification({ durationSeconds: 60, sessionId: 'session-1' }),
      scheduleRestTimerNotification({ durationSeconds: 90, sessionId: 'session-1' }),
    ]);

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'notification-1',
    );
    const cancelOrder =
      mockNotifications.cancelScheduledNotificationAsync.mock.invocationCallOrder[0];
    const secondScheduleOrder =
      mockNotifications.scheduleNotificationAsync.mock.invocationCallOrder[1];
    expect(cancelOrder).toBeLessThan(secondScheduleOrder);
  });

  it('gracefully skips scheduling when notification permission is denied', async () => {
    mockNotifications.getPermissionsAsync.mockResolvedValue({
      granted: false,
      status: 'denied',
    });

    await scheduleRestTimerNotification({ durationSeconds: 60, sessionId: 'session-1' });

    expect(mockNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('navigates back to LiveWorkout when the rest notification is tapped', async () => {
    const remove = jest.fn();
    const listenerRef: {
      current?: (response: {
        notification: { request: { content: { data: Record<string, unknown> } } };
      }) => void;
    } = {};
    mockNotifications.addNotificationResponseReceivedListener.mockImplementation((callback) => {
      listenerRef.current = callback;
      return { remove };
    });
    const navigationRef = {
      current: {
        isReady: () => true,
        navigate: jest.fn(),
      },
    };

    const unsubscribe = registerRestTimerNotificationNavigation(navigationRef as never);
    listenerRef.current?.({
      notification: {
        request: {
          content: {
            data: {
              type: 'rest_timer_complete',
              sessionId: 'session-1',
            },
          },
        },
      },
    });
    unsubscribe();

    expect(navigationRef.current.navigate).toHaveBeenCalledWith('LiveWorkout', {
      sessionId: 'session-1',
    });
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
