const fs = require('fs');
let c = fs.readFileSync('src/screens/profile/SellerProfileScreen.tsx', 'utf8');

c = c.replace("{/* \\n            {/* Active Listings Section */}/}", "{/* Active Listings Section */}");
c = c.replace(/\\{\\/\\*\\s*\\{\\/\\* Active Listings Section \\*\\/\\}\\/\\}/g, '{/* Active Listings Section */}');
c = c.replace("{/* \n            {/* Active Listings Section */}/}", "{/* Active Listings Section */}");

// Let's just find "Active Listings Section" and replace 2 lines above
const lines = c.split('\\n');
const fixedLines = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('{/* ') && lines[i+1] && lines[i+1].includes('Active Listings Section')) {
    fixedLines.push('          {/* Active Listings Section */}');
    i++;
    continue;
  }
  fixedLines.push(lines[i]);
}
fs.writeFileSync('src/screens/profile/SellerProfileScreen.tsx', fixedLines.join('\\n').replace('}/}', '}'));

