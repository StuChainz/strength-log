/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@expo/vector-icons$': '<rootDir>/src/__mocks__/@expo/vector-icons.js',
    '^@expo/vector-icons/(.*)$': '<rootDir>/src/__mocks__/@expo/vector-icons.js',
    '^expo-application$': '<rootDir>/src/__mocks__/expo-application.js',
    '^expo-clipboard$': '<rootDir>/src/__mocks__/expo-clipboard.js',
    '^expo-device$': '<rootDir>/src/__mocks__/expo-device.js',
    '^@react-navigation/bottom-tabs$': '<rootDir>/src/__mocks__/@react-navigation/bottom-tabs.js',
    '^react-native-svg$': '<rootDir>/src/__mocks__/react-native-svg.js',
  },
};
