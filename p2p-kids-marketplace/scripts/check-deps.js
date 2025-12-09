#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const pkgPath = path.resolve(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const recommended = {
  'react-native': '0.81.5',
  expo: '~54.0.27',
  'react-native-screens': '~4.16.0',
  'react-native-safe-area-context': '5.6.2',
  'native-base': '3.4.28',
  '@react-navigation/native-stack': '7.8.6',
};

function check() {
  const found = {};
  Object.assign(found, pkg.dependencies || {}, pkg.devDependencies || {});

  const problems = [];

  Object.keys(recommended).forEach((name) => {
    const expected = recommended[name];
    const actual = found[name] || null;
    if (!actual) {
      problems.push({ name, reason: `missing (${expected})` });
      return;
    }
    if (actual !== expected) {
      problems.push({ name, actual, expected });
    }
  });

  if (problems.length === 0) {
    console.log('All key dependencies match recommended versions.');
    process.exit(0);
  }

  console.error('Dependency mismatches detected:');
  problems.forEach((p) => {
    if (p.reason) console.error(`  - ${p.name}: ${p.reason}`);
    else console.error(`  - ${p.name}: installed=${p.actual}, recommended=${p.expected}`);
  });
  process.exit(2);
}

check();
