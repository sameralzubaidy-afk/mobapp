const fs = require('fs');
const path = '/Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts/re-desing/figma-agent-prompts.md';
let content = fs.readFileSync(path, 'utf8');

const standardRules = `
- Prototype Configuration: Use "Smart Animate" for transitions (300ms ease-in-out)
- Prototype Configuration: Configure overflow scrolling for long content areas
- Prototype Configuration: Add bottom tab bar navigation to all applicable screens
- Prototype Configuration: Link all modal overlays to dismiss on background tap
- Prototype Configuration: Configure keyboard navigation for form flows`;

if (!content.includes('300ms ease-in-out')) {
    let replacedCount = 0;
    content = content.replace(/FIGMA-SPECIFIC REQUIREMENTS:/g, () => {
        replacedCount++;
        return "FIGMA-SPECIFIC REQUIREMENTS:\n" + standardRules;
    });
    
    fs.writeFileSync(path, content);
    console.log(`Successfully injected prototype rules into ${replacedCount} sections.`);
} else {
    console.log('Rules already appear to be injected.');
}
