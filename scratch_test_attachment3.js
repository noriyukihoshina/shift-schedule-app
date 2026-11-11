const fs = require('fs');
const solverCode = fs.readFileSync('solver.js', 'utf-8');
const vm = require('vm');
const sandbox = { console, require, module: {}, exports: {}, window: {} };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(solverCode, sandbox);

// 添付3のテストケース:
// 「休 〇 〇 有 〇 上1 〇 〇 休」
// 公休から公休の間が7日間あり、間に有休や上1があるケース
const staff = {
    id: 1,
    name: 'テストスタッフ',
    isUnused: false,
    allow6Consec: true, // 6連勤可フラグがONでも公休間隔は最大6日以内なのでエラーになるべき！
    days: new Array(28).fill('')
};

staff.days[0] = '休';
staff.days[1] = '○';
staff.days[2] = '○';
staff.days[3] = '有';
staff.days[4] = '○';
staff.days[5] = '上1';
staff.days[6] = '○';
staff.days[7] = '○';
staff.days[8] = '休';

const validation = sandbox.validateInitialState([staff], { numDays: 28 });
console.log('Validation errors count:', validation.errors.length);
validation.errors.forEach(e => console.log('Error:', e));
console.log('Conflict cells count:', validation.conflictCells.length);
