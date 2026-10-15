// fix_solver_fractional_target.js
const fs = require('fs');
const path = require('path');

const solverPath = path.join(__dirname, 'solver.js');
let code = fs.readFileSync(solverPath, 'utf8');

const pTarget = /if\s*\(Math\.abs\(currentOff\s*-\s*targetOff\)\s*<\s*0\.01\s*&&\s*self\.verifyStaffSchedule\(s,\s*gridSymbols,\s*maxConsec\)\)\s*\{\r?\n\s+bestSchedule\s*=\s*gridSymbols;\r?\n\s+\}/;

const replacementStr = `const isFractionalTarget = Math.abs(targetOff - Math.round(targetOff)) > 0.01;
                    const offMatches = isFractionalTarget
                        ? (Math.abs(currentOff - targetOff) <= 0.51)
                        : (Math.abs(currentOff - targetOff) < 0.01);

                    if (offMatches && self.verifyStaffSchedule(s, gridSymbols, maxConsec)) {
                        bestSchedule = gridSymbols;
                    }`;

if (!pTarget.test(code)) {
    console.error('Target string not found via regex!');
    process.exit(1);
}

code = code.replace(pTarget, replacementStr);
fs.writeFileSync(solverPath, code, 'utf8');
console.log('SUCCESS: fixed solver fractional targetOff matching!');
