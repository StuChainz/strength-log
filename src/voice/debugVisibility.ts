export function isTypedVoiceDebugVisible(nodeEnv = process.env.NODE_ENV): boolean {
  return nodeEnv !== 'production';
}
