module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Note: react-native-reanimated plugin will be added when that package is installed
    // for e2e tests and animations. For now, excluded to avoid build errors.
  };
};
