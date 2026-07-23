/**
 * Expo Config Plugin: withModularHeaders
 *
 * Adds `use_modular_headers!` to the iOS Podfile to fix the
 * "AppCheckCore depends upon GoogleUtilities and RecaptchaInterop,
 * which do not define modules" error during pod install.
 *
 * This runs after `expo prebuild` generates the ios/ folder.
 */
const { withPodfile, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

function addUseModularHeaders(podfileContent) {
  // Add use_modular_headers! inside the target block, after the target declaration
  const targetPattern = /target 'PassItUp' do/;
  if (targetPattern.test(podfileContent)) {
    return podfileContent.replace(
      targetPattern,
      `target 'PassItUp' do\n  use_modular_headers!`
    );
  }
  return podfileContent;
}

module.exports = function withModularHeaders(config) {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      if (fs.existsSync(podfilePath)) {
        let content = fs.readFileSync(podfilePath, 'utf8');
        if (!content.includes('use_modular_headers!')) {
          content = addUseModularHeaders(content);
          fs.writeFileSync(podfilePath, content, 'utf8');
          console.log('[withModularHeaders] Added use_modular_headers! to Podfile');
        }
      }
      return config;
    },
  ]);
};
