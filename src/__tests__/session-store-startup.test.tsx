import { renderHook, waitFor } from '@testing-library/react-native';
import { openDb } from '@/db/client';
import { useSessionStore } from '@/state/session.store';

jest.mock('@/db/client', () => ({
  openDb: jest.fn(),
}));

const openDbMock = openDb as jest.MockedFunction<typeof openDb>;

describe('useSessionStore startup failures', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('surfaces startup failures in development instead of staying loading', async () => {
    const error = new Error('db unavailable');
    openDbMock.mockRejectedValue(error);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useSessionStore(undefined));

    await waitFor(() => expect(result.current.phase).toBe('error'));
    expect(result.current.startupError).toBe('db unavailable');
    expect(errorSpy).toHaveBeenCalledWith('[session] Failed to start workout session', error);

    errorSpy.mockRestore();
  });
});
