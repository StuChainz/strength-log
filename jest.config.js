/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: {
    '^@expo/vector-icons$': '<rootDir>/src/__mocks__/@expo/vector-icons.js',
    '^@expo/vector-icons/(.*)$': '<rootDir>/src/__mocks__/@expo/vector-icons.js',
    '^@react-navigation/bottom-tabs$': '<rootDir>/src/__mocks__/@react-navigation/bottom-tabs.js',
  },
};
