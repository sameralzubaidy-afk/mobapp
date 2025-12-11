const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const hasNpmLock = fs.existsSync(path.join(root, 'package-lock.json'));
const hasYarnLock = fs.existsSync(path.join(root, 'yarn.lock'));

if (hasNpmLock && hasYarnLock) {
  console.warn('WARNING: Both package-lock.json and yarn.lock exist. Choose one package manager and delete the other.');
  process.exitCode = 1;
} else if (!hasNpmLock && !hasYarnLock) {
  console.warn('No lockfile detected. Run `npm install` or `yarn install` to generate one.');
  process.exitCode = 1;
} else {
  console.log('Lockfile check OK.');
}
