const fs = require('fs');

const path = require('path');
const genPath = path.join(__dirname, 'gen_test_xlsx.js');
let genJs = fs.readFileSync(genPath, 'utf8');

const target = 'const fRef = `COUNTIF(${rng},&quot;上1&quot;)+COUNTIF(${rng},&quot;上2&quot;)+COUNTIF(${rng},&quot;上3&quot;)+COUNTIF(${rng},&quot;上4&quot;)+COUNTIF(${rng},&quot;上5&quot;)+COUNTIF(${rng},&quot;下1&quot;)+COUNTIF(${rng},&quot;下2&quot;)+COUNTIF(${rng},&quot;下3&quot;))`;';
const replacement = 'const fRef = `COUNTIF(${rng},&quot;上1&quot;)+COUNTIF(${rng},&quot;上2&quot;)+COUNTIF(${rng},&quot;上3&quot;)+COUNTIF(${rng},&quot;上4&quot;)+COUNTIF(${rng},&quot;上5&quot;)+COUNTIF(${rng},&quot;下1&quot;)+COUNTIF(${rng},&quot;下2&quot;)+COUNTIF(${rng},&quot;下3&quot;)`;';

genJs = genJs.replace(target, replacement);
fs.writeFileSync(genPath, genJs, 'utf8');
console.log('Fixed gen_test_xlsx.js!');
