const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');
indexHtml = indexHtml.replace(/v=rev\d+/g, 'v=rev36');
fs.writeFileSync(indexPath, indexHtml, 'utf8');
console.log('✅ Updated index.html cache buster to rev36');
