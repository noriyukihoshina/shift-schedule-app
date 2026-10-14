const fs = require('fs');

const path = require('path');
const appJsPath = path.join(__dirname, 'app.js');
let appJs = fs.readFileSync(appJsPath, 'utf8');

console.log('Searching for fRef in app.js:');
const matches = appJs.match(/const fRef = .*;/g);
console.log(matches);

// 該当行を確認
const target = 'const fRef = `COUNTIF(${rng},&quot;上1&quot;)+COUNTIF(${rng},&quot;上2&quot;)+COUNTIF(${rng},&quot;上3&quot;)+COUNTIF(${rng},&quot;上4&quot;)+COUNTIF(${rng},&quot;上5&quot;)+COUNTIF(${rng},&quot;下1&quot;)+COUNTIF(${rng},&quot;下2&quot;)+COUNTIF(${rng},&quot;下3&quot;))`;';
const replacement = 'const fRef = `COUNTIF(${rng},&quot;上1&quot;)+COUNTIF(${rng},&quot;上2&quot;)+COUNTIF(${rng},&quot;上3&quot;)+COUNTIF(${rng},&quot;上4&quot;)+COUNTIF(${rng},&quot;上5&quot;)+COUNTIF(${rng},&quot;下1&quot;)+COUNTIF(${rng},&quot;下2&quot;)+COUNTIF(${rng},&quot;下3&quot;)`;';

if (appJs.includes(target)) {
    console.log('FOUND exact target with typo )) ! Replacing it...');
    appJs = appJs.replace(target, replacement);
    fs.writeFileSync(appJsPath, appJs, 'utf8');
    console.log('Successfully fixed app.js!');
} else {
    console.log('Target string not found directly. Let us check matching lines.');
}
