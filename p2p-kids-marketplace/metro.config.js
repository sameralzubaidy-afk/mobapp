// Learn more https://docs.expo.io/guides/customizing-metro
const os = require('os');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

/**
 * Two Metro instances are supported side by side:
 *   - iOS     `npm run dev:ios`      -> :8081
 *   - Android `npm run dev:android`  -> :8082
 *
 * @expo/metro-config replaces Metro's cache stores with a SINGLE shared root —
 * `path.join(os.tmpdir(), 'metro-cache')` — which has no project or platform
 * component. Both instances would therefore share one cache directory, and the
 * `--clear` flag on the second one would wipe the cache the first is actively
 * using (a cold re-bundle mid-session).
 *
 * Each dev script sets EXPO_METRO_CACHE_TAG so the two sessions get independent
 * caches and `--clear` only ever clears its own. When the variable is unset
 * (QA harness, a bare `expo start`) Expo's stock behaviour is untouched.
 */
const cacheTag = process.env.EXPO_METRO_CACHE_TAG;

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

if (cacheTag) {
  let FileStore = null;
  for (const moduleId of ['@expo/metro/metro-cache', 'metro-cache']) {
    try {
      FileStore = require(moduleId).FileStore;
      break;
    } catch {
      // try the next candidate
    }
  }

  if (FileStore) {
    config.cacheStores = [
      new FileStore({ root: path.join(os.tmpdir(), `metro-cache-${cacheTag}`) }),
    ];
  } else {
    console.warn(
      '[metro.config] Could not resolve a metro-cache FileStore — falling back to ' +
        'the shared Expo cache. Running two Metro instances at once is not isolated.'
    );
  }
}

module.exports = config;
