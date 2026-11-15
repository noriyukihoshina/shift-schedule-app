const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));

const oldVer = '20261115_101000';
const newVer = '20261115_131500';

let updatedCount = 0;
files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    if (content.includes(oldVer)) {
        content = content.split(oldVer).join(newVer);
        fs.writeFileSync(f, content, 'utf8');
        updatedCount++;
    }
});
console.log(`Updated ${updatedCount} HTML files to version ${newVer}`);
