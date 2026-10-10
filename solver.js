/**
 * 勤務予定表 自動作成ソルバーエンジン (solver.js)
 * 修正版:
 * 1. 事前入力希望勤務の完全ロック（手動以外で絶対変更不可）
 * 2. 有給・リフレッシュ休暇の個別カウント対応
 * 3. 「早・遅・E」は必ず休日（休/有/上/下）の前に配置
 * 4. 単発勤務の禁止はソフト制約（努力目標）へ変更
 */

// 勤務記号の定義
const SYMBOLS = {
    WORK: '○',
    OFF: '休',
    PAID: '有',
    REF_SUMMER: ['上1', '上2', '上3', '上4', '上5'],
    REF_WINTER: ['下1', '下2', '下3'],
    TRIP: '出',
    EARLY: '早',
    LATE: '遅',
    EVE: 'E',
    H8: '8時',
    // ★ 追加要件: 手当の付かない早・遅・E（ハヤ、オソ、イブ）
    NO_ALLOW_EARLY: 'ハヤ',
    NO_ALLOW_LATE: 'オソ',
    NO_ALLOW_EVE: 'イブ',
    // ★ 追加要件: 半日出勤 + 半日休日の組み合わせ（数か月に一度の希望）
    HALF_WORK_OFF: '○/休', // 半日出勤 + 半日公休
    HALF_OFF_WORK: '休/○', // 半日公休 + 半日出勤
    HALF_WORK_PAID: '○/有', // 半日出勤 + 半日有休
    HALF_PAID_WORK: '有/○'  // 半日有休 + 半日出勤
};

const HALF_DUTY_SYMBOLS = [
    SYMBOLS.HALF_WORK_OFF,
    SYMBOLS.HALF_OFF_WORK,
    SYMBOLS.HALF_WORK_PAID,
    SYMBOLS.HALF_PAID_WORK
];

// 半日勤務判定
function isHalfDuty(sym) {
    if (!sym) return false;
    return HALF_DUTY_SYMBOLS.includes(sym);
}

// 休日判定（休、有、夏リフ上1〜5、冬リフ下1〜3、または半日休）
function isHolidaySymbol(sym) {
    if (!sym) return false;
    if (sym === SYMBOLS.OFF || sym === SYMBOLS.PAID) return true;
    if (SYMBOLS.REF_SUMMER.includes(sym)) return true;
    if (SYMBOLS.REF_WINTER.includes(sym)) return true;
    return false;
}

// ★ 追加要件: 公休（休）判定。連勤の切断・リセットは「丸1日の公休（休）」のみ！
// 有休（有）やリフレッシュ休暇（上/下）は公休ではないため連勤をリセットしない！
function isFullOffSymbol(sym) {
    return sym === SYMBOLS.OFF;
}

// 勤務日判定（日勤、出張、特殊勤務、手当なし特殊勤務、および半日出勤を含む勤務）
function isWorkSymbol(sym) {
    if (!sym) return false;
    if ([SYMBOLS.WORK, '〇', '◯', SYMBOLS.TRIP, SYMBOLS.EARLY, SYMBOLS.LATE, SYMBOLS.EVE, SYMBOLS.H8, SYMBOLS.NO_ALLOW_EARLY, SYMBOLS.NO_ALLOW_LATE, SYMBOLS.NO_ALLOW_EVE].includes(sym)) return true;
    if (isHalfDuty(sym)) return true; // 半日出勤を含むため連勤カウント等の勤務日とみなす
    return false;
}

// 特殊勤務判定（翌日休日が必須となる勤務：早、遅、E、ハヤ、オソ、イブ）
function isRestrictedSpecial(sym) {
    return [SYMBOLS.EARLY, SYMBOLS.LATE, SYMBOLS.EVE, SYMBOLS.NO_ALLOW_EARLY, SYMBOLS.NO_ALLOW_LATE, SYMBOLS.NO_ALLOW_EVE].includes(sym);
}

// 日本の祝日判定
function isJapaneseHoliday(year, month, day) {
    const fixedHolidays = {
        '1-1': '元日',
        '2-11': '建国記念の日',
        '2-23': '天皇誕生日',
        '4-29': '昭和の日',
        '5-3': '憲法記念日',
        '5-4': 'みどりの日',
        '5-5': 'こどもの日',
        '8-11': '山の日',
        '11-3': '文化の日',
        '11-23': '勤労感謝の日'
    };

    const calcVernalEquinox = (y) => Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
    const calcAutumnEquinox = (y) => Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));

    const vernalDay = calcVernalEquinox(year);
    const autumnDay = calcAutumnEquinox(year);

    const getNthMonday = (y, m, n) => {
        const firstDay = new Date(y, m - 1, 1).getDay();
        const firstMonday = (1 - firstDay + 7) % 7 + 1;
        return firstMonday + (n - 1) * 7;
    };

    const adultDay = getNthMonday(year, 1, 2);
    const oceanDay = getNthMonday(year, 7, 3);
    const eldersDay = getNthMonday(year, 9, 3);
    const sportsDay = getNthMonday(year, 10, 2);

    const isBaseHoliday = (y, m, d) => {
        const key = `${m}-${d}`;
        if (fixedHolidays[key]) return true;
        if (m === 3 && d === vernalDay) return true;
        if (m === 9 && d === autumnDay) return true;
        if (m === 1 && d === adultDay) return true;
        if (m === 7 && d === oceanDay) return true;
        if (m === 9 && d === eldersDay) return true;
        if (m === 10 && d === sportsDay) return true;
        return false;
    };

    if (isBaseHoliday(year, month, day)) return true;

    // 振替休日判定
    const checkDate = new Date(year, month - 1, day);
    if (checkDate.getDay() !== 0) {
        let cur = new Date(checkDate);
        while (true) {
            cur.setDate(cur.getDate() - 1);
            const curY = cur.getFullYear();
            const curM = cur.getMonth() + 1;
            const curD = cur.getDate();
            if (isBaseHoliday(curY, curM, curD)) {
                if (cur.getDay() === 0) return true;
            } else {
                break;
            }
        }
    }

    // 国民の休日判定
    const prevDate = new Date(year, month - 1, day - 1);
    const nextDate = new Date(year, month - 1, day + 1);
    if (isBaseHoliday(prevDate.getFullYear(), prevDate.getMonth() + 1, prevDate.getDate()) &&
        isBaseHoliday(nextDate.getFullYear(), nextDate.getMonth() + 1, nextDate.getDate())) {
        return true;
    }

    return false;
}

// 日曜日〜土曜日の各週スパンを抽出するヘルパー（28日間）
function getSunToSatWeekSpans(dates, numDays = 28) {
    const weeks = [];
    let currentWeek = [];
    for (let d = 0; d < numDays; d++) {
        const isSun = (dates && dates[d]) ? (dates[d].wIdx === 6 || dates[d].weekday === '日') : (d % 7 === 6);
        if (isSun && currentWeek.length > 0) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
        currentWeek.push(d);
    }
    if (currentWeek.length > 0) {
        weeks.push(currentWeek);
    }
    return weeks;
}

/**
 * 事前入力枠のハード制約矛盾チェック (Pre-flight Validation)
 * 解なしとなる物理的矛盾を事前に検知し、具体的理由と原因セル(conflictCells)を返す
 */
function validateInitialState(staffList, options = {}) {
    const errors = [];
    const conflictCells = []; // { staffIndex, dayIndex, reason }
    const numDays = 28;
    const weekSpans = getSunToSatWeekSpans(options.dates, numDays);

    // 1. 各スタッフごとの事前入力チェック
    staffList.forEach((staff, sIdx) => {
        // A. 個別フラグ違反チェック
        for (let d = 0; d < numDays; d++) {
            const sym = staff.days[d];
            if (!sym) continue;
            const dayNum = d + 1;
            if (sym === SYMBOLS.H8 && !staff.can8) {
                errors.push(`【スタッフ No.${staff.id} ${staff.name}】${dayNum}日目に「8時」が事前入力されていますが、「8時可」フラグがOFFです。`);
                conflictCells.push({ staffIndex: sIdx, dayIndex: d, reason: `${dayNum}日目: 8時可フラグがOFFです` });
            }
            if (sym === SYMBOLS.EARLY && staff.noEarly) {
                errors.push(`【スタッフ No.${staff.id} ${staff.name}】${dayNum}日目に「早」が事前入力されていますが、「早番不可」フラグがONです。`);
                conflictCells.push({ staffIndex: sIdx, dayIndex: d, reason: `${dayNum}日目: 早番不可フラグがONです` });
            }
            if (sym === SYMBOLS.LATE && staff.noLate) {
                errors.push(`【スタッフ No.${staff.id} ${staff.name}】${dayNum}日目に「遅」が事前入力されていますが、「遅番不可」フラグがONです。`);
                conflictCells.push({ staffIndex: sIdx, dayIndex: d, reason: `${dayNum}日目: 遅番不可フラグがONです` });
            }
            if (sym === SYMBOLS.EVE && staff.noEve) {
                errors.push(`【スタッフ No.${staff.id} ${staff.name}】${dayNum}日目に「E」が事前入力されていますが、「E不可」フラグがONです。`);
                conflictCells.push({ staffIndex: sIdx, dayIndex: d, reason: `${dayNum}日目: E不可フラグがONです` });
            }
        }

        // B. 特殊勤務翌日休日チェック (早・遅・E・ハヤ・オソ・イブの翌日に勤務が入っている衝突)
        for (let d = 0; d < numDays - 1; d++) {
            const current = staff.days[d];
            const next = staff.days[d + 1];
            if (isRestrictedSpecial(current) && next && isWorkSymbol(next)) {
                errors.push(`【スタッフ No.${staff.id} ${staff.name}】${d + 1}日目の「${current}」の翌日（${d + 2}日目）に勤務（${next}）が事前入力されています（早・遅・Eは必ず休日の前）。`);
                conflictCells.push({ staffIndex: sIdx, dayIndex: d, reason: `${d + 1}日目: 翌日が勤務になっているため早・遅・Eは不可` });
                conflictCells.push({ staffIndex: sIdx, dayIndex: d + 1, reason: `${d + 2}日目: 前日が「${current}」のため休日にする必要があります` });
            }
        }

        // C. 連勤チェック (公休から公休の間のカウント。有休やリフ休は公休ではないため連勤を切断しない！)
        // ※「6連勤可」フラグがONのスタッフは最大6連勤まで許容、通常は最大5連勤
        const maxAllowedConsec = staff.allow6Consec ? 6 : 5;
        let nonOffStreak = [];
        for (let d = 0; d < numDays; d++) {
            const sym = staff.days[d];
            if (sym && !isFullOffSymbol(sym)) {
                nonOffStreak.push(d);
                if (nonOffStreak.length > maxAllowedConsec) {
                    const ruleMsg = staff.allow6Consec ? '6連勤許可ですが7日以上の連続公休なし' : '公休から公休の間は最大5日以内';
                    errors.push(`【スタッフ No.${staff.id} ${staff.name}】${d + 1}日目時点で公休のない連続期間が${nonOffStreak.length}日となっています（${ruleMsg}です）。`);
                    nonOffStreak.forEach(wDay => {
                        conflictCells.push({ staffIndex: sIdx, dayIndex: wDay, reason: `公休間隔が上限(${maxAllowedConsec}日)を超えているため公休(休)を挟んでください` });
                    });
                }
            } else if (isFullOffSymbol(sym)) {
                nonOffStreak = [];
            } else {
                nonOffStreak = [];
            }
        }

        // D. 5連勤後の2連休ルールチェック（6連勤可フラグOFFのスタッフのみ）
        if (!staff.allow6Consec) {
            const seq = [];
            for (let p = 0; p < 5; p++) seq.push(staff.prevDays[p] || '');
            for (let d = 0; d < numDays; d++) seq.push(staff.days[d] || '');

            let workStreak = 0;
            for (let idx = 0; idx < seq.length; idx++) {
                if (isWorkSymbol(seq[idx])) {
                    workStreak++;
                    if (workStreak === 5) {
                        // 5連勤直後の2日間に勤務が入っていないか検証
                        for (let offOffset = 1; offOffset <= 2; offOffset++) {
                            const checkIdx = idx + offOffset;
                            if (checkIdx < seq.length && seq[checkIdx] !== '' && isWorkSymbol(seq[checkIdx])) {
                                const targetDay = checkIdx - 4; // 1-based day index
                                if (targetDay >= 1 && targetDay <= numDays) {
                                    errors.push(`【スタッフ No.${staff.id} ${staff.name}】5連勤直後の${targetDay}日目は2連休（休・有・リフ）が必要です（現在:「${seq[checkIdx]}」）。`);
                                    conflictCells.push({ staffIndex: sIdx, dayIndex: targetDay - 1, reason: `5連勤の後は必ず2連休が必要です` });
                                }
                            }
                        }
                    }
                } else if (isHolidaySymbol(seq[idx])) {
                    workStreak = 0;
                } else {
                    workStreak = 0;
                }
            }
        }

        // E. 週（日曜日〜土曜日）出勤制限チェック（週休2日以上の保証、6連勤可フラグOFFのスタッフのみ）
        // ※出張「出」および半休「○/休」「休/○」「○/有」「有/○」はカウントから除外（ユーザー要望）
        if (!staff.allow6Consec) {
            weekSpans.forEach((wSpan, wIdx) => {
                let weekWorkCount = 0;
                const workDaysInWeek = [];
                wSpan.forEach(d => {
                    const sym = staff.days[d];
                    if (sym && isWorkSymbol(sym) && sym !== SYMBOLS.TRIP && !isHalfDuty(sym)) {
                        weekWorkCount++;
                        workDaysInWeek.push(d);
                    }
                });
                if (weekWorkCount >= 6) {
                    const sDay = wSpan[0] + 1;
                    const eDay = wSpan[wSpan.length - 1] + 1;
                    errors.push(`【スタッフ No.${staff.id} ${staff.name}】第${wIdx + 1}週（${sDay}日目〜${eDay}日目の日〜土）に出勤が${weekWorkCount}日指定されています（週休2日が必要です。出張・半休を除く）。`);
                    workDaysInWeek.forEach(d => {
                        conflictCells.push({ staffIndex: sIdx, dayIndex: d, reason: `日〜土の週に出勤が6日以上含まれるため休日を入れてください` });
                    });
                }
            });
        }
    });

    // 2. 日別の事前枠超過・希望休過多・属性別出勤可能数チェック
    for (let d = 0; d < numDays; d++) {
        const dayNum = d + 1;
        let earlyStaff = [], lateStaff = [], eveStaff = [], h8Staff = [];
        let holidayStaff = [];
        let schedAvailable = 0, roleAvailable = 0, fullTimeAvailable = 0;

        staffList.forEach((staff, sIdx) => {
            const sym = staff.days[d];
            if (sym === SYMBOLS.EARLY || sym === SYMBOLS.NO_ALLOW_EARLY) earlyStaff.push(sIdx);
            if (sym === SYMBOLS.LATE || sym === SYMBOLS.NO_ALLOW_LATE) lateStaff.push(sIdx);
            if (sym === SYMBOLS.EVE || sym === SYMBOLS.NO_ALLOW_EVE) eveStaff.push(sIdx);
            if (sym === SYMBOLS.H8) h8Staff.push(sIdx);
            if (isHolidaySymbol(sym)) {
                holidayStaff.push(sIdx);
            } else {
                // 出勤可能スタッフ
                if (staff.canSched) schedAvailable++;
                if (staff.isRole && sym !== SYMBOLS.TRIP) roleAvailable++;
                if (staff.isFullTime && sym !== SYMBOLS.TRIP) fullTimeAvailable++;
            }
        });

        if (earlyStaff.length > 3) {
            errors.push(`【${dayNum}日目】「早番」が事前入力で${earlyStaff.length}名指定されており、必要数3名を超過しています。`);
            earlyStaff.forEach(sIdx => conflictCells.push({ staffIndex: sIdx, dayIndex: d, reason: `${dayNum}日目: 早番が定員超過(4名以上)です` }));
        }
        if (lateStaff.length > 1) {
            errors.push(`【${dayNum}日目】「遅番」が事前入力で${lateStaff.length}名指定されており、必要数1名を超過しています。`);
            lateStaff.forEach(sIdx => conflictCells.push({ staffIndex: sIdx, dayIndex: d, reason: `${dayNum}日目: 遅番が定員超過(2名以上)です` }));
        }
        if (eveStaff.length > 2) {
            errors.push(`【${dayNum}日目】「イブニング(E)」が事前入力で${eveStaff.length}名指定されており、必要数2名を超過しています。`);
            eveStaff.forEach(sIdx => conflictCells.push({ staffIndex: sIdx, dayIndex: d, reason: `${dayNum}日目: Eが定員超過(3名以上)です` }));
        }
        if (h8Staff.length > 1) {
            errors.push(`【${dayNum}日目】「8時開始」が事前入力で${h8Staff.length}名指定されており、必要数1名を超過しています。`);
            h8Staff.forEach(sIdx => conflictCells.push({ staffIndex: sIdx, dayIndex: d, reason: `${dayNum}日目: 8時開始が定員超過(2名以上)です` }));
        }

        const availableCount = staffList.length - holidayStaff.length;
        if (availableCount < 7) {
            errors.push(`【${dayNum}日目】出勤可能スタッフが${availableCount}名しかおらず、必須特殊勤務数（早3+遅1+E2+8時1=計7名）を満たせません（希望休が多すぎます）。`);
            holidayStaff.forEach(sIdx => {
                conflictCells.push({ staffIndex: sIdx, dayIndex: d, reason: `${dayNum}日目: 希望休が多すぎます。出勤に変更可能なスタッフを調整してください。` });
            });
        }

        // 属性充足チェック（事前希望の重複で物理的に不足する場合）
        const totalSched = staffList.filter(s => s.canSched).length;
        if (totalSched >= 2 && schedAvailable < 2) {
            errors.push(`【${dayNum}日目】「スケ可」スタッフの出勤可能人数が${schedAvailable}名しかおらず、必要数（2名以上）を満たせません（スケ可スタッフの希望休重複をご確認ください）。`);
        }
        const totalRole = staffList.filter(s => s.isRole).length;
        if (totalRole >= 2 && roleAvailable < 2) {
            errors.push(`【${dayNum}日目】「役職」スタッフの出勤可能人数が${roleAvailable}名しかおらず、必要数（2名以上）を満たせません（役職スタッフの希望休重複をご確認ください）。`);
        }
        const totalFullTime = staffList.filter(s => s.isFullTime).length;
        if (totalFullTime >= 3 && fullTimeAvailable < 3) {
            errors.push(`【${dayNum}日目】「専従」スタッフの出勤可能人数が${fullTimeAvailable}名しかおらず、必要数（3名以上）を満たせません（専従スタッフの希望休重複をご確認ください）。`);
        }
    }

    return { errors, conflictCells };
}

/**
 * シフトスケジューラー
 */
class ShiftScheduler {
    constructor(staffList, options = {}) {
        this.staffList = JSON.parse(JSON.stringify(staffList));
        this.numStaff = this.staffList.length;
        this.numDays = 28;
        this.options = Object.assign({
            standardHolidays: 8 // 4週8休の標準公休日数
        }, options);

        this.weekSpans = getSunToSatWeekSpans(this.options.dates, this.numDays);
        this.grid = [];
        this.initGrid();
    }

    initGrid() {
        this.grid = [];
        for (let s = 0; s < this.numStaff; s++) {
            const row = [];
            const staff = this.staffList[s];
            for (let d = 0; d < this.numDays; d++) {
                const initSym = staff.days[d] || '';
                row.push({
                    symbol: initSym,
                    isFixed: initSym !== '' // 手動入力された希望勤務は完全ロック
                });
            }
            this.grid.push(row);
        }
    }

    getSymbol(s, d) {
        if (d < 0) {
            const pIdx = d + 5;
            return this.staffList[s].prevDays[pIdx] || '';
        }
        if (d >= this.numDays) return '';
        return this.grid[s][d].symbol;
    }

    setSymbol(s, d, sym, isFixed = false) {
        if (d >= 0 && d < this.numDays) {
            // isFixedセルは手動以外で変更しないようにロック
            if (this.grid[s][d].isFixed && !isFixed) {
                return; // ロックされているため上書き拒絶
            }
            this.grid[s][d].symbol = sym;
            if (isFixed) this.grid[s][d].isFixed = true;
        }
    }

    /**
     * ハード制約チェック（symをs番スタッフのd日目に配置可能か）
     */
    canAssign(s, d, sym) {
        const staff = this.staffList[s];
        const cell = this.grid[s][d];

        // 1. 固定枠（ロック）の保護
        if (cell.isFixed) {
            return cell.symbol === sym;
        }

        // 2. 個別フラグ
        if (sym === SYMBOLS.H8 && !staff.can8) return false;
        if (sym === SYMBOLS.EARLY && staff.noEarly) return false;
        if (sym === SYMBOLS.LATE && staff.noLate) return false;
        if (sym === SYMBOLS.EVE && staff.noEve) return false;

        // 3. 特殊勤務（早・遅・E・ハヤ・オソ・イブ）の配置可否判定
        if (isRestrictedSpecial(sym)) {
            // 翌日 (d+1) がすでに「勤務（○、出、8時、特殊等）」として確定している場合は不可
            if (d + 1 < this.numDays) {
                const nextCell = this.grid[s][d + 1];
                if (nextCell.symbol !== '' && isWorkSymbol(nextCell.symbol)) {
                    return false; // 翌日が既に勤務なら休みにできないため不可
                }
            }
        }

        // 前日が特殊勤務だった場合、当日は必ず休日でなければならない
        const prevSym = this.getSymbol(s, d - 1);
        if (isRestrictedSpecial(prevSym)) {
            if (!isHolidaySymbol(sym)) return false;
        }

        // 4. 連勤制限 (公休から公休の間のカウント。通常最大5連勤、allow6Consecなら最大6連勤)
        const maxAllowedConsec = staff.allow6Consec ? 6 : 5;
        if (!isFullOffSymbol(sym)) {
            // 過去方向: 直近の公休(休)までの公休なし確定日数（前タームを含む）
            let pastNonOff = 0;
            for (let i = d - 1; i >= -5; i--) {
                const ps = this.getSymbol(s, i);
                if (isFullOffSymbol(ps)) break;
                if (ps !== '') pastNonOff++;
                else break;
            }
            // 未来方向: 直近の公休(休)までの公休なし確定日数
            let futureNonOff = 0;
            for (let i = d + 1; i < this.numDays; i++) {
                const fs = this.getSymbol(s, i);
                if (isFullOffSymbol(fs)) break;
                if (fs !== '') futureNonOff++;
                else break;
            }
            if (pastNonOff + 1 + futureNonOff > maxAllowedConsec) return false;
        }

        // 5. 5連勤後の2連休ルール（allow6Consecがfalseの場合）
        if (!staff.allow6Consec && isWorkSymbol(sym)) {
            let pastWorkStreak = 0;
            for (let i = d - 1; i >= -5; i--) {
                const ps = this.getSymbol(s, i);
                if (isWorkSymbol(ps)) pastWorkStreak++;
                else break;
            }
            // もし過去で直前にすでに5連勤に達していた場合（直後1日目は勤務不可）
            if (pastWorkStreak >= 5) {
                return false;
            }
            // もし直前(d-1)が休日で、その直前の休日が1日のみ、かつその前の勤務が5連勤だった場合（直後2日目も勤務不可、2連休必須）
            if (isHolidaySymbol(this.getSymbol(s, d - 1)) && !isHolidaySymbol(this.getSymbol(s, d - 2))) {
                let streakBeforeOff = 0;
                for (let i = d - 2; i >= -5; i--) {
                    const ps = this.getSymbol(s, i);
                    if (isWorkSymbol(ps)) streakBeforeOff++;
                    else break;
                }
                if (streakBeforeOff >= 5) {
                    return false; // 5連勤の後は2連休が必須
                }
            }
            // 当日dを勤務にすることで5連勤が完成する場合
            if (pastWorkStreak === 4) {
                if (d + 1 < this.numDays && isWorkSymbol(this.getSymbol(s, d + 1))) return false;
                if (d + 2 < this.numDays && isWorkSymbol(this.getSymbol(s, d + 2))) return false;
            }
        }

        // 6. 週（日〜土）出勤制限（週休2日以上の保証、allow6Consecがfalseの場合）
        // ※出張「出」および半休「○/休」「休/○」「○/有」「有/○」はカウントから除外
        if (!staff.allow6Consec && isWorkSymbol(sym) && sym !== SYMBOLS.TRIP && !isHalfDuty(sym)) {
            const weekSpan = this.weekSpans.find(span => span.includes(d));
            if (weekSpan) {
                let weekWorkCount = 0;
                for (const wd of weekSpan) {
                    if (wd === d) continue;
                    const ws = this.getSymbol(s, wd);
                    if (ws !== '' && isWorkSymbol(ws) && ws !== SYMBOLS.TRIP && !isHalfDuty(ws)) {
                        weekWorkCount++;
                    }
                }
                if (weekWorkCount + 1 > 5) return false; // 週6勤務以上は禁止
            }
        }

        return true;
    }

    /**
     * 連勤維持可能性（先読みチェック）:
     * 特殊勤務をスタッフ s の d 日目に割り当てた場合、全期間で5連勤制約を維持するのに必要な公休数が
     * 残り利用可能公休数（8.0日または8.5日マイナス配置済み休日数）以下であるかを検証
     */
    canSustainConsecutiveWork(s, d) {
        const hols = [];

        // 前ターム末尾の最後の公休位置（-5 〜 -1、無ければ -6）
        let lastPrevHol = -6;
        for (let p = 4; p >= 0; p--) {
            if (isFullOffSymbol(this.staffList[s].prevDays[p])) {
                lastPrevHol = p - 5;
                break;
            }
        }
        hols.push(lastPrevHol);

        let curOff = 0;
        for (let day = 0; day < this.numDays; day++) {
            const sym = this.grid[s][day].symbol;
            if (isFullOffSymbol(sym)) {
                hols.push(day);
                curOff += 1.0;
            } else if (sym === SYMBOLS.HALF_WORK_OFF || sym === SYMBOLS.HALF_OFF_WORK) {
                curOff += 0.5;
            }
        }

        // もし d+1 が空欄なら、特殊勤務の翌日休（OFF）として仮定
        let willAddOff = 0;
        if (d + 1 < this.numDays && this.grid[s][d + 1].symbol === '') {
            hols.push(d + 1);
            willAddOff = 1.0;
        }

        const uniqueHols = Array.from(new Set(hols)).sort((a, b) => a - b);

        // 各区間で連勤制限（5連勤または6連勤）以内に収めるために最低限必要な休日数を計算
        const maxConsec = this.staffList[s].allow6Consec ? 6 : 5;
        const div = maxConsec + 1;
        let totalNeededHolidays = 0;
        for (let i = 0; i < uniqueHols.length - 1; i++) {
            const span = uniqueHols[i + 1] - uniqueHols[i] - 1; // 休日の間の日数
            if (span > maxConsec) {
                totalNeededHolidays += Math.floor(span / div);
            }
        }
        // 最後の休日〜最終日(day 27)の区間
        const lastHol = uniqueHols[uniqueHols.length - 1];
        const tailSpan = (this.numDays - 1) - lastHol;
        if (tailSpan > maxConsec) {
            totalNeededHolidays += Math.floor(tailSpan / div);
        }

        // 配置後の残り公休可能数
        const remainingOff = this.options.standardHolidays - (curOff + willAddOff);

        if (totalNeededHolidays > remainingOff) {
            return false;
        }

        return true;
    }

    /**
     * 当日dにスタッフsを休日にできるかの判定（属性充足の保護）
     */
    canPlaceHoliday(s, d, strictLevel = 0) {
        const staff = this.staffList[s];
        if (strictLevel >= 2) return true; // 個人制約優先（属性人数不足より公休・週休2日を最優先）

        const reqSched = strictLevel === 1 ? 2 : 3;
        const reqCan8 = strictLevel === 1 ? 1 : 2;
        const reqRole = strictLevel === 1 ? 1 : 2;
        const reqFt = strictLevel === 1 ? 2 : 3;

        // 1. スケ可保護：当日dに出勤できる「スケ可」スタッフを維持
        if (staff.canSched) {
            let available = 0;
            for (let otherS = 0; otherS < this.numStaff; otherS++) {
                if (otherS === s) continue;
                if (this.staffList[otherS].canSched && !isHolidaySymbol(this.grid[otherS][d].symbol)) {
                    available++;
                }
            }
            const totalSched = this.staffList.filter(st => st.canSched).length;
            const minKeep = Math.min(reqSched, totalSched);
            if (available < minKeep) return false;
        }
        // 1-2. 8時可保護：当日dに出勤できる「8時可」スタッフを維持
        if (staff.can8) {
            let available = 0;
            for (let otherS = 0; otherS < this.numStaff; otherS++) {
                if (otherS === s) continue;
                if (this.staffList[otherS].can8 && !isHolidaySymbol(this.grid[otherS][d].symbol)) {
                    available++;
                }
            }
            const totalCan8 = this.staffList.filter(st => st.can8).length;
            const minKeep = Math.min(reqCan8, totalCan8);
            if (available < minKeep) return false;
        }
        // 2. 役職保護：当日dに出勤できる「役職」スタッフ（出張除く）を維持
        if (staff.isRole) {
            let available = 0;
            for (let otherS = 0; otherS < this.numStaff; otherS++) {
                if (otherS === s) continue;
                if (this.staffList[otherS].isRole && !isHolidaySymbol(this.grid[otherS][d].symbol) && this.grid[otherS][d].symbol !== SYMBOLS.TRIP) {
                    available++;
                }
            }
            const totalRole = this.staffList.filter(st => st.isRole).length;
            const minKeep = Math.min(reqRole, totalRole);
            if (available < minKeep) return false;
        }
        // 3. 専従保護：当日dに出勤できる「専従」スタッフ（出張除く）を維持
        if (staff.isFullTime) {
            let available = 0;
            for (let otherS = 0; otherS < this.numStaff; otherS++) {
                if (otherS === s) continue;
                if (this.staffList[otherS].isFullTime && !isHolidaySymbol(this.grid[otherS][d].symbol) && this.grid[otherS][d].symbol !== SYMBOLS.TRIP) {
                    available++;
                }
            }
            const totalFullTime = this.staffList.filter(st => st.isFullTime).length;
            const minKeep = Math.min(reqFt, totalFullTime);
            if (available < minKeep) return false;
        }
        return true;
    }

    /**
     * 第1段階: 基本勤務表の自動生成
     * （特殊勤務の自動割り振りは行わず、希望休・公休日数・連勤・週休・属性充足を満たして空き枠を「○」で確定）
     */
    solveBaseSchedule(options = {}) {
        const force = options && options.force === true;
        // 事前バリデーション（forceでない場合のみ厳格チェック）
        if (!force) {
            const validation = validateInitialState(this.staffList, this.options);
            if (validation.errors.length > 0) {
                return {
                    success: false,
                    errors: validation.errors,
                    conflictCells: validation.conflictCells
                };
            }
        }

        // ステップ1: 事前入力されている特殊勤務（早・遅・E・ハヤ・オソ・イブ）の翌日を自動的に「休」に設定
        this.ensureHolidaysAfterPreAssignedSpecials();

        // ステップ2: 特殊勤務の自動割り当てはスキップし、休日枠（4週8休/8.5休）と属性充足・連勤制約を満たして空き枠を「○」で確定
        this.assignHolidaysAndGeneralDuties();

        // ステップ3: ソフト制約の最適化（単発勤務の解消、人数平準化）
        this.optimizeSoftConstraints();

        // 基本制約の検証
        const baseErrors = this.verifyBaseHardConstraints();
        if (baseErrors.length > 0 && !force) {
            return { success: false, errors: baseErrors };
        }

        return {
            success: true,
            grid: this.grid,
            stats: this.calculateStats()
        };
    }

    /**
     * 第2段階: 特殊勤務を入れる
     * （第1段階で組まれた基本勤務表の「○」から、早3、遅1、E2、8時1を割り振って最終完成させる）
     */
    assignSpecialDutiesToGrid(options = {}) {
        const force = options && options.force === true;

        // ステップ1: 8時勤務（1名/日）を優先配置！（8時可フラグのある貴重なスタッフから均等に選出）
        const h8Result = this.assign8ClockDuties(options);
        if (!h8Result.success && !force) {
            return h8Result;
        }

        // ステップ2: 毎日の特殊勤務（遅1, E2, 早3）を配置し、翌日を自動的に「休」に設定
        const specialResult = this.assignSpecialDuties(options);
        if (!specialResult.success && !force) {
            return specialResult;
        }

        // ステップ3: 特殊勤務を崩さず、一般勤務(○)と公休(休)のスワップで出勤人数を厳格に平準化
        this.balanceDailyWorkforce();

        // 最終全ハード制約の検証
        const finalErrors = this.verifyAllHardConstraints();
        if (finalErrors.length > 0 && !force) {
            return { success: false, errors: finalErrors };
        }

        return {
            success: true,
            grid: this.grid,
            stats: this.calculateStats()
        };
    }

    /**
     * ソルバーメイン実行（デフォルトは第1段階: 基本勤務表生成）
     */
    solve(options = {}) {
        return this.solveBaseSchedule(options);
    }

    /**
     * ステップ1: 事前に入力されている特殊勤務（早・遅・E）の翌日を自動的に休みに設定
     */
    ensureHolidaysAfterPreAssignedSpecials() {
        for (let s = 0; s < this.numStaff; s++) {
            for (let d = 0; d < this.numDays - 1; d++) {
                const sym = this.grid[s][d].symbol;
                if (isRestrictedSpecial(sym)) {
                    if (this.grid[s][d + 1].symbol === '' && !this.grid[s][d + 1].isFixed) {
                        this.setSymbol(s, d + 1, SYMBOLS.OFF, false);
                    }
                }
            }
        }
    }

    /**
     * ステップ2: 毎日の特殊勤務（遅1, E2, 早3）を割り当て、翌日を自動的に「休」に設定
     */
    /**
     * 毎日の特殊勤務（遅1, E2, 早3）を配置し、翌日を自動的に「休」に設定
     * ★要件: 出勤が公休などで挟まれ1日のみ勤務の場合は特殊勤務は入れない（8時は可能）
     */
    assignSpecialDuties(options = {}) {
        const force = options && options.force === true;
        const counts = {
            early: new Array(this.numStaff).fill(0),
            late: new Array(this.numStaff).fill(0),
            eve: new Array(this.numStaff).fill(0),
            total: new Array(this.numStaff).fill(0)
        };
        const lastDay = new Array(this.numStaff).fill(-10);

        for (let s = 0; s < this.numStaff; s++) {
            for (let d = 0; d < this.numDays; d++) {
                const sym = this.grid[s][d].symbol;
                if (sym === SYMBOLS.EARLY || sym === SYMBOLS.NO_ALLOW_EARLY) { counts.early[s]++; counts.total[s]++; lastDay[s] = Math.max(lastDay[s], d); }
                if (sym === SYMBOLS.LATE || sym === SYMBOLS.NO_ALLOW_LATE) { counts.late[s]++; counts.total[s]++; lastDay[s] = Math.max(lastDay[s], d); }
                if (sym === SYMBOLS.EVE || sym === SYMBOLS.NO_ALLOW_EVE) { counts.eve[s]++; counts.total[s]++; lastDay[s] = Math.max(lastDay[s], d); }
            }
        }

        const requirements = [
            { type: SYMBOLS.LATE, count: 1, label: '遅番', key: 'late', noFlag: 'noLate', matchSyms: [SYMBOLS.LATE, SYMBOLS.NO_ALLOW_LATE] },
            { type: SYMBOLS.EVE, count: 2, label: 'イブニング(E)', key: 'eve', noFlag: 'noEve', matchSyms: [SYMBOLS.EVE, SYMBOLS.NO_ALLOW_EVE] },
            { type: SYMBOLS.EARLY, count: 3, label: '早番', key: 'early', noFlag: 'noEarly', matchSyms: [SYMBOLS.EARLY, SYMBOLS.NO_ALLOW_EARLY] }
        ];

        for (let d = 0; d < this.numDays; d++) {
            const dayNum = d + 1;

            for (const req of requirements) {
                let assigned = 0;
                for (let s = 0; s < this.numStaff; s++) {
                    if (req.matchSyms.includes(this.grid[s][d].symbol)) assigned++;
                }

                const needed = req.count - assigned;
                if (needed <= 0) continue;

                let candidates = [];
                for (let s = 0; s < this.numStaff; s++) {
                    // 当日dが非固定の○であること
                    if (this.grid[s][d].isFixed || this.grid[s][d].symbol !== SYMBOLS.WORK) continue;

                    // 個別不可フラグ
                    if (this.staffList[s][req.noFlag]) continue;

                    // スケ可保護：このスタッフを特殊勤務にしても、当日のスケ可かつ○が2名以上残るか
                    if (this.staffList[s].canSched) {
                        let remainingSchedWork = 0;
                        for (let otherS = 0; otherS < this.numStaff; otherS++) {
                            if (otherS === s) continue;
                            if (this.staffList[otherS].canSched && this.grid[otherS][d].symbol === SYMBOLS.WORK) {
                                remainingSchedWork++;
                            }
                        }
                        if (remainingSchedWork < 2) continue;
                    }

                    // 翌日休みの検証（翌日が期間外 d == 27、または既に休日か、あるいは翌日を休日にスワップ可能か）
                    let canNextBeOff = false;
                    let swapDay = -1;

                    if (d + 1 >= this.numDays) {
                        canNextBeOff = true; // 最終日の翌日は期間外
                    } else if (isHolidaySymbol(this.grid[s][d + 1].symbol)) {
                        canNextBeOff = true; // 既に休日！公休日数も変わらないためベスト
                    } else if (!this.grid[s][d + 1].isFixed && this.grid[s][d + 1].symbol === SYMBOLS.WORK) {
                        // 翌日(d+1)を休日に変更できるか検証：
                        // もしこのスタッフがスケ可なら、翌日(d+1)のスケ可かつ○が2名以上残るかも確認
                        let schedOkNext = true;
                        if (this.staffList[s].canSched) {
                            let nextSchedWork = 0;
                            for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                if (otherS === s) continue;
                                if (this.staffList[otherS].canSched && this.grid[otherS][d + 1].symbol === SYMBOLS.WORK) {
                                    nextSchedWork++;
                                }
                            }
                            if (nextSchedWork < 2) schedOkNext = false;
                        }

                        if (schedOkNext) {
                            let canSetD1Off = this.canPlaceHoliday(s, d + 1);
                            if (canSetD1Off) {
                                // 出勤人数が少ない日（同週優先）から順にスワップ先を探索
                                const d1Week = Math.floor((d + 1) / 7);
                                const dayCandidates = [];
                                for (let candD = 0; candD < this.numDays; candD++) {
                                    if (candD === d || candD === d + 1) continue;
                                    let wCnt = 0;
                                    for (let st = 0; st < this.numStaff; st++) {
                                        if (isWorkSymbol(this.grid[st][candD].symbol)) wCnt++;
                                    }
                                    dayCandidates.push({ day: candD, count: wCnt });
                                }
                                dayCandidates.sort((a, b) => {
                                    const sameWeekA = Math.floor(a.day / 7) === d1Week ? 1 : 0;
                                    const sameWeekB = Math.floor(b.day / 7) === d1Week ? 1 : 0;
                                    if (sameWeekA !== sameWeekB) return sameWeekB - sameWeekA;
                                    return a.count - b.count;
                                });

                                for (const dObj of dayCandidates) {
                                    const otherD = dObj.day;
                                    if (!this.grid[s][otherD].isFixed && this.grid[s][otherD].symbol === SYMBOLS.OFF) {
                                        // otherD を ○ にスワップできるか一時的に試す
                                        this.setSymbol(s, otherD, SYMBOLS.WORK, false);
                                        this.setSymbol(s, d + 1, SYMBOLS.OFF, false);
                                        const valid = this.isStaffHardValid(s);
                                        // 元に戻す
                                        this.setSymbol(s, otherD, SYMBOLS.OFF, false);
                                        this.setSymbol(s, d + 1, SYMBOLS.WORK, false);

                                        if (valid) {
                                            swapDay = otherD;
                                            canNextBeOff = true;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (!canNextBeOff) continue;

                    // ★ 要件: 出勤が公休などで挟まれ1日のみ勤務の場合は特殊勤務（早・遅・E）は入れない（8時は可能）
                    // 前日(d-1)が休日か？
                    const prevIsHoliday = (d > 0) && isHolidaySymbol(this.grid[s][d - 1].symbol);
                    // 翌日(d+1)は特殊勤務割当により休日になるため、前日休日の場合は「休 - 勤務 - 休」の単発出勤となる
                    const isSandwiched = prevIsHoliday;

                    // スコア計算:
                    // 既に翌日休ならスコアを大幅優遇（スワップ不要）
                    let score = counts.total[s] * 100 + counts[req.key][s] * 10;
                    if (swapDay >= 0) {
                        score += 500; // スワップが必要な場合は優先度を下げる
                    }
                    if (this.staffList[s].canSched) {
                        score += 300; // スケ可スタッフは日勤（○）で温存するため特殊勤務への割当優先度を下げる
                    }
                    const distFromLast = d - lastDay[s];
                    if (distFromLast < 3) {
                        score += 200; // 直近の特殊勤務を避ける
                    }
                    if (isSandwiched) {
                        score += 10000; // 単発勤務は極力除外するための高ペナルティ
                    }

                    candidates.push({ staffIndex: s, score, swapDay, isSandwiched });
                }

                // 単発挟まれ勤務でない候補者を最優先で抽出
                const nonSandwichedCandidates = candidates.filter(c => !c.isSandwiched);
                if (nonSandwichedCandidates.length >= needed) {
                    candidates = nonSandwichedCandidates;
                }

                if (candidates.length < needed) {
                    if (!force) {
                        return {
                            success: false,
                            errors: [`【${dayNum}日目の特殊勤務割当】「${req.label}」の担当者が必要数（${req.count}名）に対し、配置可能なスタッフが不足しています（候補${candidates.length}名 / 不足${needed}名）。`]
                        };
                    }
                }

                candidates.sort((a, b) => a.score - b.score);
                const toAssign = Math.min(needed, candidates.length);
                for (let i = 0; i < toAssign; i++) {
                    const cand = candidates[i];
                    const chosen = cand.staffIndex;
                    this.setSymbol(chosen, d, req.type, false);

                    if (d + 1 < this.numDays) {
                        if (cand.swapDay >= 0) {
                            // スワップ実行: 翌日を休にし、swapDayを○にする
                            this.setSymbol(chosen, d + 1, SYMBOLS.OFF, false);
                            this.setSymbol(chosen, cand.swapDay, SYMBOLS.WORK, false);
                        } else if (this.grid[chosen][d + 1].symbol === '') {
                            this.setSymbol(chosen, d + 1, SYMBOLS.OFF, false);
                        }
                    }

                    counts[req.key][chosen]++;
                    counts.total[chosen]++;
                    lastDay[chosen] = d;
                }
            }
        }

        return { success: true };
    }

    /**
     * ステップ4: 各スタッフの公休枠（28日間で8.0日、3月は8.5日）を厳密に充足し、残りを「○（日勤）」で確定
     * （週単位の組合せバックトラッキング探索により、公休日数・週休2日・連勤5日以内・5連勤後2連休・属性保護を100%充足）
     */
    assignHolidaysAndGeneralDuties() {
        const stdHolidays = this.options.standardHolidays;

        for (let s = 0; s < this.numStaff; s++) {
            const staff = this.staffList[s];
            const maxConsec = staff.allow6Consec ? 6 : 5;

            // 週単位の組合せ探索で完全充足スケジュールを取得
            const solvedGrid = this.solveStaffScheduleWeekly(s, stdHolidays, maxConsec);
            if (solvedGrid) {
                for (let d = 0; d < this.numDays; d++) {
                    if (!this.grid[s][d].isFixed) {
                        this.setSymbol(s, d, solvedGrid[d], false);
                    }
                }
            } else {
                // 安全なフォールバック: 各週の未固定セルに公休を必ず割り振る（公休0日放置の完全排除）
                let curOff = 0;
                for (let d = 0; d < this.numDays; d++) {
                    if (this.grid[s][d].isFixed && isHolidaySymbol(this.grid[s][d].symbol)) curOff += 1.0;
                }
                const neededMore = Math.max(0, Math.round(stdHolidays - curOff));

                let added = 0;
                for (let w = 0; w < this.weekSpans.length && added < neededMore; w++) {
                    const wSpan = this.weekSpans[w];
                    const blanks = wSpan.filter(d => !this.grid[s][d].isFixed && this.grid[s][d].symbol === '');
                    const toAdd = Math.min(blanks.length, Math.min(neededMore - added, wSpan.length >= 6 ? 2 : 1));
                    for (let b = 0; b < toAdd; b++) {
                        this.setSymbol(s, blanks[b], SYMBOLS.OFF, false);
                        added++;
                    }
                }
                if (added < neededMore) {
                    for (let d = 0; d < this.numDays && added < neededMore; d++) {
                        if (!this.grid[s][d].isFixed && this.grid[s][d].symbol === '') {
                            this.setSymbol(s, d, SYMBOLS.OFF, false);
                            added++;
                        }
                    }
                }
                for (let d = 0; d < this.numDays; d++) {
                    if (this.grid[s][d].symbol === '') {
                        this.setSymbol(s, d, SYMBOLS.WORK, false);
                    }
                }
            }
        }
    }

    /**
     * スタッフ s のスケジュールを「週単位の休日配置バックトラッキング」で完全充足生成
     */
    solveStaffScheduleWeekly(s, targetOff, maxConsec) {
        // strictLevel: 0 (属性厳格), 1 (属性緩和), 2 (個人ハード制約最優先) で多段階試行
        for (let strictLevel = 0; strictLevel <= 2; strictLevel++) {
            const res = this.solveStaffScheduleWeeklyInternal(s, targetOff, maxConsec, strictLevel);
            if (res) return res;
        }
        return null;
    }

    solveStaffScheduleWeeklyInternal(s, targetOff, maxConsec, strictLevel) {
        const staff = this.staffList[s];
        const numDays = this.numDays;
        const weekSpans = this.weekSpans;
        const totalWeeks = weekSpans.length;
        const self = this;

        // すでに固定されている公休日数（休: 1.0, 半休: 0.5）
        let fixedPublicOff = 0;
        for (let d = 0; d < numDays; d++) {
            if (this.grid[s][d].isFixed) {
                const sym = this.grid[s][d].symbol;
                if (sym === SYMBOLS.OFF) fixedPublicOff += 1.0;
                else if (sym === SYMBOLS.HALF_WORK_OFF || sym === SYMBOLS.HALF_OFF_WORK) fixedPublicOff += 0.5;
            }
        }
        const neededOff = targetOff - fixedPublicOff;
        if (neededOff < 0) return null;

        // 各日ですでに休日（固定または他のスタッフで確定）になっている人数を集計
        const dailyOffCounts = new Array(numDays).fill(0);
        const dailyH8OffCounts = new Array(numDays).fill(0);
        const dailySchedOffCounts = new Array(numDays).fill(0);
        const dailyRoleOffCounts = new Array(numDays).fill(0);
        const dailyFullTimeOffCounts = new Array(numDays).fill(0);
        for (let otherS = 0; otherS < this.numStaff; otherS++) {
            if (otherS === s) continue;
            for (let d = 0; d < numDays; d++) {
                const sym = this.grid[otherS][d].symbol;
                if (isHolidaySymbol(sym)) {
                    dailyOffCounts[d]++;
                    if (this.staffList[otherS].can8) dailyH8OffCounts[d]++;
                    if (this.staffList[otherS].canSched) dailySchedOffCounts[d]++;
                    if (this.staffList[otherS].isRole) dailyRoleOffCounts[d]++;
                    if (this.staffList[otherS].isFullTime) dailyFullTimeOffCounts[d]++;
                }
            }
        }

        // 各週で週出勤5日以内に抑えるために最低限必要な公休日数を算出
        const maxWorkAllowed = staff.allow6Consec ? 6 : 5;
        const minNeededPerWeek = [];
        weekSpans.forEach(wSpan => {
            let fixedHolidayCount = 0;
            wSpan.forEach(d => {
                const sym = self.grid[s][d].isFixed ? self.grid[s][d].symbol : '';
                if (isHolidaySymbol(sym) || sym === SYMBOLS.TRIP || isHalfDuty(sym)) {
                    fixedHolidayCount++;
                }
            });
            const needed = Math.max(0, wSpan.length - maxWorkAllowed - fixedHolidayCount);
            minNeededPerWeek.push(needed);
        });

        // 割り当てパターンの生成 (合計が neededOff になる配分)
        const distributionPatterns = [];
        const neededTargetInt = Math.round(neededOff);

        function genDistributions(wIdx, currentPattern, currentSum) {
            if (wIdx === totalWeeks) {
                if (currentSum === neededTargetInt) {
                    distributionPatterns.push([...currentPattern]);
                }
                return;
            }
            const minW = minNeededPerWeek[wIdx];
            const maxW = Math.min(weekSpans[wIdx].length, 4);
            const remainingWeeks = totalWeeks - 1 - wIdx;
            for (let c = minW; c <= maxW; c++) {
                if (currentSum + c <= neededTargetInt + remainingWeeks * 4) {
                    currentPattern.push(c);
                    genDistributions(wIdx + 1, currentPattern, currentSum + c);
                    currentPattern.pop();
                }
            }
        }
        genDistributions(0, [], 0);

        // 均等パターン（7日の週は2日、端数週は日数相応、分散が小さいもの）を優先ソート
        distributionPatterns.sort((a, b) => {
            let varA = 0, varB = 0;
            for (let w = 0; w < totalWeeks; w++) {
                const ideal = weekSpans[w].length >= 6 ? 2 : Math.round(weekSpans[w].length * (2 / 7));
                varA += Math.pow(a[w] - ideal, 2);
                varB += Math.pow(b[w] - ideal, 2);
            }
            return varA - varB;
        });

        // 選択された休日候補のスコア計算ヘルパー
        function calcChoiceScore(days, isConsecutive = false) {
            let score = 0;
            if (isConsecutive) score += 100;

            for (const d of days) {
                const currentOff = dailyOffCounts[d];
                score -= currentOff * 15;

                if (staff.can8) score -= dailyH8OffCounts[d] * 30;
                if (staff.canSched) score -= dailySchedOffCounts[d] * 35;
                if (staff.isRole) score -= dailyRoleOffCounts[d] * 30;
                if (staff.isFullTime) score -= dailyFullTimeOffCounts[d] * 25;

                const prev = (d === 0) ? staff.prevDays[4] : self.grid[s][d - 1].symbol;
                const next = (d + 1 < numDays) ? self.grid[s][d + 1].symbol : '';
                if (isHolidaySymbol(prev)) score += 20;
                if (isHolidaySymbol(next)) score += 20;
            }
            return score;
        }

        // 週ごとの有効な休日選択肢を生成する関数
        function getWeekHolidayChoices(wIdx, countNeeded) {
            if (countNeeded === 0) return [[]];

            const wSpan = weekSpans[wIdx];
            const blankDays = wSpan.filter(d => !self.grid[s][d].isFixed && self.canPlaceHoliday(s, d, strictLevel));
            if (blankDays.length < countNeeded) return [];

            const choices = [];

            if (countNeeded === 1) {
                blankDays.forEach(d => {
                    choices.push({ days: [d], score: calcChoiceScore([d], false) });
                });
                choices.sort((a, b) => b.score - a.score);
                return choices.map(c => c.days);
            }

            if (countNeeded === 2) {
                for (let i = 0; i < blankDays.length; i++) {
                    for (let j = i + 1; j < blankDays.length; j++) {
                        const d1 = blankDays[i], d2 = blankDays[j];
                        if (d2 === d1 + 1) {
                            choices.push({ days: [d1, d2], score: calcChoiceScore([d1, d2], true) });
                        }
                    }
                }
                for (let i = 0; i < blankDays.length; i++) {
                    for (let j = i + 1; j < blankDays.length; j++) {
                        const d1 = blankDays[i], d2 = blankDays[j];
                        if (d2 !== d1 + 1) {
                            choices.push({ days: [d1, d2], score: calcChoiceScore([d1, d2], false) });
                        }
                    }
                }
                choices.sort((a, b) => b.score - a.score);
                return choices.map(c => c.days);
            }

            if (countNeeded === 3) {
                for (let i = 0; i < blankDays.length; i++) {
                    for (let j = i + 1; j < blankDays.length; j++) {
                        for (let k = j + 1; k < blankDays.length; k++) {
                            const d1 = blankDays[i], d2 = blankDays[j], d3 = blankDays[k];
                            const isConsec = (d2 === d1 + 1 && d3 === d2 + 1) || (d2 === d1 + 1) || (d3 === d2 + 1);
                            choices.push({ days: [d1, d2, d3], score: calcChoiceScore([d1, d2, d3], isConsec) });
                        }
                    }
                }
                choices.sort((a, b) => b.score - a.score);
                return choices.map(c => c.days);
            }

            if (countNeeded === 4) {
                for (let i = 0; i < blankDays.length; i++) {
                    for (let j = i + 1; j < blankDays.length; j++) {
                        for (let k = j + 1; k < blankDays.length; k++) {
                            for (let l = k + 1; l < blankDays.length; l++) {
                                const d1 = blankDays[i], d2 = blankDays[j], d3 = blankDays[k], d4 = blankDays[l];
                                const isConsec = (d2 === d1 + 1) || (d3 === d2 + 1) || (d4 === d3 + 1);
                                choices.push({ days: [d1, d2, d3, d4], score: calcChoiceScore([d1, d2, d3, d4], isConsec) });
                            }
                        }
                    }
                }
                choices.sort((a, b) => b.score - a.score);
                return choices.map(c => c.days);
            }

            return [[]];
        }

        let bestSchedule = null;

        for (const dist of distributionPatterns) {
            function searchWeek(wIdx, assignedOffDays) {
                if (bestSchedule !== null) return;

                if (wIdx === totalWeeks) {
                    const gridSymbols = new Array(numDays);
                    let currentOff = 0;
                    for (let d = 0; d < numDays; d++) {
                        if (self.grid[s][d].isFixed) {
                            gridSymbols[d] = self.grid[s][d].symbol;
                            if (gridSymbols[d] === SYMBOLS.OFF) currentOff += 1.0;
                            else if (gridSymbols[d] === SYMBOLS.HALF_WORK_OFF || gridSymbols[d] === SYMBOLS.HALF_OFF_WORK) currentOff += 0.5;
                        } else if (assignedOffDays.includes(d)) {
                            gridSymbols[d] = SYMBOLS.OFF;
                            currentOff += 1.0;
                        } else {
                            gridSymbols[d] = SYMBOLS.WORK;
                        }
                    }

                    if (Math.abs(currentOff - targetOff) < 0.01 && self.verifyStaffSchedule(s, gridSymbols, maxConsec)) {
                        bestSchedule = gridSymbols;
                    }
                    return;
                }

                const neededInThisWeek = dist[wIdx];
                const choices = getWeekHolidayChoices(wIdx, neededInThisWeek);
                for (const choice of choices) {
                    const nextAssigned = assignedOffDays.concat(choice);
                    searchWeek(wIdx + 1, nextAssigned);
                    if (bestSchedule !== null) return;
                }
            }

            searchWeek(0, []);
            if (bestSchedule !== null) break;
        }

        return bestSchedule;
    }

    /**
     * スタッフ s の生成スケジュールがハード制約を完全充足しているか検証
     */
    verifyStaffSchedule(s, gridSymbols, maxConsec) {
        const staff = this.staffList[s];
        const sequence = [];
        for (let p = 0; p < 5; p++) sequence.push(staff.prevDays[p] || '');
        for (let d = 0; d < this.numDays; d++) sequence.push(gridSymbols[d]);

        // 1. 特殊勤務翌日休制約
        for (let i = 0; i < sequence.length - 1; i++) {
            if (isRestrictedSpecial(sequence[i]) && !isHolidaySymbol(sequence[i + 1])) {
                return false;
            }
        }

        // 2. 連勤制限（公休間隔カウント）
        let consec = 0;
        for (let i = 0; i < sequence.length; i++) {
            if (sequence[i] === '') {
                consec = 0;
            } else if (!isFullOffSymbol(sequence[i])) {
                consec++;
                if (consec > maxConsec) return false;
            } else {
                consec = 0;
            }
        }

        // 3. 5連勤後の2連休制約（allow6Consec以外）
        if (!staff.allow6Consec) {
            let workStreak = 0;
            for (let i = 0; i < sequence.length; i++) {
                if (isWorkSymbol(sequence[i])) {
                    workStreak++;
                    if (workStreak === 5) {
                        for (let offOffset = 1; offOffset <= 2; offOffset++) {
                            const checkIdx = i + offOffset;
                            if (checkIdx < sequence.length) {
                                const sym = sequence[checkIdx];
                                if (sym !== '' && !isHolidaySymbol(sym)) return false;
                            }
                        }
                    }
                } else {
                    workStreak = 0;
                }
            }
        }

        // 4. 週出勤制限（日〜土）
        if (!staff.allow6Consec) {
            for (const wSpan of this.weekSpans) {
                let weekWork = 0;
                for (const d of wSpan) {
                    const sym = gridSymbols[d];
                    if (sym && isWorkSymbol(sym) && sym !== SYMBOLS.TRIP && !isHalfDuty(sym)) {
                        weekWork++;
                    }
                }
                if (weekWork > 5) return false;
            }
        }

        return true;
    }

    /**
     * ステップ2: 8時勤務（毎日1名）の配置（限定リソースを最優先で割り当て）
     */
    assign8ClockDuties(options = {}) {
        const force = options && options.force === true;
        const counts = new Array(this.numStaff).fill(0);
        const lastAssignedDay = new Array(this.numStaff).fill(-10);

        for (let s = 0; s < this.numStaff; s++) {
            for (let d = 0; d < this.numDays; d++) {
                if (this.grid[s][d].symbol === SYMBOLS.H8) {
                    counts[s]++;
                    lastAssignedDay[s] = d;
                }
            }
        }

        for (let d = 0; d < this.numDays; d++) {
            const dayNum = d + 1;
            let assigned = 0;
            for (let s = 0; s < this.numStaff; s++) {
                if (this.grid[s][d].symbol === SYMBOLS.H8) assigned++;
            }
            if (assigned >= 1) continue;

            const candidates = [];
            for (let s = 0; s < this.numStaff; s++) {
                if (!this.staffList[s].can8) continue;
                // 基本勤務表で「○」として組まれているスタッフ（未固定）
                if (this.grid[s][d].isFixed || this.grid[s][d].symbol !== SYMBOLS.WORK) continue;

                // スケ可保護：このスタッフを8時に変更しても、当日のスケ可かつ○が2名以上残るか
                if (this.staffList[s].canSched) {
                    let remainingSchedWork = 0;
                    for (let otherS = 0; otherS < this.numStaff; otherS++) {
                        if (otherS === s) continue;
                        if (this.staffList[otherS].canSched && this.grid[otherS][d].symbol === SYMBOLS.WORK) {
                            remainingSchedWork++;
                        }
                    }
                    if (remainingSchedWork < 2) continue;
                }

                // スコア: 割当回数が少ない順 + 直近に8時に入っていない順（適度にローテーション）
                let score = counts[s] * 20 - (d - lastAssignedDay[s]);
                candidates.push({ staffIndex: s, score });
            }

            if (candidates.length === 0) {
                if (!force) {
                    return {
                        success: false,
                        errors: [`【${dayNum}日目】「8時開始勤務（1名）」を配置できるスタッフがいません（8時可スタッフの勤務またはスケ可制約をご確認ください）。`]
                    };
                }
                continue;
            }

            candidates.sort((a, b) => a.score - b.score);
            const chosen = candidates[0].staffIndex;
            this.setSymbol(chosen, d, SYMBOLS.H8, false);
            counts[chosen]++;
            lastAssignedDay[chosen] = d;
        }

        return { success: true };
    }

    /**
     * ステップ5: ソフト制約の最適化
     * - 単発勤務（休 - 勤務 - 休）を極力解消（2連勤以上を目指す）
     * - 日別出勤人数の平準化
     */
    optimizeSoftConstraints() {
        // 単発勤務の解消パス（公休数を変えずに同スタッフ内の日勤・公休のスワップで解消を試みる）
        for (let s = 0; s < this.numStaff; s++) {
            for (let d = 0; d < this.numDays; d++) {
                if (this.grid[s][d].isFixed) continue;
                if (this.grid[s][d].symbol !== SYMBOLS.WORK) continue;

                const prev = this.getSymbol(s, d - 1);
                const next = this.getSymbol(s, d + 1);

                // 単発勤務（休 - ○ - 休）を発見した場合
                if (isHolidaySymbol(prev) && isHolidaySymbol(next)) {
                    // 他の日の公休（休）とスワップして2連勤を作れるか試す
                    let resolved = false;
                    for (let targetD = 0; targetD < this.numDays; targetD++) {
                        if (targetD === d || this.grid[s][targetD].isFixed) continue;
                        if (this.grid[s][targetD].symbol !== SYMBOLS.OFF) continue;

                        // targetDを○にし、dを休にするスワップ
                        this.setSymbol(s, targetD, SYMBOLS.WORK, false);
                        this.setSymbol(s, d, SYMBOLS.OFF, false);

                        if (this.isStaffHardValid(s) && this.isGlobalAttributesValid()) {
                            resolved = true;
                            break;
                        } else {
                            // ロールバック
                            this.setSymbol(s, targetD, SYMBOLS.OFF, false);
                            this.setSymbol(s, d, SYMBOLS.WORK, false);
                        }
                    }
                    if (resolved) continue;
                }
            }
        }

        // 人数平準化パス (多対多スワップ局所探索: 出勤人数の山と谷を削り、毎日34〜37名に均等化)
        this.balanceDailyWorkforce();
    }

    /**
     * 人数平準化パス (多対多スワップ局所探索: 出勤人数の山と谷を削り、毎日34〜37名に均等化)
     */
    balanceDailyWorkforce() {
        for (let iter = 0; iter < 300; iter++) {
            const daily = [];
            for (let d = 0; d < this.numDays; d++) {
                let w = 0;
                for (let s = 0; s < this.numStaff; s++) {
                    if (isWorkSymbol(this.grid[s][d].symbol)) w++;
                }
                daily.push({ day: d, count: w });
            }
            daily.sort((a, b) => b.count - a.count);

            const diff = daily[0].count - daily[daily.length - 1].count;
            // 最大と最小の差が3名以内（例: 35名と37名など）なら極めて平準化されているため完了
            if (diff <= 3) break;

            let swapped = false;

            const totalWorkDays = daily.reduce((sum, item) => sum + item.count, 0);
            const targetAvg = totalWorkDays / this.numDays;

            // 出勤が多い日（平均以上）と、出勤が少ない日（平均以下）
            const testHigh = daily.filter(item => item.count > targetAvg);
            const testLow = daily.slice().reverse().filter(item => item.count <= Math.ceil(targetAvg));

            // 上位日 × 下位日のペアを順に試行
            outerLoop:
            for (const hItem of testHigh) {
                const maxDay = hItem.day;
                const hWeek = Math.floor(maxDay / 7);

                // 同一週内の日を最優先（週休2日制約を確実に維持するため）
                const sortedLow = testLow.slice().sort((a, b) => {
                    const sameWeekA = Math.floor(a.day / 7) === hWeek ? 1 : 0;
                    const sameWeekB = Math.floor(b.day / 7) === hWeek ? 1 : 0;
                    if (sameWeekA !== sameWeekB) return sameWeekB - sameWeekA;
                    return a.count - b.count;
                });

                for (const lItem of sortedLow) {
                    const minDay = lItem.day;
                    if (maxDay === minDay) continue;

                    const curMaxCnt = daily.find(d => d.day === maxDay).count;
                    const curMinCnt = daily.find(d => d.day === minDay).count;
                    if (curMaxCnt - curMinCnt <= 1) continue;

                    // スタッフを探索
                    for (let s = 0; s < this.numStaff; s++) {
                        if (!this.grid[s][maxDay].isFixed && this.grid[s][maxDay].symbol === SYMBOLS.WORK &&
                            !this.grid[s][minDay].isFixed && this.grid[s][minDay].symbol === SYMBOLS.OFF) {

                            // 一時スワップ
                            this.setSymbol(s, maxDay, SYMBOLS.OFF, false);
                            this.setSymbol(s, minDay, SYMBOLS.WORK, false);

                            const staffValid = this.isStaffHardValid(s);
                            const globalValid = staffValid && this.isGlobalAttributesValid();

                            if (staffValid && globalValid) {
                                swapped = true;
                                break outerLoop;
                            } else {
                                // ロールバック
                                this.setSymbol(s, maxDay, SYMBOLS.WORK, false);
                                this.setSymbol(s, minDay, SYMBOLS.OFF, false);
                            }
                        }
                    }
                }
            }

            if (!swapped) {
                // これ以上改善できない極小値に達した場合は終了
                break;
            }
        }

        // 連勤違反の自動リペアパス（公休数を変えずに同スタッフ内の余剰休日とスワップ）
        for (let s = 0; s < this.numStaff; s++) {
            if (!this.isStaffHardValid(s)) {
                const sequence = [];
                for (let i = 0; i < 5; i++) sequence.push(this.staffList[s].prevDays[i] || '');
                for (let d = 0; d < this.numDays; d++) sequence.push(this.grid[s][d].symbol);

                // 6連勤（公休間隔5日超過）の区間を探索
                let consec = 0;
                let violationEnd = -1;
                for (let idx = 0; idx < sequence.length; idx++) {
                    if (!isFullOffSymbol(sequence[idx])) {
                        consec++;
                        if (consec > 5) {
                            violationEnd = idx - 5; // grid上のインデックス
                            break;
                        }
                    } else {
                        consec = 0;
                    }
                }

                if (violationEnd >= 0) {
                    // 連勤区間の中の非固定日勤セルを休日の移動先候補とする
                    for (let offset = 1; offset <= 3; offset++) {
                        const targetD = violationEnd - offset;
                        if (targetD < 0 || targetD >= this.numDays) continue;
                        if (this.grid[s][targetD].isFixed || this.grid[s][targetD].symbol !== SYMBOLS.WORK) continue;

                        let repaired = false;
                        // 同スタッフ内の他の非固定休日（休）を探してスワップ
                        for (let holD = 0; holD < this.numDays; holD++) {
                            if (holD === targetD || this.grid[s][holD].isFixed) continue;
                            if (this.grid[s][holD].symbol !== SYMBOLS.OFF) continue;

                            this.setSymbol(s, targetD, SYMBOLS.OFF, false);
                            this.setSymbol(s, holD, SYMBOLS.WORK, false);

                            const valid = this.isStaffHardValid(s);
                            if (valid) {
                                repaired = true;
                                break;
                            } else {
                                this.setSymbol(s, targetD, SYMBOLS.WORK, false);
                                this.setSymbol(s, holD, SYMBOLS.OFF, false);
                            }
                        }
                        if (repaired) break;
                    }
                }
            }
        }
    }

    isStaffHardValid(s) {
        const staff = this.staffList[s];
        const sequence = [];
        for (let i = 0; i < 5; i++) sequence.push(staff.prevDays[i] || '');
        for (let d = 0; d < this.numDays; d++) sequence.push(this.grid[s][d].symbol);

        // 「早・遅・E・ハヤ・オソ・イブ」の翌日は必ず休日
        for (let idx = 0; idx < sequence.length - 1; idx++) {
            if (isRestrictedSpecial(sequence[idx])) {
                if (!isHolidaySymbol(sequence[idx + 1])) return false;
            }
        }

        // 連勤制限 (公休から公休の間のカウント。通常最大5日、allow6Consecなら最大6日)
        const maxConsec = staff.allow6Consec ? 6 : 5;
        let consec = 0;
        for (let idx = 0; idx < sequence.length; idx++) {
            if (sequence[idx] === '') {
                consec = 0;
            } else if (!isFullOffSymbol(sequence[idx])) {
                consec++;
                if (consec > maxConsec) return false;
            } else {
                consec = 0;
            }
        }

        // 5連勤後の2連休ルール（allow6Consecがfalseのスタッフ）
        if (!staff.allow6Consec) {
            let workStreak = 0;
            for (let idx = 0; idx < sequence.length; idx++) {
                if (isWorkSymbol(sequence[idx])) {
                    workStreak++;
                    if (workStreak === 5) {
                        for (let offOffset = 1; offOffset <= 2; offOffset++) {
                            const checkIdx = idx + offOffset;
                            if (checkIdx < sequence.length) {
                                const sym = sequence[checkIdx];
                                if (sym !== '' && !isHolidaySymbol(sym)) return false;
                            }
                        }
                    }
                } else {
                    workStreak = 0;
                }
            }
        }

        // 週（日〜土）出勤制限（出張・半休除き最大5出勤、allow6Consecがfalseのスタッフ）
        if (!staff.allow6Consec) {
            for (const wSpan of this.weekSpans) {
                let weekWorkCount = 0;
                for (const d of wSpan) {
                    const sym = this.grid[s][d].symbol;
                    if (sym && isWorkSymbol(sym) && sym !== SYMBOLS.TRIP && !isHalfDuty(sym)) {
                        weekWorkCount++;
                    }
                }
                if (weekWorkCount > 5) return false;
            }
        }

        return true;
    }

    /**
     * 全日において属性要件（スケ可日勤○2名以上、役職2名以上、専従3名以上、8時可1名以上）が充足されているか検証
     */
    isGlobalAttributesValid() {
        for (let d = 0; d < this.numDays; d++) {
            let schedWork = 0;
            let roleWork = 0;
            let ftWork = 0;
            let totalH8Cand = 0;
            let pureH8Cand = 0;
            for (let s = 0; s < this.numStaff; s++) {
                const sym = this.grid[s][d].symbol;
                if (this.staffList[s].canSched && sym === SYMBOLS.WORK) schedWork++;
                if (this.staffList[s].isRole && isWorkSymbol(sym) && sym !== SYMBOLS.TRIP) roleWork++;
                if (this.staffList[s].isFullTime && isWorkSymbol(sym) && sym !== SYMBOLS.TRIP) ftWork++;
                if (this.staffList[s].can8 && isWorkSymbol(sym)) {
                    totalH8Cand++;
                    if (!this.staffList[s].canSched) pureH8Cand++;
                }
            }
            if (schedWork < 2) return false;
            if (roleWork < 2) return false;
            if (ftWork < 3) return false;
            if (totalH8Cand < 1) return false;
            if (schedWork === 2 && pureH8Cand === 0) return false;
        }
        return true;
    }

    /**
     * 第1段階: 基本勤務表のハード制約検証
     */
    verifyBaseHardConstraints() {
        const errors = [];

        // 1. 事前入力枠の完全保持（上書き禁止・ロック検証）
        for (let s = 0; s < this.numStaff; s++) {
            for (let d = 0; d < this.numDays; d++) {
                const original = this.staffList[s].days[d];
                if (original && original !== '') {
                    if (this.grid[s][d].symbol !== original) {
                        errors.push(`【スタッフ No.${this.staffList[s].id} ${this.staffList[s].name}】${d + 1}日目の希望勤務「${original}」が変更されています（現在:「${this.grid[s][d].symbol}」）。`);
                    }
                }
            }
        }

        // 2. 特殊勤務（事前希望で入っているもの）の翌日休チェック
        for (let s = 0; s < this.numStaff; s++) {
            const staff = this.staffList[s];
            for (let d = 0; d < this.numDays - 1; d++) {
                const sym = this.grid[s][d].symbol;
                if (isRestrictedSpecial(sym)) {
                    const nextSym = this.grid[s][d + 1].symbol;
                    if (!isHolidaySymbol(nextSym)) {
                        errors.push(`【スタッフ No.${staff.id} ${staff.name}】${d + 1}日目の特殊勤務「${sym}」の翌日（${d + 2}日目）が休日ではありません（現在:「${nextSym}」）。`);
                    }
                }
            }
        }

        // 3. 連勤チェック（最大5連勤、allow6Consecなら6連勤）
        for (let s = 0; s < this.numStaff; s++) {
            const staff = this.staffList[s];
            const maxAllowed = staff.allow6Consec ? 6 : 5;
            const sequence = [];
            for (let p = 0; p < 5; p++) sequence.push(staff.prevDays[p] || '');
            for (let d = 0; d < this.numDays; d++) sequence.push(this.grid[s][d].symbol);

            let streak = 0;
            let startIdx = 0;
            for (let idx = 0; idx < sequence.length; idx++) {
                if (sequence[idx] === '') {
                    streak = 0;
                } else if (!isFullOffSymbol(sequence[idx])) {
                    if (streak === 0) startIdx = idx;
                    streak++;
                    if (streak > maxAllowed) {
                        const sLabel = startIdx < 5 ? `前${5 - startIdx}日` : `${startIdx - 4}日目`;
                        const eLabel = idx < 5 ? `前${5 - idx}日` : `${idx - 4}日目`;
                        errors.push(`【スタッフ No.${staff.id} ${staff.name}】${sLabel}〜${eLabel}で公休なし${streak}日連続（上限${maxAllowed}連勤違反）です。`);
                        break;
                    }
                } else {
                    streak = 0;
                }
            }
        }

        // 4. 5連勤後の2連休チェック（allow6Consecがfalseのスタッフ）
        for (let s = 0; s < this.numStaff; s++) {
            const staff = this.staffList[s];
            if (staff.allow6Consec) continue;

            const seq = [];
            for (let p = 0; p < 5; p++) seq.push(staff.prevDays[p] || '');
            for (let d = 0; d < this.numDays; d++) seq.push(this.grid[s][d].symbol);

            let workStreak = 0;
            for (let idx = 0; idx < seq.length; idx++) {
                if (isWorkSymbol(seq[idx])) {
                    workStreak++;
                    if (workStreak === 5) {
                        for (let offOffset = 1; offOffset <= 2; offOffset++) {
                            const checkIdx = idx + offOffset;
                            if (checkIdx < seq.length) {
                                const sym = seq[checkIdx];
                                if (sym !== '' && !isHolidaySymbol(sym)) {
                                    const targetDay = checkIdx - 4;
                                    errors.push(`【スタッフ No.${staff.id} ${staff.name}】5連勤直後の${targetDay}日目は2連休（休・有・リフ）が必要です（現在:「${sym}」）。`);
                                }
                            }
                        }
                    }
                } else {
                    workStreak = 0;
                }
            }
        }

        // 5. 週（日〜土）出勤制限チェック（出張・半休除き最大5出勤、allow6Consecがfalseのスタッフ）
        for (let s = 0; s < this.numStaff; s++) {
            const staff = this.staffList[s];
            if (staff.allow6Consec) continue;

            this.weekSpans.forEach((wSpan, wIdx) => {
                let weekWorkCount = 0;
                wSpan.forEach(d => {
                    const sym = this.grid[s][d].symbol;
                    if (sym && isWorkSymbol(sym) && sym !== SYMBOLS.TRIP && !isHalfDuty(sym)) {
                        weekWorkCount++;
                    }
                });
                if (weekWorkCount > 5) {
                    const sDay = wSpan[0] + 1;
                    const eDay = wSpan[wSpan.length - 1] + 1;
                    errors.push(`【スタッフ No.${staff.id} ${staff.name}】第${wIdx + 1}週（${sDay}日目〜${eDay}日目の日〜土）に出勤が${weekWorkCount}日あります（週休2日が必要です。出張・半休を除く）。`);
                }
            });
        }

        // 6. 属性充足チェック（スケ可○ >= 2, 役職 >= 2 出張除く, 専従 >= 3 出張除く）
        for (let d = 0; d < this.numDays; d++) {
            const dayNum = d + 1;
            let schedWorkCount = 0;
            let roleWorkCount = 0;
            let fullTimeWorkCount = 0;

            for (let s = 0; s < this.numStaff; s++) {
                const staff = this.staffList[s];
                const sym = this.grid[s][d].symbol;

                // スケ可: 「○」で出勤している人のみカウント
                if (staff.canSched && sym === SYMBOLS.WORK) {
                    schedWorkCount++;
                }
                // 役職: 施設内出勤（出張「出」除く勤務）
                if (staff.isRole && isWorkSymbol(sym) && sym !== SYMBOLS.TRIP) {
                    roleWorkCount++;
                }
                // 専従: 施設内出勤（出張「出」除く勤務）
                if (staff.isFullTime && isWorkSymbol(sym) && sym !== SYMBOLS.TRIP) {
                    fullTimeWorkCount++;
                }
            }

            const totalSched = this.staffList.filter(s => s.canSched).length;
            if (totalSched >= 2 && schedWorkCount < 2) {
                errors.push(`【${dayNum}日目】「スケ可」スタッフの日勤（○）が${schedWorkCount}名しかいません（要件: 2名以上）。`);
            }
            const totalRole = this.staffList.filter(s => s.isRole).length;
            if (totalRole >= 2 && roleWorkCount < 2) {
                errors.push(`【${dayNum}日目】「役職」スタッフの出勤が${roleWorkCount}名しかいません（要件: 2名以上、出張除く）。`);
            }
            const totalFullTime = this.staffList.filter(s => s.isFullTime).length;
            if (totalFullTime >= 3 && fullTimeWorkCount < 3) {
                errors.push(`【${dayNum}日目】「専従」スタッフの出勤が${fullTimeWorkCount}名しかいません（要件: 3名以上、出張除く）。`);
            }
        }

        // 7. 各スタッフの公休日数チェック（8.0日または8.5日）
        for (let s = 0; s < this.numStaff; s++) {
            const staff = this.staffList[s];
            let offDays = 0;
            for (let d = 0; d < this.numDays; d++) {
                const sym = this.grid[s][d].symbol;
                if (sym === SYMBOLS.OFF) offDays += 1.0;
                else if (sym === SYMBOLS.HALF_WORK_OFF || sym === SYMBOLS.HALF_OFF_WORK) offDays += 0.5;
            }
            if (Math.abs(offDays - this.options.standardHolidays) > 0.01) {
                errors.push(`【スタッフ No.${staff.id} ${staff.name}】公休日数が${offDays}日です（標準要件: ${this.options.standardHolidays}日）。`);
            }
        }

        return errors;
    }

    /**
     * 第2段階: 全特殊勤務配置後の最終ハード制約検証
     */
    verifyAllHardConstraints() {
        const errors = this.verifyBaseHardConstraints();

        // 8. 特殊勤務の定数配置（早3, 遅1, E2, 8時1）
        for (let d = 0; d < this.numDays; d++) {
            const dayNum = d + 1;
            let early = 0, late = 0, eve = 0, h8 = 0;
            for (let s = 0; s < this.numStaff; s++) {
                const sym = this.grid[s][d].symbol;
                if (sym === SYMBOLS.EARLY || sym === SYMBOLS.NO_ALLOW_EARLY) early++;
                if (sym === SYMBOLS.LATE || sym === SYMBOLS.NO_ALLOW_LATE) late++;
                if (sym === SYMBOLS.EVE || sym === SYMBOLS.NO_ALLOW_EVE) eve++;
                if (sym === SYMBOLS.H8) h8++;
            }
            if (early !== 3) errors.push(`【${dayNum}日目】早番（早・ハヤ）の人数が${early}名です（要件: 3名）。`);
            if (late !== 1) errors.push(`【${dayNum}日目】遅番（遅・オソ）の人数が${late}名です（要件: 1名）。`);
            if (eve !== 2) errors.push(`【${dayNum}日目】イブニング（E・イブ）の人数が${eve}名です（要件: 2名）。`);
            if (h8 !== 1) errors.push(`【${dayNum}日目】8時開始の人数が${h8}名です（要件: 1名）。`);
        }

        return errors;
    }

    /**
     * 統計集計（有休、リフ休、半日勤務の0.5換算個別集計に対応）
     */
    calculateStats() {
        const daily = [];
        for (let d = 0; d < this.numDays; d++) {
            let totalWork = 0, early = 0, late = 0, eve = 0, h8 = 0, normal = 0, off = 0, paid = 0, ref = 0;
            for (let s = 0; s < this.numStaff; s++) {
                const sym = this.grid[s][d].symbol;
                if (sym === SYMBOLS.EARLY) { early++; totalWork += 1.0; }
                else if (sym === SYMBOLS.LATE) { late++; totalWork += 1.0; }
                else if (sym === SYMBOLS.EVE) { eve++; totalWork += 1.0; }
                else if (sym === SYMBOLS.H8) { h8++; totalWork += 1.0; }
                else if (sym === SYMBOLS.WORK || sym === SYMBOLS.TRIP) { normal++; totalWork += 1.0; }
                else if (sym === SYMBOLS.OFF) { off += 1.0; }
                else if (sym === SYMBOLS.PAID) { paid += 1.0; }
                else if (SYMBOLS.REF_SUMMER.includes(sym) || SYMBOLS.REF_WINTER.includes(sym)) { ref += 1.0; }
                else if (sym === SYMBOLS.HALF_WORK_OFF || sym === SYMBOLS.HALF_OFF_WORK) {
                    totalWork += 0.5;
                    off += 0.5;
                }
                else if (sym === SYMBOLS.HALF_WORK_PAID || sym === SYMBOLS.HALF_PAID_WORK) {
                    totalWork += 0.5;
                    paid += 0.5;
                }
            }
            daily.push({ day: d + 1, totalWork, early, late, eve, h8, normal, off, paid, ref });
        }

        const staffStats = [];
        for (let s = 0; s < this.numStaff; s++) {
            let workDays = 0, offDays = 0, paidDays = 0, refDays = 0;
            let early = 0, late = 0, eve = 0, h8 = 0;
            for (let d = 0; d < this.numDays; d++) {
                const sym = this.grid[s][d].symbol;
                if (sym === SYMBOLS.EARLY) { early++; workDays += 1.0; }
                else if (sym === SYMBOLS.LATE) { late++; workDays += 1.0; }
                else if (sym === SYMBOLS.EVE) { eve++; workDays += 1.0; }
                else if (sym === SYMBOLS.H8) { h8++; workDays += 1.0; }
                else if (sym === SYMBOLS.WORK || sym === SYMBOLS.TRIP) { workDays += 1.0; }
                else if (sym === SYMBOLS.OFF) { offDays += 1.0; }
                else if (sym === SYMBOLS.PAID) { paidDays += 1.0; }
                else if (SYMBOLS.REF_SUMMER.includes(sym) || SYMBOLS.REF_WINTER.includes(sym)) { refDays += 1.0; }
                else if (sym === SYMBOLS.HALF_WORK_OFF || sym === SYMBOLS.HALF_OFF_WORK) {
                    workDays += 0.5;
                    offDays += 0.5;
                }
                else if (sym === SYMBOLS.HALF_WORK_PAID || sym === SYMBOLS.HALF_PAID_WORK) {
                    workDays += 0.5;
                    paidDays += 0.5;
                }
            }
            staffStats.push({
                id: this.staffList[s].id,
                name: this.staffList[s].name,
                workDays,
                offDays,
                paidDays,
                refDays,
                early,
                late,
                eve,
                h8
            });
        }

        return { daily, staffStats };
    }
}

/**
 * 確定勤務表（または手動修正後・Excel再読み込み後のグリッド）の全制約を包括検証
 * @param {Array<Array>} grid - 50×28 のセル（{ symbol } または 文字列）
 * @param {Array<Object>} staffList - スタッフ情報
 * @param {Object} options - { dates, standardHolidays, isFinal }
 * @returns {Object} { errors: string[], conflictCells: Array<{ staffIndex, dayIndex, reason }>, isValid: boolean }
 */
function validateScheduleGrid(grid, staffList, options = {}) {
    const numStaff = staffList.length;
    const numDays = 28;
    const standardHolidays = options.standardHolidays !== undefined ? options.standardHolidays : 8.0;
    const isFinal = options.isFinal !== false;
    const weekSpans = getSunToSatWeekSpans(options.dates, numDays);

    const errors = [];
    const conflictCells = [];
    const addConflict = (sIdx, dIdx, reason) => {
        if (sIdx >= 0 && sIdx < numStaff && dIdx >= 0 && dIdx < numDays) {
            conflictCells.push({ staffIndex: sIdx, dayIndex: dIdx, reason });
        }
    };

    const getSym = (s, d) => {
        const cell = grid[s] ? grid[s][d] : null;
        if (!cell) return '';
        return typeof cell === 'object' ? (cell.symbol || '') : String(cell);
    };

    // 1. 各スタッフ単位の制約検証
    for (let s = 0; s < numStaff; s++) {
        const staff = staffList[s];
        const maxAllowed = staff.allow6Consec ? 6 : 5;

        // A. 個別不可フラグチェック
        for (let d = 0; d < numDays; d++) {
            const sym = getSym(s, d);
            const dayNum = d + 1;
            if (sym === SYMBOLS.H8 && !staff.can8) {
                errors.push(`【スタッフ No.${staff.id} ${staff.name}】${dayNum}日目に「8時」が入っていますが、「8時可」ではありません。`);
                addConflict(s, d, `${dayNum}日目: 8時可フラグがOFFです`);
            }
            if ((sym === SYMBOLS.EARLY || sym === SYMBOLS.NO_ALLOW_EARLY) && staff.noEarly) {
                errors.push(`【スタッフ No.${staff.id} ${staff.name}】${dayNum}日目に「${sym}」が入っていますが、「早番不可」です。`);
                addConflict(s, d, `${dayNum}日目: 早番不可です`);
            }
            if ((sym === SYMBOLS.LATE || sym === SYMBOLS.NO_ALLOW_LATE) && staff.noLate) {
                errors.push(`【スタッフ No.${staff.id} ${staff.name}】${dayNum}日目に「${sym}」が入っていますが、「遅番不可」です。`);
                addConflict(s, d, `${dayNum}日目: 遅番不可です`);
            }
            if ((sym === SYMBOLS.EVE || sym === SYMBOLS.NO_ALLOW_EVE) && staff.noEve) {
                errors.push(`【スタッフ No.${staff.id} ${staff.name}】${dayNum}日目に「${sym}」が入っていますが、「E不可」です。`);
                addConflict(s, d, `${dayNum}日目: E不可です`);
            }
        }

        // B. 特殊勤務（早・遅・E・ハヤ・オソ・イブ）翌日休日チェック
        for (let d = 0; d < numDays - 1; d++) {
            const sym = getSym(s, d);
            if (isRestrictedSpecial(sym)) {
                const nextSym = getSym(s, d + 1);
                if (!isHolidaySymbol(nextSym)) {
                    errors.push(`【スタッフ No.${staff.id} ${staff.name}】${d + 1}日目の特殊勤務「${sym}」の翌日（${d + 2}日目）が休日ではありません（現在:「${nextSym}」）。`);
                    addConflict(s, d, `${d + 1}日目: 特殊勤務「${sym}」の翌日は休日が必要です`);
                    addConflict(s, d + 1, `${d + 2}日目: 前日が「${sym}」のため休日にする必要があります`);
                }
            }
        }

        // C. 連勤チェック（公休なし連続期間、allow6Consecなら6、通常5）
        const sequence = [];
        for (let p = 0; p < 5; p++) sequence.push(staff.prevDays ? staff.prevDays[p] || '' : '');
        for (let d = 0; d < numDays; d++) sequence.push(getSym(s, d));

        let nonOffStreak = [];
        for (let idx = 0; idx < sequence.length; idx++) {
            const sym = sequence[idx];
            if (sym === '') {
                nonOffStreak = [];
            } else if (!isFullOffSymbol(sym)) {
                nonOffStreak.push(idx);
                if (nonOffStreak.length > maxAllowed) {
                    const sIdxSeq = nonOffStreak[0];
                    const eIdxSeq = idx;
                    const sLabel = sIdxSeq < 5 ? `前${5 - sIdxSeq}日` : `${sIdxSeq - 4}日目`;
                    const eLabel = eIdxSeq < 5 ? `前${5 - eIdxSeq}日` : `${eIdxSeq - 4}日目`;
                    const ruleMsg = staff.allow6Consec ? '6連勤許可（7日以上連続は不可）' : '最大5連勤（6日以上連続は不可）';
                    errors.push(`【スタッフ No.${staff.id} ${staff.name}】${sLabel}〜${eLabel}で公休なし${nonOffStreak.length}日連続となっています（要件: ${ruleMsg}）。`);
                    nonOffStreak.forEach(seqDay => {
                        if (seqDay >= 5) {
                            addConflict(s, seqDay - 5, `公休間隔が上限(${maxAllowed}日)を超えています`);
                        }
                    });
                }
            } else {
                nonOffStreak = [];
            }
        }

        // D. 5連勤後の2連休チェック（allow6Consecがfalseのスタッフ）
        if (!staff.allow6Consec) {
            let workStreak = 0;
            for (let idx = 0; idx < sequence.length; idx++) {
                if (isWorkSymbol(sequence[idx])) {
                    workStreak++;
                    if (workStreak === 5) {
                        for (let offOffset = 1; offOffset <= 2; offOffset++) {
                            const checkIdx = idx + offOffset;
                            if (checkIdx < sequence.length) {
                                const sym = sequence[checkIdx];
                                if (sym !== '' && !isHolidaySymbol(sym)) {
                                    const targetDay = checkIdx - 4; // 1-based
                                    errors.push(`【スタッフ No.${staff.id} ${staff.name}】5連勤直後の${targetDay}日目は2連休（休・有・リフ）が必要です（現在:「${sym}」）。`);
                                    if (targetDay >= 1 && targetDay <= numDays) {
                                        addConflict(s, targetDay - 1, `5連勤の直後は2連休が必要です`);
                                    }
                                }
                            }
                        }
                    }
                } else {
                    workStreak = 0;
                }
            }
        }

        // E. 週（日〜土）出勤制限チェック（出張・半休除き最大5出勤、allow6Consecがfalseのスタッフ）
        if (!staff.allow6Consec) {
            weekSpans.forEach((wSpan, wIdx) => {
                let weekWorkCount = 0;
                const workDaysInWeek = [];
                wSpan.forEach(d => {
                    const sym = getSym(s, d);
                    if (sym && isWorkSymbol(sym) && sym !== SYMBOLS.TRIP && !isHalfDuty(sym)) {
                        weekWorkCount++;
                        workDaysInWeek.push(d);
                    }
                });
                if (weekWorkCount > 5) {
                    const sDay = wSpan[0] + 1;
                    const eDay = wSpan[wSpan.length - 1] + 1;
                    errors.push(`【スタッフ No.${staff.id} ${staff.name}】第${wIdx + 1}週（${sDay}日目〜${eDay}日目の日〜土）に出勤が${weekWorkCount}日あります（週休2日が必要です。出張・半休を除く）。`);
                    workDaysInWeek.forEach(d => {
                        addConflict(s, d, `日〜土の週に出勤が6日以上含まれます（週休2日違反）`);
                    });
                }
            });
        }

        // F. 公休日数チェック（8.0日または8.5日）
        let offDays = 0;
        for (let d = 0; d < numDays; d++) {
            const sym = getSym(s, d);
            if (sym === SYMBOLS.OFF) offDays += 1.0;
            else if (sym === SYMBOLS.HALF_WORK_OFF || sym === SYMBOLS.HALF_OFF_WORK) offDays += 0.5;
        }
        if (Math.abs(offDays - standardHolidays) > 0.01) {
            const reason = `公休日数が${offDays}日です（標準要件: ${standardHolidays}日）`;
            errors.push(`【スタッフ No.${staff.id} ${staff.name}】${reason}。`);
            // ★ 集計列の公休カウントセルへの網掛け用 conflict を追加
            conflictCells.push({
                staffIndex: s,
                statType: 'off',
                reason: reason
            });
        }
    }

    // 2. 日別の属性充足・特殊勤務枠数チェック
    for (let d = 0; d < numDays; d++) {
        const dayNum = d + 1;
        let schedWorkCount = 0;
        let roleWorkCount = 0;
        let fullTimeWorkCount = 0;
        let earlyCount = 0, lateCount = 0, eveCount = 0, h8Count = 0;

        for (let s = 0; s < numStaff; s++) {
            const staff = staffList[s];
            const sym = getSym(s, d);

            if (staff.canSched && sym === SYMBOLS.WORK) schedWorkCount++;
            if (staff.isRole && isWorkSymbol(sym) && sym !== SYMBOLS.TRIP) roleWorkCount++;
            if (staff.isFullTime && isWorkSymbol(sym) && sym !== SYMBOLS.TRIP) fullTimeWorkCount++;

            if (sym === SYMBOLS.EARLY || sym === SYMBOLS.NO_ALLOW_EARLY) earlyCount++;
            if (sym === SYMBOLS.LATE || sym === SYMBOLS.NO_ALLOW_LATE) lateCount++;
            if (sym === SYMBOLS.EVE || sym === SYMBOLS.NO_ALLOW_EVE) eveCount++;
            if (sym === SYMBOLS.H8) h8Count++;
        }

        // スケ可: 日勤（○）が2名以上
        const totalSched = staffList.filter(s => s.canSched).length;
        if (totalSched >= 2 && schedWorkCount < 2) {
            errors.push(`【${dayNum}日目】「スケ可」スタッフの日勤（○）が${schedWorkCount}名しかいません（要件: 2名以上）。`);
            for (let s = 0; s < numStaff; s++) {
                if (staffList[s].canSched && getSym(s, d) !== SYMBOLS.WORK) {
                    addConflict(s, d, `${dayNum}日目: スケ可の日勤(○)が不足しています（現在:「${getSym(s, d) || '未設定'}」）`);
                }
            }
        }

        // 役職: 2名以上（出張除く）
        const totalRole = staffList.filter(s => s.isRole).length;
        if (totalRole >= 2 && roleWorkCount < 2) {
            errors.push(`【${dayNum}日目】「役職」スタッフの出勤が${roleWorkCount}名しかいません（要件: 2名以上、出張除く）。`);
        }

        // 専従: 3名以上（出張除く）
        const totalFullTime = staffList.filter(s => s.isFullTime).length;
        if (totalFullTime >= 3 && fullTimeWorkCount < 3) {
            errors.push(`【${dayNum}日目】「専従」スタッフの出勤が${fullTimeWorkCount}名しかいません（要件: 3名以上、出張除く）。`);
        }

        // 確定勤務表の場合の特殊勤務人数チェック
        if (isFinal) {
            if (earlyCount !== 3) errors.push(`【${dayNum}日目】早番（早・ハヤ）が${earlyCount}名です（要件: 3名）。`);
            if (lateCount !== 1) errors.push(`【${dayNum}日目】遅番（遅・オソ）が${lateCount}名です（要件: 1名）。`);
            if (eveCount !== 2) errors.push(`【${dayNum}日目】イブニング（E・イブ）が${eveCount}名です（要件: 2名）。`);
            if (h8Count !== 1) errors.push(`【${dayNum}日目】8時開始が${h8Count}名です（要件: 1名）。`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        conflictCells
    };
}

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ShiftScheduler, validateInitialState, validateScheduleGrid, SYMBOLS, isJapaneseHoliday };
} else {
    window.ShiftScheduler = ShiftScheduler;
    window.validateInitialState = validateInitialState;
    window.validateScheduleGrid = validateScheduleGrid;
    window.SYMBOLS = SYMBOLS;
    window.isJapaneseHoliday = isJapaneseHoliday;
}

