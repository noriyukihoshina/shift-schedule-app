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
    EXCLUDE: 'ー', // ★ 勤務対象外（異動・退職等）
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

// ★ 勤務対象外記号判定（異動・退職等。出勤・公休カウントから完全除外）
function isExcludeSymbol(sym) {
    if (!sym) return false;
    return sym === SYMBOLS.EXCLUDE || sym === 'ー' || sym === '－' || sym === '―' || sym === '-' || sym === '—';
}

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

// ★ 公休（休）およびリフレッシュ休暇（上/下）判定。連勤を切断・リセット！
// リフレッシュ休暇は丸1日の休暇であるため連勤を切断（前借り・後回しや連続取得も完全許容）
function isFullOffSymbol(sym) {
    if (!sym) return false;
    if (isExcludeSymbol(sym)) return true; // ★ 異動・退職等で勤務していないため連勤をリセット・切断
    if (sym === SYMBOLS.OFF) return true;
    if (SYMBOLS.REF_SUMMER.includes(sym) || SYMBOLS.REF_WINTER.includes(sym)) return true;
    return false;
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
    const numDays = options.numDays || (options.dates ? options.dates.length : 28);
    const weekSpans = getSunToSatWeekSpans(options.dates, numDays);

    // 1. 各スタッフごとの事前入力チェック
    staffList.forEach((staff, sIdx) => {
        if (staff.isUnused) return;

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
            if (staff.isUnused) return;
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
                if ((staff.isSectionChief || staff.isChief) && sym !== SYMBOLS.TRIP) roleAvailable++;
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

        const activeStaffCount = staffList.filter(s => !s.isUnused).length;
        const availableCount = activeStaffCount - holidayStaff.length;
        if (availableCount < 7) {
            errors.push(`【${dayNum}日目】出勤可能スタッフが${availableCount}名しかおらず、必須特殊勤務数（早3+遅1+E2+8時1=計7名）を満たせません（希望休が多すぎます）。`);
            holidayStaff.forEach(sIdx => {
                conflictCells.push({ staffIndex: sIdx, dayIndex: d, reason: `${dayNum}日目: 希望休が多すぎます。出勤に変更可能なスタッフを調整してください。` });
            });
        }

        // 属性充足チェック（事前希望の重複で物理的に不足する場合）
        const totalSched = staffList.filter(s => !s.isUnused && s.canSched).length;
        if (totalSched >= 2 && schedAvailable < 2) {
            errors.push(`【${dayNum}日目】「スケ可」スタッフの出勤可能人数が${schedAvailable}名しかおらず、必要数（2名以上）を満たせません（スケ可スタッフの希望休重複をご確認ください）。`);
        }
        // 係長・主任・副主任の充足チェック
        const sectionChiefs = staffList.filter(s => !s.isUnused && s.isSectionChief);
        const chiefs = staffList.filter(s => !s.isUnused && s.isChief);
        const subChiefs = staffList.filter(s => !s.isUnused && s.isSubChief);

        const dates = options.dates;
        const curDateInfo = (dates && dates[d]) ? dates[d] : null;
        const isWeekday = curDateInfo ? (curDateInfo.wIdx >= 0 && curDateInfo.wIdx <= 4) : ((d % 7) >= 0 && (d % 7) <= 4);

        if (sectionChiefs.length > 0) {
            // 平日における係長出勤・主任代替チェック
            if (isWeekday) {
                // 係長が出勤可能か
                let scAvailableCount = 0;
                sectionChiefs.forEach(sc => {
                    const sym = sc.days[d];
                    if (!isHolidaySymbol(sym) && sym !== SYMBOLS.TRIP) {
                        scAvailableCount++;
                    }
                });

                // 係長が全員不在（休・有・リフ・特休・出張等）の場合、主任が1名以上出勤必須
                if (scAvailableCount === 0) {
                    let chiefAvailableCount = 0;
                    chiefs.forEach(ch => {
                        const sym = ch.days[d];
                        if (!isHolidaySymbol(sym) && sym !== SYMBOLS.TRIP) {
                            chiefAvailableCount++;
                        }
                    });

                    if (chiefs.length > 0 && chiefAvailableCount < 1) {
                        errors.push(`【${dayNum}日目】係長不在日ですが、主任の出勤可能者が0名です（主任を1名以上配置してください）。`);
                        // ユーザー指示: 「係長の休みにのみお願い。カーソルを合わせたらエラーの内容を確認できる様に。」
                        sectionChiefs.forEach(sc => {
                            const scIdx = staffList.indexOf(sc);
                            if (scIdx >= 0) {
                                conflictCells.push({
                                    staffIndex: scIdx,
                                    dayIndex: d,
                                    reason: `⚠️ 主任不在エラー: この日は係長が不在ですが、主任が出勤していません（主任を1名以上配置してください）`
                                });
                            }
                        });
                    }
                }
            }
        }
        const totalFullTime = staffList.filter(s => !s.isUnused && s.isFullTime).length;
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
        this.numDays = options.numDays || (options.dates ? options.dates.length : (this.staffList[0]?.days?.length || 28));
        this.options = Object.assign({
            standardHolidays: 8, // 標準公休日数 (通常8, 第13タームは8.5または9.0)
            dayOffsets: new Array(this.numDays).fill(0)
        }, options);

        this.dates = this.options.dates || null;
        this.dayOffsets = Array.isArray(this.options.dayOffsets) ? [...this.options.dayOffsets] : new Array(this.numDays).fill(0);
        this.weekSpans = getSunToSatWeekSpans(this.options.dates, this.numDays);
        this.grid = [];
        this.initGrid();
    }

    /**
     * スタッフ s の記号 sym に対する「実数（リハビリ実働換算）」寄与度を取得
     * 0.5トグル(isHalf)のスタッフは0.5倍、半休(○/休, ○/有等)は0.5倍として計算
     */
    getStaffRealWorkAmt(s, sym) {
        if (!sym || !this.staffList[s] || this.staffList[s].isUnused) return 0;
        let amt = 0;
        if ([SYMBOLS.WORK, '〇', '◯', SYMBOLS.TRIP, SYMBOLS.EARLY, SYMBOLS.LATE, SYMBOLS.EVE, SYMBOLS.H8, SYMBOLS.NO_ALLOW_EARLY, SYMBOLS.NO_ALLOW_LATE, SYMBOLS.NO_ALLOW_EVE].includes(sym)) {
            amt = 1.0;
        } else if (isHalfDuty(sym)) {
            amt = 0.5;
        }
        if (amt <= 0) return 0;
        const factor = this.staffList[s].isHalf ? 0.5 : 1.0;
        return amt * factor;
    }

    /**
     * 当日 d の出勤実数ベース合計（加減枠適用前）を取得
     */
    getDailyRealWorkBase(d, staffIndices = null) {
        let base = 0;
        if (staffIndices) {
            for (const s of staffIndices) {
                if (this.staffList[s] && !this.staffList[s].isUnused) {
                    base += this.getStaffRealWorkAmt(s, this.grid[s][d].symbol);
                }
            }
        } else {
            for (let s = 0; s < this.numStaff; s++) {
                if (!this.staffList[s].isUnused) {
                    base += this.getStaffRealWorkAmt(s, this.grid[s][d].symbol);
                }
            }
        }
        return base;
    }

    /**
     * 当日 d の「実数合計（realWork）」を取得（案B: 増員枠 offset > 0 のみ減算）
     */
    getDailyRealWork(d) {
        const base = this.getDailyRealWorkBase(d);
        const offset = (this.dayOffsets && this.dayOffsets[d]) ? this.dayOffsets[d] : 0;
        return (offset > 0) ? Math.max(0, base - offset) : base;
    }

    /**
     * 平坦化（平準化）比較用の実数負荷指標を取得
     * offset >= 0 の日は実数合計(realWork = base - offset)そのもの、
     * offset < 0 (土日祝の-2等) の日は減員目標を反映した (base - offset) を返すことで、
     * 全日の「実数合計」を目標通りにフラット化する。
     */
    getDailyEffectiveRealLoad(d) {
        const base = this.getDailyRealWorkBase(d);
        const offset = (this.dayOffsets && this.dayOffsets[d]) ? this.dayOffsets[d] : 0;
        return base - offset;
    }

    initGrid() {
        this.grid = [];
        for (let s = 0; s < this.numStaff; s++) {
            const row = [];
            const staff = this.staffList[s];
            for (let d = 0; d < this.numDays; d++) {
                if (staff.isUnused) {
                    row.push({
                        symbol: '',
                        isFixed: false,
                        locked: true
                    });
                    continue;
                }
                const initSym = staff.days[d] || '';
                const isExcluded = isExcludeSymbol(initSym);
                row.push({
                    symbol: isExcluded ? SYMBOLS.EXCLUDE : initSym,
                    isFixed: initSym !== '', // 手動入力された希望勤務および「ー」は完全ロック
                    isExcluded: isExcluded
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
            if (this.staffList[s].isUnused) return; // 不使用スタッフは変更不可
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
        if (staff.isUnused) return false;
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
        // 2. 係長・主任・副主任保護
        const curDateInfo = (this.dates && this.dates[d]) ? this.dates[d] : null;
        const isWeekday = curDateInfo ? (curDateInfo.wIdx >= 0 && curDateInfo.wIdx <= 4) : ((d % 7) >= 0 && (d % 7) <= 4);

        // 係長は平日（月〜金）基本出勤（休みにするのをブロック）
        if (staff.isSectionChief && isWeekday) {
            return false; // 平日は休みにしない
        }

        // 主任保護：係長が休みの平日には主任を最低1名出勤維持
        if (staff.isChief && isWeekday) {
            let scWorking = false;
            for (let otherS = 0; otherS < this.numStaff; otherS++) {
                if (this.staffList[otherS].isSectionChief) {
                    const sym = this.grid[otherS][d].symbol;
                    if (!isHolidaySymbol(sym) && sym !== SYMBOLS.TRIP) {
                        scWorking = true;
                        break;
                    }
                }
            }
            // 係長が休みの場合、他の主任が出勤していなければ休みにできない
            if (!scWorking) {
                let otherChiefWorking = false;
                for (let otherS = 0; otherS < this.numStaff; otherS++) {
                    if (otherS === s) continue;
                    if (this.staffList[otherS].isChief) {
                        const sym = this.grid[otherS][d].symbol;
                        if (!isHolidaySymbol(sym) && sym !== SYMBOLS.TRIP) {
                            otherChiefWorking = true;
                            break;
                        }
                    }
                }
                if (!otherChiefWorking) return false;
            }
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
            h8: new Array(this.numStaff).fill(0),
            total: new Array(this.numStaff).fill(0)
        };
        const lastDay = new Array(this.numStaff).fill(-10);

        for (let s = 0; s < this.numStaff; s++) {
            if (this.staffList[s].isUnused) continue;
            for (let d = 0; d < this.numDays; d++) {
                const sym = this.grid[s][d].symbol;
                if (sym === SYMBOLS.EARLY || sym === SYMBOLS.NO_ALLOW_EARLY) { counts.early[s]++; counts.total[s]++; lastDay[s] = Math.max(lastDay[s], d); }
                if (sym === SYMBOLS.LATE || sym === SYMBOLS.NO_ALLOW_LATE) { counts.late[s]++; counts.total[s]++; lastDay[s] = Math.max(lastDay[s], d); }
                if (sym === SYMBOLS.EVE || sym === SYMBOLS.NO_ALLOW_EVE) { counts.eve[s]++; counts.total[s]++; lastDay[s] = Math.max(lastDay[s], d); }
                if (sym === SYMBOLS.H8) { counts.h8[s]++; }
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
                    if (this.staffList[s].isUnused) continue;
                    if (req.matchSyms.includes(this.grid[s][d].symbol)) assigned++;
                }

                const needed = req.count - assigned;
                if (needed <= 0) continue;

                let candidates = [];
                for (let s = 0; s < this.numStaff; s++) {
                    if (this.staffList[s].isUnused) continue;
                    // 当日dが非固定の○であること
                    if (this.grid[s][d].isFixed || this.grid[s][d].symbol !== SYMBOLS.WORK) continue;

                    // 個別不可フラグ
                    if (this.staffList[s][req.noFlag]) continue;

                    // スケ可保護：このスタッフを特殊勤務にしても、当日のスケ可かつ○が2名以上残るか
                    if (this.staffList[s].canSched) {
                        let remainingSchedWork = 0;
                        for (let otherS = 0; otherS < this.numStaff; otherS++) {
                            if (otherS === s || this.staffList[otherS].isUnused) continue;
                            if (this.staffList[otherS].canSched && this.grid[otherS][d].symbol === SYMBOLS.WORK) {
                                remainingSchedWork++;
                            }
                        }
                        if (remainingSchedWork < 2) continue;
                    }

                    // 翌日休みの検証（翌日が期間外、または既に休日か、あるいは翌日を休日にスワップ可能か）
                    let canNextBeOff = false;
                    let swapDay = -1;

                    if (d + 1 >= this.numDays) {
                        canNextBeOff = true; // 最終日の翌日は期間外
                    } else if (isHolidaySymbol(this.grid[s][d + 1].symbol)) {
                        canNextBeOff = true; // 既に休日！公休日数も実数合計も変わらないためベスト
                    } else if (!this.grid[s][d + 1].isFixed && this.grid[s][d + 1].symbol === SYMBOLS.WORK) {
                        // 翌日(d+1)を休日に変更できるか検証：
                        let schedOkNext = true;
                        if (this.staffList[s].canSched) {
                            let nextSchedWork = 0;
                            for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                if (otherS === s || this.staffList[otherS].isUnused) continue;
                                if (this.staffList[otherS].canSched && this.grid[otherS][d + 1].symbol === SYMBOLS.WORK) {
                                    nextSchedWork++;
                                }
                            }
                            if (nextSchedWork < 2) schedOkNext = false;
                        }

                        if (schedOkNext) {
                            let canSetD1Off = this.canPlaceHoliday(s, d + 1);
                            if (canSetD1Off) {
                                // ★ 実数合計（getDailyEffectiveRealLoad）が少ない日（同週優先）から順にスワップ先を探索
                                const d1Week = this.weekSpans.findIndex(span => span.includes(d + 1));
                                const dayCandidates = [];
                                for (let candD = 0; candD < this.numDays; candD++) {
                                    if (candD === d || candD === d + 1) continue;
                                    const realLoad = this.getDailyEffectiveRealLoad(candD);
                                    const candWeek = this.weekSpans.findIndex(span => span.includes(candD));
                                    dayCandidates.push({
                                        day: candD,
                                        realLoad: realLoad,
                                        sameWeek: (candWeek === d1Week) ? 1 : 0
                                    });
                                }
                                dayCandidates.sort((a, b) => {
                                    if (a.sameWeek !== b.sameWeek) return b.sameWeek - a.sameWeek;
                                    return a.realLoad - b.realLoad;
                                });

                                for (const dObj of dayCandidates) {
                                    const otherD = dObj.day;
                                    if (!this.grid[s][otherD].isFixed && this.grid[s][otherD].symbol === SYMBOLS.OFF) {
                                        // otherD を ○ にスワップできるか一時的に試す
                                        this.setSymbol(s, otherD, SYMBOLS.WORK, false);
                                        this.setSymbol(s, d + 1, SYMBOLS.OFF, false);
                                        const valid = this.isStaffHardValid(s) && this.isGlobalAttributesValid();
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
                    const prevIsHoliday = (d > 0) && isHolidaySymbol(this.grid[s][d - 1].symbol);
                    const isSandwiched = prevIsHoliday;

                    // ★ 要件: 「8時が複数回ある人は早・遅など特殊をやや少なめにして」
                    // 8時(counts.h8[s])が2回以上あるスタッフには、特殊勤務(早・遅・E)がやや少なめ（他スタッフより1〜2回程度少なめ）になるよう調整
                    let h8Penalty = 0;
                    if (counts.h8[s] >= 2) {
                        h8Penalty = 150 + (counts.h8[s] - 2) * 75;
                        if (counts.total[s] >= 3) h8Penalty += 120;
                        if (counts.total[s] >= 4) h8Penalty += 300;
                    } else if (counts.h8[s] === 1) {
                        h8Penalty = 25;
                    }
                    // 全体でも特定スタッフに特殊勤務が6回以上偏らないようソフトキャップを付与
                    const highCountPenalty = counts.total[s] >= 6 ? (counts.total[s] - 5) * 280 : (counts.total[s] === 5 ? 90 : 0);

                    // スコア計算:
                    let score = counts.total[s] * 100 + counts[req.key][s] * 15 + h8Penalty + highCountPenalty;
                    if (swapDay >= 0) {
                        // スワップが必要な場合は優先度を下げ、さらにスワップによる実数合計の偏り影響を加味
                        const d1Load = this.getDailyEffectiveRealLoad(d + 1);
                        const swapLoad = this.getDailyEffectiveRealLoad(swapDay);
                        score += 500 + (swapLoad - d1Load) * 40;
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

                    // セクション偏りの防止（各セクションからバランスよく特殊勤務を選出。ただし8時複数回抑制や回数平準化を潰さない適切な重み）
                    if (this.staffList[s].section) {
                        const sec = this.staffList[s].section;
                        let sameSecSpecialCount = 0;
                        for (let otherS = 0; otherS < this.numStaff; otherS++) {
                            if (otherS === s || this.staffList[otherS].isUnused) continue;
                            if (this.staffList[otherS].section === sec) {
                                if (isRestrictedSpecial(this.grid[otherS][d].symbol)) {
                                    sameSecSpecialCount++;
                                }
                            }
                        }
                        // 同セクション1人目までは軽いペナルティ(+220)、2人目以降は強め(+900)にして偏りを防ぎつつ回数平準化・8時抑制を優先
                        score += sameSecSpecialCount === 1 ? 220 : (sameSecSpecialCount >= 2 ? sameSecSpecialCount * 900 : 0);

                        // 翌日(d+1)がスワップで休になる場合、翌日の同セクション実数合計を保護
                        if (swapDay >= 0 && d + 1 < this.numDays) {
                            let nextRealInSec = 0;
                            for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                if (this.staffList[otherS].isUnused || otherS === s) continue;
                                if (this.staffList[otherS].section === sec) {
                                    nextRealInSec += this.getStaffRealWorkAmt(otherS, this.grid[otherS][d + 1].symbol);
                                }
                            }
                            if (nextRealInSec < 6) {
                                score += (6 - nextRealInSec) * 400;
                            }
                        }
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
            if (staff.isUnused) continue;
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
        if (staff.isUnused) return null;
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

        // 各日ですでに休日（固定または他のスタッフで確定）になっている「実数換算（0.5トグル・半休反映）」を集計
        const dailyOffCounts = new Array(numDays).fill(0);
        const dailyH8OffCounts = new Array(numDays).fill(0);
        const dailySchedOffCounts = new Array(numDays).fill(0);
        const dailyRoleOffCounts = new Array(numDays).fill(0);
        const dailyFullTimeOffCounts = new Array(numDays).fill(0);
        for (let otherS = 0; otherS < this.numStaff; otherS++) {
            if (otherS === s || this.staffList[otherS].isUnused) continue;
            const otherWeight = this.staffList[otherS].isHalf ? 0.5 : 1.0;
            for (let d = 0; d < numDays; d++) {
                const sym = this.grid[otherS][d].symbol;
                if (isHolidaySymbol(sym)) {
                    dailyOffCounts[d] += otherWeight;
                    if (this.staffList[otherS].can8) dailyH8OffCounts[d]++;
                    if (this.staffList[otherS].canSched) dailySchedOffCounts[d]++;
                    if (this.staffList[otherS].isSectionChief || this.staffList[otherS].isChief) dailyRoleOffCounts[d]++;
                    if (this.staffList[otherS].isFullTime) dailyFullTimeOffCounts[d]++;
                } else if (isHalfDuty(sym)) {
                    dailyOffCounts[d] += 0.5 * otherWeight;
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

        // ★ 各週の日数と既存の休日実数（dailyOffCounts + dayOffsets）から、全体の実数合計が全週でフラットになるよう週別配分をソート
        const staffRealW = staff.isHalf ? 0.5 : 1.0;
        const weekCurrentAvgOff = weekSpans.map(wSpan => {
            let sum = 0;
            wSpan.forEach(d => {
                const offset = (self.dayOffsets && self.dayOffsets[d]) ? self.dayOffsets[d] : 0;
                // 固定済みの自分自身の休日も加味
                let selfFixedOff = 0;
                if (self.grid[s][d].isFixed) {
                    const sym = self.grid[s][d].symbol;
                    if (isHolidaySymbol(sym)) selfFixedOff = staffRealW;
                    else if (isHalfDuty(sym)) selfFixedOff = 0.5 * staffRealW;
                }
                sum += dailyOffCounts[d] + selfFixedOff + offset;
            });
            return sum / wSpan.length;
        });
        const overallAvgOff = weekCurrentAvgOff.reduce((acc, v, i) => acc + v * weekSpans[i].length, 0) / numDays;

        distributionPatterns.sort((a, b) => {
            let costA = 0, costB = 0;
            for (let w = 0; w < totalWeeks; w++) {
                const wLen = weekSpans[w].length;
                // 当該週に a[w] 個の公休を追加した後の「週平均休日実数」と全体平均とのズレを最小化
                const afterAvgA = weekCurrentAvgOff[w] + (a[w] * staffRealW) / wLen;
                const afterAvgB = weekCurrentAvgOff[w] + (b[w] * staffRealW) / wLen;
                const idealAfter = overallAvgOff + (neededOff * staffRealW) / numDays;
                costA += Math.pow(afterAvgA - idealAfter, 2) * wLen;
                costB += Math.pow(afterAvgB - idealAfter, 2) * wLen;
            }
            return costA - costB;
        });

        // 選択された休日候補のスコア計算ヘルパー
        function calcChoiceScore(days, isConsecutive = false) {
            let score = 0;
            if (isConsecutive) score += 100;

            for (const d of days) {
                const currentOff = dailyOffCounts[d];
                // ★ 出勤人数平準化の徹底強化:
                // 日別加減枠（土日祝-2等）を加味した目標休日数（平日約16名、土日祝約18名）からの乖離をペナルティ化
                const offset = (self.dayOffsets && self.dayOffsets[d]) ? self.dayOffsets[d] : 0;
                const idealOff = 16 - offset;
                const diffFromIdeal = currentOff - idealOff;
                score -= diffFromIdeal * 25;

                if (staff.can8) score -= dailyH8OffCounts[d] * 30;
                if (staff.canSched) score -= dailySchedOffCounts[d] * 35;
                if (staff.isSectionChief || staff.isChief) score -= dailyRoleOffCounts[d] * 30;
                if (staff.isFullTime) score -= dailyFullTimeOffCounts[d] * 25;

                const prev = (d === 0) ? (staff.prevDays ? staff.prevDays[4] : '') : self.grid[s][d - 1].symbol;
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

                    const isFractionalTarget = Math.abs(targetOff - Math.round(targetOff)) > 0.01;
                    const offMatches = isFractionalTarget
                        ? (Math.abs(currentOff - targetOff) <= 0.51)
                        : (Math.abs(currentOff - targetOff) < 0.01);

                    if (offMatches && self.verifyStaffSchedule(s, gridSymbols, maxConsec)) {
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

        // 人数平準化パス (多対多スワップ局所探索: セクション別均等化)
        this.balanceDailyWorkforce();
    }

    /**
     * 指定されたスタッフグループ（セクション）内での出勤人数平準化スワップ
     */
    balanceGroupWorkforce(staffIndices) {
        if (!staffIndices || staffIndices.length <= 1) return;

        for (let iter = 0; iter < 250; iter++) {
            const daily = [];
            for (let d = 0; d < this.numDays; d++) {
                const w = this.getDailyRealWorkBase(d, staffIndices);
                daily.push({ day: d, count: w });
            }
            daily.sort((a, b) => b.count - a.count);

            const diff = daily[0].count - daily[daily.length - 1].count;
            if (diff <= 0.5) break;

            let swapped = false;
            const totalWorkDays = daily.reduce((sum, item) => sum + item.count, 0);
            const targetAvg = totalWorkDays / this.numDays;

            const testHigh = daily.filter(item => item.count > targetAvg + 0.1);
            const testLow = daily.slice().reverse().filter(item => item.count < targetAvg + 0.4);

            outerLoop:
            for (const hItem of testHigh) {
                const maxDay = hItem.day;
                const hWeek = this.weekSpans.findIndex(span => span.includes(maxDay));

                const sortedLow = testLow.slice().sort((a, b) => {
                    const sameWeekA = this.weekSpans.findIndex(span => span.includes(a.day)) === hWeek ? 1 : 0;
                    const sameWeekB = this.weekSpans.findIndex(span => span.includes(b.day)) === hWeek ? 1 : 0;
                    if (sameWeekA !== sameWeekB) return sameWeekB - sameWeekA;
                    return a.count - b.count;
                });

                for (const lItem of sortedLow) {
                    const minDay = lItem.day;
                    if (maxDay === minDay) continue;

                    const curMaxCnt = daily.find(d => d.day === maxDay).count;
                    const curMinCnt = daily.find(d => d.day === minDay).count;

                    for (const s of staffIndices) {
                        const staffWeight = this.staffList[s].isHalf ? 0.5 : 1.0;
                        // セクション内実数の差がスタッフの実数重みより大きい場合のみスワップ
                        if (curMaxCnt - curMinCnt <= staffWeight + 0.01) continue;

                        // ★ 全体の実数合計（getDailyEffectiveRealLoad）を悪化させない場合のみセクション内スワップを許可
                        const globalMaxLoad = this.getDailyEffectiveRealLoad(maxDay);
                        const globalMinLoad = this.getDailyEffectiveRealLoad(minDay);
                        if (globalMaxLoad - globalMinLoad < staffWeight - 0.01) continue;

                        if (!this.grid[s][maxDay].isFixed && this.grid[s][maxDay].symbol === SYMBOLS.WORK &&
                            !this.grid[s][minDay].isFixed && this.grid[s][minDay].symbol === SYMBOLS.OFF) {

                            this.setSymbol(s, maxDay, SYMBOLS.OFF, false);
                            this.setSymbol(s, minDay, SYMBOLS.WORK, false);

                            const staffValid = this.isStaffHardValid(s);
                            const globalValid = staffValid && this.isGlobalAttributesValid();

                            if (staffValid && globalValid) {
                                swapped = true;
                                break outerLoop;
                            } else {
                                this.setSymbol(s, maxDay, SYMBOLS.WORK, false);
                                this.setSymbol(s, minDay, SYMBOLS.OFF, false);
                            }
                        }
                    }
                }
            }

            if (!swapped) break;
        }
    }

    /**
     * ★ 実数合計（realWork）を基準とした全体出勤人数の平坦化エンジン
     * （出勤人数合計ではなく、0.5トグル・半休・日別加減枠を反映した「実数合計」の分散を最小化する）
     * 1. 直接スワップ（1.0スタッフおよび0.5スタッフ）
     * 2. 1.0スタッフと0.5スタッフの逆方向同時スワップ（差1.0の2日間を±0.5ずつ移動して完全フラット化）
     * 3. 中継日(midDay)を介した2ステップ連鎖スワップ（週休2日制約を守りつつ異なる週の間の実数合計の凹凸を平坦化）
     */
    balanceGlobalWithOffsets() {
        for (let iter = 0; iter < 500; iter++) {
            const daily = [];
            for (let d = 0; d < this.numDays; d++) {
                const load = this.getDailyEffectiveRealLoad(d);
                daily.push({ day: d, load });
            }

            const totalLoad = daily.reduce((sum, item) => sum + item.load, 0);
            const avgLoad = totalLoad / this.numDays;

            daily.forEach(item => {
                item.diff = item.load - avgLoad;
            });

            // 負荷（実数合計）が高い順
            daily.sort((a, b) => b.diff - a.diff);

            const maxLoad = daily[0].load;
            const minLoad = daily[daily.length - 1].load;
            // 最大と最小の実数差が0.5以下ならこれ以上平坦化不可能（完全フラット）
            if (maxLoad - minLoad <= 0.51) break;

            let swapped = false;

            // --- フェーズ1: 単一スタッフによる直接スワップ（1.0換算スタッフ または 0.5換算スタッフ） ---
            const highDays = daily.filter(item => item.diff > 0.15);
            const lowDays = daily.slice().reverse().filter(item => item.diff < -0.15);

            outerDirect:
            for (const hItem of highDays) {
                const maxDay = hItem.day;
                const hWeek = this.weekSpans.findIndex(span => span.includes(maxDay));

                const sortedLow = lowDays.slice().sort((a, b) => {
                    const gapA = hItem.load - a.load;
                    const gapB = hItem.load - b.load;
                    const sameWeekA = this.weekSpans.findIndex(span => span.includes(a.day)) === hWeek ? 1 : 0;
                    const sameWeekB = this.weekSpans.findIndex(span => span.includes(b.day)) === hWeek ? 1 : 0;
                    if (sameWeekA !== sameWeekB && Math.abs(gapA - gapB) <= 0.5) return sameWeekB - sameWeekA;
                    return a.load - b.load;
                });

                for (const lItem of sortedLow) {
                    const minDay = lItem.day;
                    if (maxDay === minDay) continue;
                    const gap = hItem.load - lItem.load;
                    if (gap <= 0.51) continue;

                    // gap === 1.0 のときは 0.5スタッフ(isHalf)を最優先、gap >= 1.5 のときは 1.0スタッフを優先
                    const staffOrder = [];
                    for (let s = 0; s < this.numStaff; s++) {
                        if (!this.staffList[s].isUnused) staffOrder.push(s);
                    }
                    staffOrder.sort((a, b) => {
                        const wA = this.staffList[a].isHalf ? 0.5 : 1.0;
                        const wB = this.staffList[b].isHalf ? 0.5 : 1.0;
                        const remA = Math.abs(gap - 2 * wA);
                        const remB = Math.abs(gap - 2 * wB);
                        return remA - remB;
                    });

                    for (const s of staffOrder) {
                        const w = this.staffList[s].isHalf ? 0.5 : 1.0;
                        // スワップ後に2日間の実数差が確実に縮まる場合のみ実行（gap > w）
                        if (gap <= w + 0.01) continue;

                        if (!this.grid[s][maxDay].isFixed && this.grid[s][maxDay].symbol === SYMBOLS.WORK &&
                            !this.grid[s][minDay].isFixed && this.grid[s][minDay].symbol === SYMBOLS.OFF) {

                            this.setSymbol(s, maxDay, SYMBOLS.OFF, false);
                            this.setSymbol(s, minDay, SYMBOLS.WORK, false);

                            if (this.isStaffHardValid(s) && this.isGlobalAttributesValid()) {
                                swapped = true;
                                break outerDirect;
                            } else {
                                this.setSymbol(s, maxDay, SYMBOLS.WORK, false);
                                this.setSymbol(s, minDay, SYMBOLS.OFF, false);
                            }
                        }
                    }
                }
            }

            if (swapped) continue;

            // --- フェーズ2: 1.0スタッフと0.5スタッフの逆方向同時スワップ（差1.0の2日間を0.5移動して完全一致させる） ---
            const halfStaffIndices = [];
            const fullStaffIndices = [];
            for (let s = 0; s < this.numStaff; s++) {
                if (this.staffList[s].isUnused) continue;
                if (this.staffList[s].isHalf) halfStaffIndices.push(s);
                else fullStaffIndices.push(s);
            }

            if (halfStaffIndices.length > 0) {
                outerDiffSwap:
                for (const hItem of highDays) {
                    const maxDay = hItem.day;
                    for (const lItem of lowDays) {
                        const minDay = lItem.day;
                        if (maxDay === minDay) continue;
                        const gap = hItem.load - lItem.load;
                        // 差が 1.0 以上ある場合、1.0スタッフを maxDay->minDay、0.5スタッフを minDay->maxDay に動かすと正味 0.5 移動！
                        if (gap <= 0.51) continue;

                        // maxDay(○)->minDay(休) が可能な 1.0スタッフを探す
                        let validFullS = -1;
                        for (const fs of fullStaffIndices) {
                            if (!this.grid[fs][maxDay].isFixed && this.grid[fs][maxDay].symbol === SYMBOLS.WORK &&
                                !this.grid[fs][minDay].isFixed && this.grid[fs][minDay].symbol === SYMBOLS.OFF) {
                                this.setSymbol(fs, maxDay, SYMBOLS.OFF, false);
                                this.setSymbol(fs, minDay, SYMBOLS.WORK, false);
                                if (this.isStaffHardValid(fs)) {
                                    validFullS = fs;
                                }
                                this.setSymbol(fs, maxDay, SYMBOLS.WORK, false);
                                this.setSymbol(fs, minDay, SYMBOLS.OFF, false);
                                if (validFullS !== -1) break;
                            }
                        }
                        if (validFullS === -1) continue;

                        // minDay(○)->maxDay(休) が可能な 0.5スタッフを探す
                        for (const hs of halfStaffIndices) {
                            if (!this.grid[hs][minDay].isFixed && this.grid[hs][minDay].symbol === SYMBOLS.WORK &&
                                !this.grid[hs][maxDay].isFixed && this.grid[hs][maxDay].symbol === SYMBOLS.OFF) {
                                this.setSymbol(validFullS, maxDay, SYMBOLS.OFF, false);
                                this.setSymbol(validFullS, minDay, SYMBOLS.WORK, false);
                                this.setSymbol(hs, minDay, SYMBOLS.OFF, false);
                                this.setSymbol(hs, maxDay, SYMBOLS.WORK, false);

                                if (this.isStaffHardValid(validFullS) && this.isStaffHardValid(hs) && this.isGlobalAttributesValid()) {
                                    swapped = true;
                                    break outerDiffSwap;
                                } else {
                                    this.setSymbol(validFullS, maxDay, SYMBOLS.WORK, false);
                                    this.setSymbol(validFullS, minDay, SYMBOLS.OFF, false);
                                    this.setSymbol(hs, minDay, SYMBOLS.WORK, false);
                                    this.setSymbol(hs, maxDay, SYMBOLS.OFF, false);
                                }
                            }
                        }
                    }
                }
            }

            if (swapped) continue;

            // --- フェーズ3: 中継日(midDay)を介した2ステップ連鎖スワップ（異なる週の間でも週休2日を守って実数合計を平坦化） ---
            outerRelay:
            for (const hItem of highDays) {
                const maxDay = hItem.day;
                for (const lItem of lowDays) {
                    const minDay = lItem.day;
                    if (maxDay === minDay) continue;
                    const gap = hItem.load - lItem.load;
                    if (gap <= 0.51) continue;

                    // 中継日 midDay を探索
                    for (let midDay = 0; midDay < this.numDays; midDay++) {
                        if (midDay === maxDay || midDay === minDay) continue;

                        // 同じ重み w (1.0 または 0.5) のスタッフペア (s1: maxDay->midDay, s2: midDay->minDay) を探す
                        for (const targetW of [0.5, 1.0]) {
                            if (gap <= targetW + 0.01) continue;
                            const pool = targetW === 0.5 ? halfStaffIndices : fullStaffIndices;
                            if (pool.length < 2) continue;

                            let s1Found = -1;
                            for (const s1 of pool) {
                                if (!this.grid[s1][maxDay].isFixed && this.grid[s1][maxDay].symbol === SYMBOLS.WORK &&
                                    !this.grid[s1][midDay].isFixed && this.grid[s1][midDay].symbol === SYMBOLS.OFF) {
                                    this.setSymbol(s1, maxDay, SYMBOLS.OFF, false);
                                    this.setSymbol(s1, midDay, SYMBOLS.WORK, false);
                                    if (this.isStaffHardValid(s1)) {
                                        s1Found = s1;
                                    }
                                    this.setSymbol(s1, maxDay, SYMBOLS.WORK, false);
                                    this.setSymbol(s1, midDay, SYMBOLS.OFF, false);
                                    if (s1Found !== -1) break;
                                }
                            }
                            if (s1Found === -1) continue;

                            for (const s2 of pool) {
                                if (s2 === s1Found) continue;
                                if (!this.grid[s2][midDay].isFixed && this.grid[s2][midDay].symbol === SYMBOLS.WORK &&
                                    !this.grid[s2][minDay].isFixed && this.grid[s2][minDay].symbol === SYMBOLS.OFF) {
                                    // s1 と s2 を同時適用して検証
                                    this.setSymbol(s1Found, maxDay, SYMBOLS.OFF, false);
                                    this.setSymbol(s1Found, midDay, SYMBOLS.WORK, false);
                                    this.setSymbol(s2, midDay, SYMBOLS.OFF, false);
                                    this.setSymbol(s2, minDay, SYMBOLS.WORK, false);

                                    if (this.isStaffHardValid(s1Found) && this.isStaffHardValid(s2) && this.isGlobalAttributesValid()) {
                                        swapped = true;
                                        break outerRelay;
                                    } else {
                                        this.setSymbol(s1Found, maxDay, SYMBOLS.WORK, false);
                                        this.setSymbol(s1Found, midDay, SYMBOLS.OFF, false);
                                        this.setSymbol(s2, midDay, SYMBOLS.WORK, false);
                                        this.setSymbol(s2, minDay, SYMBOLS.OFF, false);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (!swapped) break;
        }
    }

    /**
     * 実数合計平準化パス（全体の実数合計の平坦化を最優先しつつ、各セクション内のバランスも整える）
     */
    balanceDailyWorkforce() {
        const sections = ['PT A', 'PT B', 'OT A', 'OT B', 'ST'];

        // 1. まず全体の実数合計（realWork）を徹底的に平坦化
        this.balanceGlobalWithOffsets();

        // 2. 全体の実数合計を悪化させない範囲で、各セクション内の実数も平準化
        sections.forEach(secName => {
            const secStaff = [];
            for (let s = 0; s < this.numStaff; s++) {
                if (!this.staffList[s].isUnused && this.staffList[s].section === secName) {
                    secStaff.push(s);
                }
            }
            if (secStaff.length > 0) {
                this.balanceGroupWorkforce(secStaff);
            }
        });

        const unassignedStaff = [];
        for (let s = 0; s < this.numStaff; s++) {
            if (!this.staffList[s].isUnused && !this.staffList[s].section) {
                unassignedStaff.push(s);
            }
        }
        if (unassignedStaff.length > 0) {
            this.balanceGroupWorkforce(unassignedStaff);
        }

        // 3. 最後に再度、全体の実数合計（realWork）を仕上げ平坦化
        this.balanceGlobalWithOffsets();

        // 連勤違反の自動リペアパス（公休数を変えずに同スタッフ内の余剰休日とスワップ）
        for (let s = 0; s < this.numStaff; s++) {
            if (this.staffList[s].isUnused) continue;
            if (!this.isStaffHardValid(s)) {
                const sequence = [];
                for (let i = 0; i < 5; i++) sequence.push(this.staffList[s].prevDays[i] || '');
                for (let d = 0; d < this.numDays; d++) sequence.push(this.grid[s][d].symbol);

                let consec = 0;
                let violationEnd = -1;
                const maxAllowed = this.staffList[s].allow6Consec ? 6 : 5;
                for (let idx = 0; idx < sequence.length; idx++) {
                    if (!isFullOffSymbol(sequence[idx])) {
                        consec++;
                        if (consec > maxAllowed) {
                            violationEnd = idx - 5;
                            break;
                        }
                    } else {
                        consec = 0;
                    }
                }

                if (violationEnd >= 0) {
                    for (let offset = 1; offset <= 3; offset++) {
                        const targetD = violationEnd - offset;
                        if (targetD < 0 || targetD >= this.numDays) continue;
                        if (this.grid[s][targetD].isFixed || this.grid[s][targetD].symbol !== SYMBOLS.WORK) continue;

                        let repaired = false;
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
                if (this.staffList[s].isUnused) continue;
                const sym = this.grid[s][d].symbol;
                if (this.staffList[s].canSched && sym === SYMBOLS.WORK) schedWork++;
                if ((this.staffList[s].isSectionChief || this.staffList[s].isChief) && isWorkSymbol(sym) && sym !== SYMBOLS.TRIP) roleWork++;
                if (this.staffList[s].isFullTime && isWorkSymbol(sym) && sym !== SYMBOLS.TRIP) ftWork++;
                if (this.staffList[s].can8 && isWorkSymbol(sym)) {
                    totalH8Cand++;
                    if (!this.staffList[s].canSched) pureH8Cand++;
                }
            }
            const totalSched = this.staffList.filter(s => !s.isUnused && s.canSched).length;
            if (totalSched >= 2 && schedWork < 2) return false;
            // 係長・主任のグローバル検証
            const scList = this.staffList.filter(s => !s.isUnused && s.isSectionChief);
            const chList = this.staffList.filter(s => !s.isUnused && s.isChief);
            const curD = (this.dates && this.dates[d]) ? this.dates[d] : null;
            const isWeekday = curD ? (curD.wIdx >= 0 && curD.wIdx <= 4) : ((d % 7) >= 0 && (d % 7) <= 4);
            if (scList.length > 0 && isWeekday) {
                let scWork = false;
                scList.forEach(sc => {
                    const sym = this.grid[this.staffList.indexOf(sc)][d].symbol;
                    if (!isHolidaySymbol(sym) && sym !== SYMBOLS.TRIP) scWork = true;
                });
                if (!scWork) {
                    let chWork = false;
                    chList.forEach(ch => {
                        const sym = this.grid[this.staffList.indexOf(ch)][d].symbol;
                        if (!isHolidaySymbol(sym) && sym !== SYMBOLS.TRIP) chWork = true;
                    });
                    if (chList.length > 0 && !chWork) return false;
                }
            }
            const totalFullTime = this.staffList.filter(s => !s.isUnused && s.isFullTime).length;
            if (totalFullTime >= 3 && ftWork < 3) return false;
            const totalH8 = this.staffList.filter(s => !s.isUnused && s.can8).length;
            if (totalH8 >= 1 && totalH8Cand < 1) return false;
            if (schedWork === 2 && pureH8Cand === 0 && totalH8 > 1) return false;
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
            if (this.staffList[s].isUnused) continue;
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
            if (staff.isUnused) continue;
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
            if (staff.isUnused) continue;
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
            if (staff.isUnused || staff.allow6Consec) continue;

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
            if (staff.isUnused || staff.allow6Consec) continue;

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
                if (staff.isUnused) continue;
                const sym = this.grid[s][d].symbol;

                // スケ可: 「○」で出勤している人のみカウント
                if (staff.canSched && sym === SYMBOLS.WORK) {
                    schedWorkCount++;
                }
                // 役職: 施設内出勤（出張「出」除く勤務）
                if ((staff.isSectionChief || staff.isChief) && isWorkSymbol(sym) && sym !== SYMBOLS.TRIP) {
                    roleWorkCount++;
                }
                // 専従: 施設内出勤（出張「出」除く勤務）
                if (staff.isFullTime && isWorkSymbol(sym) && sym !== SYMBOLS.TRIP) {
                    fullTimeWorkCount++;
                }
            }

            const totalSched = this.staffList.filter(s => !s.isUnused && s.canSched).length;
            if (totalSched >= 2 && schedWorkCount < 2) {
                errors.push(`【${dayNum}日目】「スケ可」スタッフの日勤（○）が${schedWorkCount}名しかいません（要件: 2名以上）。`);
            }
            // 係長平日出勤＆不在時主任出勤チェック
            const scStaff = this.staffList.filter(s => !s.isUnused && s.isSectionChief);
            const chStaff = this.staffList.filter(s => !s.isUnused && s.isChief);
            const subChStaff = this.staffList.filter(s => !s.isUnused && s.isSubChief);

            const curD = (this.dates && this.dates[d]) ? this.dates[d] : null;
            const isWeekday = curD ? (curD.wIdx >= 0 && curD.wIdx <= 4) : ((d % 7) >= 0 && (d % 7) <= 4);

            if (scStaff.length > 0 && isWeekday) {
                let scWorking = false;
                scStaff.forEach(sc => {
                    const scSIdx = this.staffList.indexOf(sc);
                    const sym = this.grid[scSIdx][d].symbol;
                    if (!isHolidaySymbol(sym) && sym !== SYMBOLS.TRIP) scWorking = true;
                });

                if (!scWorking) {
                    let chWorking = false;
                    chStaff.forEach(ch => {
                        const chSIdx = this.staffList.indexOf(ch);
                        const sym = this.grid[chSIdx][d].symbol;
                        if (!isHolidaySymbol(sym) && sym !== SYMBOLS.TRIP) chWorking = true;
                    });
                    if (chStaff.length > 0 && !chWorking) {
                        errors.push(`【${dayNum}日目】係長不在日ですが主任が出勤していません（主任を1名以上配置してください）。`);
                    }
                }
            }
            const totalFullTime = this.staffList.filter(s => !s.isUnused && s.isFullTime).length;
            if (totalFullTime >= 3 && fullTimeWorkCount < 3) {
                errors.push(`【${dayNum}日目】「専従」スタッフの出勤が${fullTimeWorkCount}名しかいません（要件: 3名以上、出張除く）。`);
            }
        }

        // 7. 各スタッフの公休日数チェック（8.0日, 8.5日, 9.0日、リフ複数取得・前借り等の柔軟運用を許容）
        for (let s = 0; s < this.numStaff; s++) {
            const staff = this.staffList[s];
            if (staff.isUnused) continue;
            let offDays = 0;
            let refDays = 0;
            for (let d = 0; d < this.numDays; d++) {
                const sym = this.grid[s][d].symbol;
                if (sym === SYMBOLS.OFF) offDays += 1.0;
                else if (sym === SYMBOLS.HALF_WORK_OFF || sym === SYMBOLS.HALF_OFF_WORK) offDays += 0.5;
                else if (SYMBOLS.REF_SUMMER.includes(sym) || SYMBOLS.REF_WINTER.includes(sym)) refDays += 1.0;
            }

            // 通常: offDays === standardHolidays (8.0日) でOK
            // リフ取得時: リフ1日で公休8日(計9日)、リフ複数・前借りで公休7〜8日(計9〜11日)など柔軟に合格判定
            const isStandardPass = (Math.abs(offDays - this.options.standardHolidays) < 0.01);
            const isRefPass = (refDays > 0 && (offDays + refDays >= 9.0 || (Math.abs(offDays + refDays - (this.options.standardHolidays + 1.0)) < 0.01)));

            if (Math.abs(this.options.standardHolidays - 8.5) < 0.01) {
                if (offDays !== 8.0 && offDays !== 9.0 && !isRefPass) {
                    errors.push(`【スタッフ No.${staff.id} ${staff.name}】公休日数が${offDays}日です（8.5日調整要件: 8日または9日）。`);
                }
            } else {
                if (!isStandardPass && !isRefPass) {
                    errors.push(`【スタッフ No.${staff.id} ${staff.name}】公休日数が${offDays}日です（標準要件: ${this.options.standardHolidays}日 / リフ込み計: ${offDays + refDays}日）。`);
                }
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
                if (this.staffList[s].isUnused) continue;
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
            const sectionWork = { 'PT A': 0, 'PT B': 0, 'OT A': 0, 'OT B': 0, 'その他': 0 };
            for (let s = 0; s < this.numStaff; s++) {
                if (this.staffList[s].isUnused) continue;
                const sym = this.grid[s][d].symbol;
                const sec = this.staffList[s].section || 'その他';
                let staffWorkAmt = 0;

                if (sym === SYMBOLS.EARLY) { early++; totalWork += 1.0; staffWorkAmt = 1.0; }
                else if (sym === SYMBOLS.LATE) { late++; totalWork += 1.0; staffWorkAmt = 1.0; }
                else if (sym === SYMBOLS.EVE) { eve++; totalWork += 1.0; staffWorkAmt = 1.0; }
                else if (sym === SYMBOLS.H8) { h8++; totalWork += 1.0; staffWorkAmt = 1.0; }
                else if (sym === SYMBOLS.WORK || sym === SYMBOLS.TRIP) { normal++; totalWork += 1.0; staffWorkAmt = 1.0; }
                else if (sym === SYMBOLS.OFF) { off += 1.0; }
                else if (sym === SYMBOLS.PAID) { paid += 1.0; }
                else if (SYMBOLS.REF_SUMMER.includes(sym) || SYMBOLS.REF_WINTER.includes(sym)) { ref += 1.0; }
                else if (sym === SYMBOLS.HALF_WORK_OFF || sym === SYMBOLS.HALF_OFF_WORK) {
                    totalWork += 0.5;
                    off += 0.5;
                    staffWorkAmt = 0.5;
                }
                else if (sym === SYMBOLS.HALF_WORK_PAID || sym === SYMBOLS.HALF_PAID_WORK) {
                    totalWork += 0.5;
                    paid += 0.5;
                    staffWorkAmt = 0.5;
                }

                if (staffWorkAmt > 0) {
                    if (sec in sectionWork) {
                        sectionWork[sec] += staffWorkAmt;
                    } else {
                        sectionWork['その他'] += staffWorkAmt;
                    }
                }
            }
            // 実数合計の計算 (案B: 出勤実働 - 増員分。マイナス/減員時は実数変更なし)
            let realWorkBase = 0;
            for (let s = 0; s < this.numStaff; s++) {
                if (this.staffList[s].isUnused) continue;
                const sym = this.grid[s][d].symbol;
                let amt = 0;
                if ([SYMBOLS.EARLY, SYMBOLS.LATE, SYMBOLS.EVE, SYMBOLS.H8, SYMBOLS.WORK, '〇', '◯', SYMBOLS.TRIP, SYMBOLS.NO_ALLOW_EARLY, SYMBOLS.NO_ALLOW_LATE, SYMBOLS.NO_ALLOW_EVE].includes(sym)) {
                    amt = 1.0;
                } else if (isHalfDuty(sym)) {
                    amt = 0.5;
                }
                if (amt > 0) {
                    const factor = this.staffList[s].isHalf ? 0.5 : 1.0;
                    realWorkBase += amt * factor;
                }
            }
            const offset = (this.dayOffsets && this.dayOffsets[d]) ? this.dayOffsets[d] : 0;
            const realWork = (offset > 0) ? Math.max(0, realWorkBase - offset) : realWorkBase;
            daily.push({ day: d + 1, totalWork, realWork, early, late, eve, h8, normal, off, paid, ref, sectionWork, offset });
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
                isUnused: !!this.staffList[s].isUnused,
                section: this.staffList[s].section || '',
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
    const dates = options.dates || null;
    const numDays = options.numDays || (dates ? dates.length : (grid && grid[0] ? grid[0].length : 28));
    const standardHolidays = options.standardHolidays !== undefined ? options.standardHolidays : 8.0;
    const isFinal = options.isFinal !== false;
    const weekSpans = getSunToSatWeekSpans(dates, numDays);

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
        if (staff.isUnused) continue;
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

        // F. 公休日数チェック（8.0日, 8.5日, 9.0日、リフ複数取得・前借り等の柔軟運用を許容）
        let offDays = 0;
        let refDays = 0;
        for (let d = 0; d < numDays; d++) {
            const sym = getSym(s, d);
            if (sym === SYMBOLS.OFF) offDays += 1.0;
            else if (sym === SYMBOLS.HALF_WORK_OFF || sym === SYMBOLS.HALF_OFF_WORK) offDays += 0.5;
            else if (SYMBOLS.REF_SUMMER.includes(sym) || SYMBOLS.REF_WINTER.includes(sym)) refDays += 1.0;
        }

        const isStandardPass = (Math.abs(offDays - standardHolidays) < 0.01);
        const isRefPass = (refDays > 0 && (offDays + refDays >= 9.0 || (Math.abs(offDays + refDays - (standardHolidays + 1.0)) < 0.01)));

        if (Math.abs(standardHolidays - 8.5) < 0.01) {
            if (offDays !== 8.0 && offDays !== 9.0 && !isRefPass) {
                const reason = `公休日数が${offDays}日です（8.5日調整要件: 8日または9日）`;
                errors.push(`【スタッフ No.${staff.id} ${staff.name}】${reason}。`);
                conflictCells.push({
                    staffIndex: s,
                    statType: 'off',
                    reason: reason
                });
            }
        } else {
            if (!isStandardPass && !isRefPass) {
                const reason = `公休日数が${offDays}日です（標準要件: ${standardHolidays}日 / リフ込み計: ${offDays + refDays}日）`;
                errors.push(`【スタッフ No.${staff.id} ${staff.name}】${reason}。`);
                conflictCells.push({
                    staffIndex: s,
                    statType: 'off',
                    reason: reason
                });
            }
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
            if (staff.isUnused) continue;
            const sym = getSym(s, d);

            if (staff.canSched && sym === SYMBOLS.WORK) schedWorkCount++;
            if ((staff.isSectionChief || staff.isChief) && isWorkSymbol(sym) && sym !== SYMBOLS.TRIP) roleWorkCount++;
            if (staff.isFullTime && isWorkSymbol(sym) && sym !== SYMBOLS.TRIP) fullTimeWorkCount++;

            if (sym === SYMBOLS.EARLY || sym === SYMBOLS.NO_ALLOW_EARLY) earlyCount++;
            if (sym === SYMBOLS.LATE || sym === SYMBOLS.NO_ALLOW_LATE) lateCount++;
            if (sym === SYMBOLS.EVE || sym === SYMBOLS.NO_ALLOW_EVE) eveCount++;
            if (sym === SYMBOLS.H8) h8Count++;
        }

        // スケ可: 日勤（○）が2名以上
        const totalSched = staffList.filter(s => !s.isUnused && s.canSched).length;
        if (totalSched >= 2 && schedWorkCount < 2) {
            errors.push(`【${dayNum}日目】「スケ可」スタッフの日勤（○）が${schedWorkCount}名しかいません（要件: 2名以上）。`);
            for (let s = 0; s < numStaff; s++) {
                if (!staffList[s].isUnused && staffList[s].canSched && getSym(s, d) !== SYMBOLS.WORK) {
                    addConflict(s, d, `${dayNum}日目: スケ可の日勤(○)が不足しています（現在:「${getSym(s, d) || '未設定'}」）`);
                }
            }
        }

        // 係長平日出勤＆不在時主任出勤チェック
        const scStaffFinal = staffList.filter(s => !s.isUnused && s.isSectionChief);
        const chStaffFinal = staffList.filter(s => !s.isUnused && s.isChief);
        const curDFinal = (dates && dates[d]) ? dates[d] : null;
        const isWeekdayFinal = curDFinal ? (curDFinal.wIdx >= 0 && curDFinal.wIdx <= 4) : ((d % 7) >= 0 && (d % 7) <= 4);

        if (scStaffFinal.length > 0 && isWeekdayFinal) {
            let scWorking = false;
            scStaffFinal.forEach(sc => {
                const sym = getSym(staffList.indexOf(sc), d);
                if (!isHolidaySymbol(sym) && sym !== SYMBOLS.TRIP) scWorking = true;
            });
            if (!scWorking) {
                let chWorking = false;
                chStaffFinal.forEach(ch => {
                    const sym = getSym(staffList.indexOf(ch), d);
                    if (!isHolidaySymbol(sym) && sym !== SYMBOLS.TRIP) chWorking = true;
                });
                if (chStaffFinal.length > 0 && !chWorking) {
                    errors.push(`【${dayNum}日目】係長不在日ですが主任が出勤していません（主任を1名以上配置してください）。`);
                }
            }
        }

        // 専従: 3名以上（出張除く）
        const totalFullTime = staffList.filter(s => !s.isUnused && s.isFullTime).length;
        if (totalFullTime >= 3 && fullTimeWorkCount < 3) {
            errors.push(`【${dayNum}日目】「専従」スタッフの出勤が${fullTimeWorkCount}名しかいません（要件: 3名以上、出張除く）。`);
        }

        // 特殊勤務人数チェック（早番3名, 遅番1名, E2名, 8時1名）
        if (isFinal) {
            // 最終チェック＆完成: 完全充足を厳格チェック
            if (earlyCount !== 3) {
                const reason = `${dayNum}日目の早番（早・ハヤ）が${earlyCount}名です（要件: 3名）`;
                errors.push(`【${dayNum}日目】${reason}。`);
                conflictCells.push({ dayIndex: d, footerStat: 'early', reason: reason });
            }
            if (lateCount !== 1) {
                const reason = `${dayNum}日目の遅番（遅・オソ）が${lateCount}名です（要件: 1名）`;
                errors.push(`【${dayNum}日目】${reason}。`);
                conflictCells.push({ dayIndex: d, footerStat: 'late', reason: reason });
            }
            if (eveCount !== 2) {
                const reason = `${dayNum}日目のイブニング（E・イブ）が${eveCount}名です（要件: 2名）`;
                errors.push(`【${dayNum}日目】${reason}。`);
                conflictCells.push({ dayIndex: d, footerStat: 'eve', reason: reason });
            }
            if (h8Count !== 1) {
                const reason = `${dayNum}日目の8時開始が${h8Count}名です（要件: 1名）`;
                errors.push(`【${dayNum}日目】${reason}。`);
                conflictCells.push({ dayIndex: d, footerStat: 'h8', reason: reason });
            }
        } else {
            // 修正作業エリア: 全日0名は許容するが、既に特殊勤務が入っている日での不足または超過は指摘＆網掛け
            if (earlyCount > 0 && earlyCount !== 3) {
                const reason = `${dayNum}日目の早番（早・ハヤ）が${earlyCount}名です（要件: 3名）`;
                errors.push(`【${dayNum}日目】${reason}。`);
                conflictCells.push({ dayIndex: d, footerStat: 'early', reason: reason });
            } else if (earlyCount > 3) {
                const reason = `${dayNum}日目の早番（早・ハヤ）が${earlyCount}名で定員超過です（要件: 3名）`;
                errors.push(`【${dayNum}日目】${reason}。`);
                conflictCells.push({ dayIndex: d, footerStat: 'early', reason: reason });
            }
            if (lateCount > 1) {
                const reason = `${dayNum}日目の遅番（遅・オソ）が${lateCount}名で定員超過です（要件: 1名）`;
                errors.push(`【${dayNum}日目】${reason}。`);
                conflictCells.push({ dayIndex: d, footerStat: 'late', reason: reason });
            }
            if (eveCount > 2) {
                const reason = `${dayNum}日目のイブニング（E・イブ）が${eveCount}名で定員超過です（要件: 2名）`;
                errors.push(`【${dayNum}日目】${reason}。`);
                conflictCells.push({ dayIndex: d, footerStat: 'eve', reason: reason });
            }
            if (h8Count > 1) {
                const reason = `${dayNum}日目の8時開始が${h8Count}名で定員超過です（要件: 1名）`;
                errors.push(`【${dayNum}日目】${reason}。`);
                conflictCells.push({ dayIndex: d, footerStat: 'h8', reason: reason });
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        conflictCells
    };
}

/**
 * リフレッシュ休暇設定
 */
const REFRESH_HOLIDAY_CONFIG = [
    { symbol: '上1', month: 6, season: 'summer', name: '夏リフ1 (6月)' },
    { symbol: '上2', month: 7, season: 'summer', name: '夏リフ2 (7月)' },
    { symbol: '上3', month: 8, season: 'summer', name: '夏リフ3 (8月)' },
    { symbol: '上4', month: 9, season: 'summer', name: '夏リフ4 (9月)' },
    { symbol: '上5', month: 10, season: 'summer', name: '夏リフ5 (10月)' },
    { symbol: '下1', month: 12, season: 'winter', name: '冬リフ1 (12月)' },
    { symbol: '下2', month: 1,  season: 'winter', name: '冬リフ2 (1月)' },
    { symbol: '下3', month: 2,  season: 'winter', name: '冬リフ3 (2月)' }
];

function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
}

function getTermRefreshGroups(dates) {
    if (!Array.isArray(dates) || dates.length === 0) return [];
    const groups = new Map();
    dates.forEach((dObj, dIdx) => {
        const m = dObj.month;
        const conf = REFRESH_HOLIDAY_CONFIG.find(c => c.month === m);
        if (conf) {
            if (!groups.has(conf.symbol)) {
                const totalMonthDays = getDaysInMonth(dObj.year, m);
                groups.set(conf.symbol, {
                    symbol: conf.symbol,
                    month: m,
                    season: conf.season,
                    name: conf.name,
                    year: dObj.year,
                    totalMonthDays: totalMonthDays,
                    dayIndices: []
                });
            }
            groups.get(conf.symbol).dayIndices.push(dIdx);
        }
    });
    return Array.from(groups.values());
}

/**
 * リフレッシュ休暇（リフ）の自動均等配分エンジン
 * @param {Array<Object>} staffList - スタッフ情報
 * @param {Array<Object>} dates - タームの日付情報
 * @param {Object} options - { obtainedHistory: Map/Object, allowOverride: boolean }
 * @returns {Object} { success, assignedCount, groupResults, assignments, message }
 */
function autoAssignRefreshHolidaysCore(staffList, dates, options = {}) {
    const groups = getTermRefreshGroups(dates);
    if (groups.length === 0) {
        return {
            success: true,
            assignedCount: 0,
            groupResults: [],
            assignments: [],
            message: 'この期間（ターム）にはリフレッシュ休暇の対象月が含まれていません。'
        };
    }

    const obtainedHistory = options.obtainedHistory || {}; // staffId -> Set of symbols or Array
    const assignments = [];
    const groupResults = [];
    let totalAssigned = 0;

    // 有効スタッフインデックス一覧
    const activeStaffIndices = [];
    staffList.forEach((st, idx) => {
        if (!st.isUnused) activeStaffIndices.push(idx);
    });
    const activeStaffCount = activeStaffIndices.length;

    // 日別の全体リフ配置人数カウント（平準化用）
    const dailyRefCount = new Array(dates.length).fill(0);
    // 既存の手動入力リフをカウント
    staffList.forEach((st, sIdx) => {
        if (st.isUnused) return;
        for (let d = 0; d < dates.length; d++) {
            const sym = st.days[d];
            if (SYMBOLS.REF_SUMMER.includes(sym) || SYMBOLS.REF_WINTER.includes(sym)) {
                dailyRefCount[d]++;
            }
        }
    });

    // 今タームで既にリフが割り振られているスタッフのSet（1人1ターム1リフの原則）
    const staffWithRefInCurrentTerm = new Set();
    staffList.forEach((st, sIdx) => {
        if (st.isUnused) return;
        for (let d = 0; d < dates.length; d++) {
            const sym = st.days[d];
            if (SYMBOLS.REF_SUMMER.includes(sym) || SYMBOLS.REF_WINTER.includes(sym)) {
                staffWithRefInCurrentTerm.add(sIdx);
                break;
            }
        }
    });

    // 各リフグループごとに均等配分
    for (const grp of groups) {
        const daysInTerm = grp.dayIndices.length;
        const targetCount = Math.round(activeStaffCount * (daysInTerm / grp.totalMonthDays));

        // 今タームで既に手動入力等でこのグループの記号を持っている人数
        let alreadyInTermForThisGroup = 0;
        staffList.forEach((st, sIdx) => {
            if (st.isUnused) return;
            for (const d of grp.dayIndices) {
                if (st.days[d] === grp.symbol) {
                    alreadyInTermForThisGroup++;
                    break;
                }
            }
        });

        const needToAssign = Math.max(0, targetCount - alreadyInTermForThisGroup);

        // 候補スタッフの抽出
        const candidates = [];
        for (const sIdx of activeStaffIndices) {
            // 今タームですでにリフを持っているスタッフは除外
            if (staffWithRefInCurrentTerm.has(sIdx)) continue;

            const st = staffList[sIdx];
            // 過去にこの記号を取得済みなら除外（二重取得防止！）
            const history = obtainedHistory[st.id] || obtainedHistory[sIdx];
            const hasObtained = (history instanceof Set) ? history.has(grp.symbol) : (Array.isArray(history) && history.includes(grp.symbol));
            if (hasObtained) continue;

            // 対象期間内に空欄セルがあるか
            const freeDays = grp.dayIndices.filter(d => st.days[d] === '');
            if (freeDays.length === 0) continue;

            candidates.push({
                sIdx,
                staff: st,
                freeDays
            });
        }

        // 候補者を属性均等に並び替え（偏りを抑える）
        candidates.sort((a, b) => {
            const weightA = ((a.staff.isSectionChief || a.staff.isChief) ? 2 : 0) + (a.staff.isFullTime ? 2 : 0) + (a.staff.canSched ? 1 : 0);
            const weightB = ((b.staff.isSectionChief || b.staff.isChief) ? 2 : 0) + (b.staff.isFullTime ? 2 : 0) + (b.staff.canSched ? 1 : 0);
            if (weightA !== weightB) return weightA - weightB;
            return a.staff.id - b.staff.id;
        });

        const toAssignCandidates = candidates.slice(0, needToAssign);
        let groupAssigned = 0;

        for (const cand of toAssignCandidates) {
            const sIdx = cand.sIdx;
            const st = cand.staff;

            // 最適日のスコアリング
            let bestDay = -1;
            let bestScore = -999999;

            for (const d of cand.freeDays) {
                let score = 100;

                // 1. 日別負荷平準化: すでにリフが入っている人数が多い日は減点
                score -= dailyRefCount[d] * 25;

                // 2. 連休ボーナス: 前後が休日なら加点
                if (d - 1 >= 0 && isHolidaySymbol(st.days[d - 1])) score += 30;
                if (d + 1 < dates.length && isHolidaySymbol(st.days[d + 1])) score += 30;
                if (d - 2 >= 0 && isHolidaySymbol(st.days[d - 2]) && isHolidaySymbol(st.days[d - 1])) score += 15;
                if (d + 2 < dates.length && isHolidaySymbol(st.days[d + 1]) && isHolidaySymbol(st.days[d + 2])) score += 15;

                // 3. 土日祝日の適正分散（土日だけに偏らないように平日も同等に評価）
                const dObj = dates[d];
                if (dObj.isSun || dObj.isSat || dObj.isHol) {
                    score += 5;
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestDay = d;
                }
            }

            if (bestDay !== -1) {
                st.days[bestDay] = grp.symbol;
                dailyRefCount[bestDay]++;
                staffWithRefInCurrentTerm.add(sIdx);
                assignments.push({
                    staffId: st.id,
                    staffIndex: sIdx,
                    staffName: st.name,
                    dayIndex: bestDay,
                    dateStr: dates[bestDay].label,
                    symbol: grp.symbol
                });
                groupAssigned++;
                totalAssigned++;
            }
        }

        groupResults.push({
            symbol: grp.symbol,
            month: grp.month,
            name: grp.name,
            daysInTerm: daysInTerm,
            totalMonthDays: grp.totalMonthDays,
            targetCount: targetCount,
            alreadyInTerm: alreadyInTermForThisGroup,
            assignedNow: groupAssigned,
            totalActive: activeStaffCount
        });
    }

    return {
        success: true,
        assignedCount: totalAssigned,
        groupResults: groupResults,
        assignments: assignments,
        message: totalAssigned > 0 
            ? `リフレッシュ休暇を ${totalAssigned} 名に日割り均等配分しました（重複なし・前ターム照合済）。`
            : `リフレッシュ休暇は既に必要人数分が割り当て済みです。`
    };
}

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ShiftScheduler,
        validateInitialState,
        validateScheduleGrid,
        autoAssignRefreshHolidaysCore,
        getTermRefreshGroups,
        REFRESH_HOLIDAY_CONFIG,
        SYMBOLS,
        isJapaneseHoliday
    };
} else {
    window.ShiftScheduler = ShiftScheduler;
    window.validateInitialState = validateInitialState;
    window.validateScheduleGrid = validateScheduleGrid;
    window.autoAssignRefreshHolidaysCore = autoAssignRefreshHolidaysCore;
    window.getTermRefreshGroups = getTermRefreshGroups;
    window.REFRESH_HOLIDAY_CONFIG = REFRESH_HOLIDAY_CONFIG;
    window.SYMBOLS = SYMBOLS;
    window.isJapaneseHoliday = isJapaneseHoliday;
}

