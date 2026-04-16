const fs = require('fs');
const { execSync } = require('child_process');
const files = fs.readdirSync('/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace').filter(f => f.endsWith('.zip'));
for (const file of files) {
  try {
    const out = execSync(`unzip -p "/Users/sameralzubaidi/Desktop/kids_marketplace_app/p2p-kids-marketplace/${file}" | grep -a -A 15 -B 5 "FATAL" | tail -n 30`).toString();
    if (out.trim()) {
      console.log('---', file, '---');
      console.log(out);
    }
  } catch (e) {}
}
