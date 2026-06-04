const { fn } = require('jest-mock');

const setStringAsync = fn().mockResolvedValue(undefined);

module.exports = {
  setStringAsync,
};
