const React = require('react');

const createBottomTabNavigator = () => ({
  Navigator: ({ children }) => React.createElement(React.Fragment, null, children),
  Screen: ({ component: Component }) => React.createElement(Component),
});

module.exports = { createBottomTabNavigator };
