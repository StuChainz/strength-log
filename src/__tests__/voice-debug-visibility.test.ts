import { isTypedVoiceDebugVisible } from '@/voice/debugVisibility';

describe('typed voice debug visibility', () => {
  it('is hidden in production builds', () => {
    expect(isTypedVoiceDebugVisible('production')).toBe(false);
  });

  it('can remain available in development builds', () => {
    expect(isTypedVoiceDebugVisible('development')).toBe(true);
  });
});
