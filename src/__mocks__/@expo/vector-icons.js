const React = require('react');
const { Text } = require('react-native');

const Ionicons = ({ name, size, color, testID }) =>
  React.createElement(Text, { testID: testID ?? `icon-${name}` }, name);

module.exports = { Ionicons };
module.exports.default = Ionicons;
