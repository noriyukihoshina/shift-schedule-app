const fs = require('fs');
const { ShiftScheduler, SYMBOLS, isWorkSymbol, isHolidaySymbol } = require('../solver.js');

// 1階病棟の全スタッフデータを dump_1f.html から読み込む
const html = fs.readFileSync('dump_1f.html', 'utf8');
const inputBodyMatch = html.match(/<tbody id="inputTableBody">([\s\S]*?)<\/tbody>/);
const rows = inputBodyMatch[1].split(/<tr\b[^>]*>/).filter(r => r.includes('</td>'));

const staffList = [];
for (let s = 0; s < rows.length; s++) {
    const row = rows[s];
    const nameMatch = row.match(/class="staff-name-input"\s+value="([^"]*)"/);
    const name = nameMatch ? nameMatch[1] : `スタッフ ${s + 1}`;
    const isUnused = /class="[^"]*staff-unused-checkbox[^"]*"[^>]*checked/.test(row);
    const isChief = /class="[^"]*staff-chief-checkbox[^"]*"[^>]*checked/.test(row);
    const isSectionChief = /class="[^"]*staff-section-chief-checkbox[^"]*"[^>]*checked/.test(row);
    const can8 = /class="[^"]*staff-can8-checkbox[^"]*"[^>]*checked/.test(row);
    const canSched = /class="[^"]*staff-cansched-checkbox[^"]*"[^>]*checked/.test(row);
    const isFullTime = !(/class="[^"]*staff-parttime-checkbox[^"]*"[^>]*checked/.test(row));
    const isHalf = /class="[^"]*staff-half-checkbox[^"]*"[^>]*checked/.test(row);

    const cellRegex = /<td\b[^>]*data-d="(\d+)"[^>]*>([\s\S]*?)<\/td>/g;
    const days = new Array(28).fill('');
    let cm;
    while ((cm = cellRegex.exec(row)) !== null) {
        const d = parseInt(cm[1]);
        const content = cm[2].trim().replace(/<[^>]+>/g, '').trim();
        days[d] = content;
    }

    staffList.push({
        id: s + 1,
        name,
        isUnused,
        isChief,
        isSectionChief,
        can8,
        canSched,
        isFullTime,
        isHalf,
        days,
        prevDays: []
    });
}

// 画像1・2の希望休（8時やリフなど）を忠実に反映
staffList[1].days[3] = '上1'; // スタッフ02: 土(6/27) 上1
staffList[2].days[0] = '8時'; staffList[2].days[14] = '8時'; // スタッフ03
staffList[3].days[2] = '8時'; staffList[3].days[13] = '8時'; staffList[3].days[15] = '8時'; // スタッフ04
staffList[4].days[1] = '8時'; staffList[4].days[12] = '8時'; staffList[4].days[22] = '8時'; // スタッフ05
staffList[5].days[5] = '8時'; staffList[5].days[18] = '8時'; staffList[5].days[25] = '8時'; // スタッフ06
staffList[6].days[4] = '上1'; // スタッフ07
staffList[7].days[0] = '上1'; // スタッフ08
staffList[8].days[1] = '上1'; // スタッフ09
staffList[9].days[2] = '上1'; // スタッフ10
staffList[10].days[11] = '上2'; // スタッフ11
staffList[11].days[17] = '上2'; // スタッフ12
staffList[12].days[18] = '上2'; // スタッフ13
staffList[13].days[5] = '上1'; // スタッフ14
staffList[14].days[6] = '上1'; // スタッフ15
staffList[15].days[24] = '上2'; // スタッフ16
staffList[16].days[7] = '8時'; staffList[16].days[14] = '8時'; staffList[16].days[19] = '8時'; staffList[16].days[22] = '上2'; // スタッフ17
staffList[17].days[8] = '8時'; staffList[17].days[15] = '8時'; staffList[17].days[22] = '上2'; // スタッフ18
staffList[18].days[9] = '8時'; staffList[18].days[19] = '8時'; staffList[18].days[26] = '上2'; // スタッフ19
staffList[19].days[9] = '8時'; staffList[19].days[10] = '上2'; // スタッフ20
staffList[20].days[3] = '上1'; // スタッフ21
staffList[21].days[4] = '上1'; // スタッフ22
staffList[22].days[0] = '上1'; // スタッフ23
staffList[23].days[1] = '上1'; // スタッフ24
staffList[24].days[10] = '上2'; // スタッフ25
staffList[25].days[25] = '上2'; // スタッフ26
staffList[26].days[7] = '休'; staffList[26].days[9] = '休'; staffList[26].days[16] = '休'; staffList[26].days[25] = '上2'; // スタッフ27
staffList[27].days[7] = '上2'; // スタッフ28
staffList[28].days[11] = '上2'; // スタッフ29
staffList[29].days[17] = '上2'; // スタッフ30
staffList[30].days[18] = '上2'; // スタッフ31
staffList[31].days[24] = '上2'; // スタッフ32
staffList[32].days[24] = '上2'; // スタッフ33
staffList[33].days[26] = '上2'; // スタッフ34

// can8フラグをONにする（画像1・2の8時スタッフ）
[2, 3, 4, 5, 16, 17, 18, 19].forEach(idx => {
    staffList[idx].can8 = true;
});

// 日別オフセット（土日-2）
const dayOffsets = new Array(28).fill(0);
// 6/24水(d=0) ... 6/27土(d=3), 6/28日(d=4), 7/4土(d=10), 7/5日(d=11), 7/11土(d=17), 7/12日(d=18), 7/18土(d=24), 7/19日(d=25)
[3, 4, 10, 11, 17, 18, 24, 25].forEach(d => { dayOffsets[d] = -2; });

const dates = [];
const startDate = new Date('2026-06-24T00:00:00');
for (let d = 0; d < 28; d++) {
    const dt = new Date(startDate);
    dt.setDate(dt.getDate() + d);
    const wIdx = (dt.getDay() + 6) % 7;
    dates.push({
        dateStr: dt.toISOString().split('T')[0],
        wIdx,
        isSun: wIdx === 6,
        isSat: wIdx === 5,
        isHoliday: false
    });
}

const scheduler = new ShiftScheduler(staffList, {
    standardHolidays: 8.0,
    dates: dates,
    dayOffsets: dayOffsets,
    isST: false,
    isSouth: false,
    isLife: false
});

console.time('solveBaseSchedule');
const res = scheduler.solveBaseSchedule({ force: true });
console.timeEnd('solveBaseSchedule');

console.log('Solve success:', res.success);
if (res.grid) {
    [15, 20, 27, 28, 29].forEach(sIdx => {
        const row = res.grid[sIdx];
        let off = 0;
        let single = 0;
        for (let d = 0; d < 28; d++) {
            if (row[d].symbol === '休') off++;
            if (isWorkSymbol(row[d].symbol)) {
                const p = (d > 0) ? row[d - 1].symbol : '';
                const n = (d < 27) ? row[d + 1].symbol : '';
                if (isHolidaySymbol(p) && isHolidaySymbol(n)) single++;
            }
        }
        console.log(`Staff ${staffList[sIdx].name}: off=${off}, single=${single}`);
        console.log('Symbols:', row.map(c => c.symbol).join(','));
    });
}
