const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Expo SDK 56 Metro web bootstraps with __loadBundleAsync using lazy=true +
// transform.routerRoot=app. Without expo-router's app/ dir that endpoint
// returns an HTML error page instead of JS. Rewrite lazy=true → lazy=false so
// the working non-lazy bundle endpoint is used instead.
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      if (req.url && req.url.includes('lazy=true')) {
        req.url = req.url.replace(/lazy=true/g, 'lazy=false');
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;
