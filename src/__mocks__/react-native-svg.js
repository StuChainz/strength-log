const React = require('react');
const { View } = require('react-native');

const SvgMock = ({ children, ...props }) => React.createElement(View, props, children);
const ShapeMock = ({ children, ...props }) => React.createElement(View, props, children);

module.exports = {
  __esModule: true,
  default: SvgMock,
  Ellipse: ShapeMock,
  Path: ShapeMock,
  Rect: ShapeMock,
};
