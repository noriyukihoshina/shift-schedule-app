const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const target = `                    if (sym === '休') stOffCount++;
                    else if (sym === '有') stPaidCount++;
                    else if (sym && sym.includes('リフ')) stRefCount++;
                    else if (sym === '早') { stEarlyCount++; stWorkCount += 1; }
                    else if (isWorkSymbol(sym)) { stWorkCount += 1; }`;

const replacement = `                    if (sym === '休') stOffCount++;
                    else if (sym === '有') stPaidCount++;
                    else if (isRefreshHolidaySymbol(sym)) stRefCount++;
                    else if (sym === '早') { stEarlyCount++; stWorkCount += 1; }
                    else if (isWorkSymbol(sym)) { stWorkCount += 1; }`;

code = code.replace(/\r\n/g, '\n');
const normT = target.replace(/\r\n/g, '\n');
const normR = replacement.replace(/\r\n/g, '\n');

if (code.includes(normT)) {
    code = code.replace(normT, normR);
    console.log('✅ Replaced stRefCount check in app.js');
} else {
    console.error('❌ Target not found in app.js');
}

fs.writeFileSync('app.js', code, 'utf8');
