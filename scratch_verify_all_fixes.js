const fs = require('fs');
const vm = require('vm');

const solverJs = fs.readFileSync('solver.js', 'utf-8');

const sandbox = {
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
};
sandbox.window = sandbox;
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(solverJs, sandbox);

console.log('=== TEST 1: 生活期 8時可トグル遵守テスト ===');
const lifeStaff = [];
for (let i = 1; i <= 31; i++) {
    lifeStaff.push({
        id: i,
        name: `生活期スタッフ ${String(i).padStart(2, '0')}`,
        isUnused: false,
        can8: (i >= 5 && i <= 8), // スタッフ05〜08のみ8時可
        lifeSection: (i <= 20 ? '訪問' : (i <= 28 ? '通所' : 'Cl2')),
        isSatSunOff: (i <= 20),
        isSunOff: (i > 20),
        days: new Array(28).fill(''),
        prevDays: ['', '', '', '', '']
    });
}

// 2026-04-01からの28日間
const dates = [];
const start = new Date('2026-04-01T00:00:00');
for (let d = 0; d < 28; d++) {
    const dt = new Date(start);
    dt.setDate(dt.getDate() + d);
    const dayOfWeek = dt.getDay();
    dates.push({
        dateObj: dt,
        label: `${dt.getMonth() + 1}/${dt.getDate()}`,
        m: dt.getMonth() + 1,
        day: dt.getDate(),
        weekday: ['日', '月', '火', '水', '木', '金', '土'][dayOfWeek],
        wIdx: dayOfWeek === 0 ? 6 : dayOfWeek - 1,
        isHoliday: false
    });
}

const lifeSched = new sandbox.ShiftScheduler(lifeStaff, {
    dates: dates,
    isLife: true,
    standardHolidays: 8.0,
    dayOffsets: new Array(28).fill(0)
});

const lifeRes = lifeSched.solveBaseSchedule();
console.log('Life solve success:', lifeRes.success);

// 8時が割り当てられたスタッフの can8 をチェック
let invalidH8Count = 0;
for (let s = 0; s < 31; s++) {
    for (let d = 0; d < 28; d++) {
        if (lifeRes.grid[s][d].symbol === '8時') {
            if (!lifeStaff[s].can8) {
                console.error(`ERROR: Staff ${lifeStaff[s].name} has 8時 but can8 is FALSE!`);
                invalidH8Count++;
            }
        }
    }
}
if (invalidH8Count === 0) {
    console.log('SUCCESS: All 8時 duties are strictly assigned to can8===true staff only!');
}

const lifeVal = sandbox.validateScheduleGrid(lifeRes.grid, lifeStaff, {
    dates: dates,
    isLife: true,
    standardHolidays: 8.0,
    isFinal: false
});
const life8hErrors = lifeVal.errors.filter(e => e.includes('8時'));
console.log('Life 8時 validation errors count:', life8hErrors.length);
if (life8hErrors.length === 0) {
    console.log('SUCCESS: No 8時 errors in life schedule!');
} else {
    console.error('Errors found:', life8hErrors);
}

console.log('\n=== TEST 2: ST リフレッシュ休暇時の公休8日死守テスト ===');
const stStaff = [];
for (let i = 1; i <= 16; i++) {
    const s = {
        id: i,
        name: `STスタッフ ${String(i).padStart(2, '0')}`,
        isUnused: false,
        floor: (i <= 4 ? '1F' : (i <= 8 ? '2F' : (i <= 12 ? '3F' : '南'))),
        canSched: (i % 4 === 1 || i % 4 === 2),
        days: new Array(28).fill(''),
        prevDays: ['', '', '', '', '']
    };
    // スタッフ02にリフ「上1」を事前配置（5/31〜6/23タームの例）
    if (i === 2) {
        s.days[19] = '上1'; // 20日目にリフ
    }
    stStaff.push(s);
}

const stSched = new sandbox.ShiftScheduler(stStaff, {
    dates: dates,
    isST: true,
    standardHolidays: 8.0,
    dayOffsets: new Array(28).fill(0)
});

const stRes = stSched.solveBaseSchedule();
console.log('ST solve success:', stRes.success);

// スタッフ02の公休日数とリフ日数を集計
let st2Off = 0;
let st2Ref = 0;
let st2Work = 0;
for (let d = 0; d < 28; d++) {
    const sym = stRes.grid[1][d].symbol;
    if (sym === '休') st2Off++;
    else if (sym === '上1') st2Ref++;
    else st2Work++;
}
console.log(`ST Staff 02 result -> 出勤: ${st2Work}, 公休: ${st2Off}, リフ: ${st2Ref}`);

const stVal = sandbox.validateScheduleGrid(stRes.grid, stStaff, {
    dates: dates,
    isST: true,
    standardHolidays: 8.0,
    isFinal: false
});

const st2Errors = stVal.errors.filter(e => e.includes('STスタッフ 02'));
console.log('ST Staff 02 errors count:', st2Errors.length);
if (st2Off === 8 && st2Ref === 1 && st2Work === 19 && st2Errors.length === 0) {
    console.log('SUCCESS: ST Staff 02 has exactly 8 OFF, 1 REF, 19 WORK with 0 errors!');
} else {
    console.error('ST Staff 02 test failed! Errors:', st2Errors);
}
