const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

// 正しい式:
// JS呼び出し: ${makeWorkCountFormula(`INDIRECT("${col}\\$${stStartRow}:${col}"&(ROW()-7))`)}
// その後ろに Excelの閉じ括弧: )
// テンプレートリテラル全体:
// `=IF((ROW()-7)<${stStartRow},0,${makeWorkCountFormula(`INDIRECT("${col}\\$${stStartRow}:${col}"&(ROW()-7))`)} )`
const expectedLine = '            const fSt = `=IF((ROW()-7)<${stStartRow},0,${makeWorkCountFormula(`INDIRECT("${col}\\$${stStartRow}:${col}"&(ROW()-7))`)} )`;';

const regex = /\s*const fSt = `=\s*IF\(\(ROW\(\)-7\)<.*?;\r?\n/;
content = content.replace(regex, () => '\r\n' + expectedLine + '\r\n');

fs.writeFileSync(appJsPath, content, 'utf8');
console.log('SUCCESS: Fixed fSt formula line in app.js!');
