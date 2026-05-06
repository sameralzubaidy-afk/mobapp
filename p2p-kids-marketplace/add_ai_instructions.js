const fs = require('fs');
const path = '/Users/sameralzubaidi/Desktop/kids_marketplace_app/Prompts/re-desing/figma-agent-prompts.md';
let content = fs.readFileSync(path, 'utf8');

const aiRules = `
- AI Empowerment: Treat these requirements as a starting point. Please provide suggestions for UI/UX improvements, alternative screen layouts, or propose new screens if they create a more ideal user experience.
- AI Collaboration: Please ask clarification questions or push back on any requirements that do not make structural or UX sense.
- Dependencies: Call out any design or flow dependencies you encounter while reading the prompts.
- Recommendations: For any questions or pushback, please provide your specific recommendations for how to proceed.`;

if (!content.includes('AI Empowerment:')) {
    let replacedCount = 0;
    content = content.replace(/FIGMA-SPECIFIC REQUIREMENTS:/g, () => {
        replacedCount++;
        return "FIGMA-SPECIFIC REQUIREMENTS:\n" + aiRules;
    });
    
    fs.writeFileSync(path, content);
    console.log(`Successfully injected AI agent instructions into ${replacedCount} sections.`);
} else {
    console.log('AI rules already appear to be injected.');
}
