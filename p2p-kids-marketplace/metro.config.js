const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add .ttf to the list of asset extensions so Metro handles them as assets
// instead of trying to resolve them as JavaScript modules
config.resolver.assetExts = config.resolver.assetExts
  ? [...config.resolver.assetExts, 'ttf', 'otf']
  : ['ttf', 'otf'];

module.exports = config;
