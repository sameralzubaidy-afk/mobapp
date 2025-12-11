/**
 * Metro config override: prefer compiled module output for react-native-svg
 * Some packages publish TypeScript sources under `src/` and set `react-native` to point to `src`.
 * Metro may choose `react-native` field by default and attempt to load TS files in node_modules,
 * which can cause resolution problems. Prefer `module` (compiled ESM) for packages that publish
 * a `lib/module` output to avoid these issues.
 */
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Prefer compiled `module`/`main` fields before `react-native` so that packages like
// react-native-svg resolve compiled JS instead of TypeScript sources under `src`.
config.resolver.mainFields = ['module', 'main', 'react-native'];

// Ensure Metro resolves these extensions from node_modules as well (if needed)
config.resolver.sourceExts = Array.from(new Set([...(config.resolver.sourceExts || []), 'cjs', 'mjs', 'ts', 'tsx']));

// In some monorepo setups Metro may not resolve symlinked modules; add repo root node_modules
// to watchFolders to ensure node_modules under the project root are resolved.
config.watchFolders = Array.from(new Set([...(config.watchFolders || []), path.resolve(__dirname, '..')]));

module.exports = config;
