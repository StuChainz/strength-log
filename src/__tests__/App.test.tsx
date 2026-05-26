import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import App from '../../App';
import { openDb } from '@/db/client';

jest.mock('@react-navigation/native', () => ({
  DarkTheme: { colors: {} },
  NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('expo-status-bar', () => ({
  StatusBar: () => null,
}));

jest.mock('@/navigation/RootNavigator', () => ({
  RootNavigator: () => null,
}));

jest.mock('@/db/client', () => ({
  openDb: jest.fn(),
}));

const openDbMock = openDb as jest.MockedFunction<typeof openDb>;

describe('App startup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a development-visible startup database error', async () => {
    const error = new Error('migration failed');
    openDbMock.mockRejectedValue(error);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { getByTestId, getByText } = render(<App />);

    await waitFor(() => expect(getByTestId('app-startup-error')).toBeTruthy());
    expect(getByText('Database startup failed: migration failed')).toBeTruthy();
    expect(errorSpy).toHaveBeenCalledWith('[db] openDb startup failed', error);

    errorSpy.mockRestore();
  });
});
