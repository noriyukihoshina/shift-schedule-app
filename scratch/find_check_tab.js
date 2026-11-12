const fs = require('fs');
const text = fs.readFileSync('index.html', 'utf8');
const lines = text.split('\n');
lines.forEach((l, i) => {
    if (l.includes('id="checkTab"') || l.includes('checkTitleDisplay')) {
        console.log(`Line ${i+1}: ${l}`);
    }
});
