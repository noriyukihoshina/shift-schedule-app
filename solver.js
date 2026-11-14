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

// ★ 純粋な公休判定（公休間隔の切断判定用）
// ユーザー制約:「公休から公休の間は6までです。間にリフや有があってもNGです。」
// したがって、公休（休、半休）、および未在籍・対象外（-）のみが公休間隔をリセットできる。
// 有休やリフレッシュ休暇（上1〜5、下1〜3）は公休ではないため公休間隔をリセットしない！
function isPurePublicOffSymbol(sym) {
    if (!sym) return false;
    if (isExcludeSymbol(sym)) return true; // 対象外枠はカウント除外（リセット）
    if (sym === SYMBOLS.OFF) return true;
    if (sym === SYMBOLS.HALF_WORK_OFF || sym === SYMBOLS.HALF_OFF_WORK || sym === '○/休' || sym === '休/○' || sym === '〇/休' || sym === '休/〇') return true;
    return false;
}

// ★ 公休（休）およびリフレッシュ休暇（上/下）判定
function isFullOffSymbol(sym) {
    if (!sym) return false;
    if (isExcludeSymbol(sym)) return true;
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
    const isST = !!options.isST;
    const isLife = !!options.isLife;
    const numDays = options.numDays || (options.dates ? options.dates.length : 28);
    const weekSpans = getSunToSatWeekSpans(options.dates, numDays);

    // 1. 各スタッフごとの事前入力チェック
    staffList.forEach((staff, sIdx) => {
        if (staff.isUnused) return;

        // A. 個別フラグ違反チェック（係長に希望入力された特殊勤務はトグルに関わらず許可・保持）
        for (let d = 0; d < numDays; d++) {
            if (staff.isSectionChief) break;
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

        // B. 特殊勤務翌日休日チェック (早・遅・E・ハヤ・オソ・イブの翌日に勤務が入っている衝突 ※係長は翌日休不要、生活期も不要)
        if (!staff.isSectionChief && !isLife) {
            for (let d = 0; d < numDays - 1; d++) {
                const current = staff.days[d];
                const next = staff.days[d + 1];
                if (isRestrictedSpecial(current) && next && isWorkSymbol(next)) {
                    errors.push(`【スタッフ No.${staff.id} ${staff.name}】${d + 1}日目の「${current}」の翌日（${d + 2}日目）に勤務（${next}）が事前入力されています（早・遅・Eの翌日は原則休日が必要です）。`);
                    conflictCells.push({ staffIndex: sIdx, dayIndex: d, reason: `${d + 1}日目: 翌日が勤務になっているため早・遅・Eは原則不可` });
                    conflictCells.push({ staffIndex: sIdx, dayIndex: d + 1, reason: `${d + 2}日目: 前日が「${current}」のため原則休日にする必要があります` });
                }
            }
        }

        // C. 公休間隔・連勤チェック（★労基法・全スタッフ共通ハード制約: 公休から公休の間は最大6日以内。有休やリフがあってもリセット不可！）
        // ユーザー制約:「公休から公休の間は6までです。間にリフや有があってもNGです。全スタッフ共通の厳守事項です。」
        const maxAllowedConsec = staff.allow6Consec ? 6 : 5;
        const fullInitSeq = [];
        const pLen = (staff.prevDays && staff.prevDays.length) ? staff.prevDays.length : 0;
        const firstDateObj = (options && options.dates && options.dates[0]) ? new Date(options.dates[0].dateStr + 'T00:00:00') : null;
        if (pLen > 0) {
            for (let p = 0; p < pLen; p++) {
                let pSym = staff.prevDays[p] || '';
                let isSatOrSun = false;
                if (firstDateObj) {
                    const prevD = new Date(firstDateObj);
                    prevD.setDate(prevD.getDate() - (pLen - p));
                    const dow = prevD.getDay();
                    if (dow === 0 || dow === 6) isSatOrSun = true;
                } else {
                    if (pLen === 7 && (p === 3 || p === 4)) isSatOrSun = true;
                    if (pLen === 5 && (p === 1 || p === 2)) isSatOrSun = true;
                }
                if (staff.isSectionChief && isSatOrSun && isWorkSymbol(pSym)) pSym = SYMBOLS.OFF;
                fullInitSeq.push({ d: -pLen + p, sym: pSym, isPrev: true });
            }
        }
        for (let d = 0; d < numDays; d++) {
            fullInitSeq.push({ d: d, sym: staff.days[d] || '', isPrev: false });
        }

        let nonPureOffItems = [];
        for (let i = 0; i < fullInitSeq.length; i++) {
            const item = fullInitSeq[i];
            const sym = item.sym;
            if (sym && !isPurePublicOffSymbol(sym)) {
                nonPureOffItems.push(item);
                if (nonPureOffItems.length > 6) {
                    const sLabel = nonPureOffItems[0].isPrev ? `前${-nonPureOffItems[0].d}日` : `${nonPureOffItems[0].d + 1}日目`;
                    const eLabel = item.isPrev ? `前${-item.d}日` : `${item.d + 1}日目`;
                    errors.push(`【スタッフ No.${staff.id} ${staff.name}】${sLabel}〜${eLabel}で公休（休）のない連続期間が${nonPureOffItems.length}日となっています（労基法・全スタッフ共通ハード制約: 公休から公休の間は最大6日以内です。有休やリフは公休にあたりません）。`);
                    nonPureOffItems.forEach(it => {
                        if (!it.isPrev) {
                            conflictCells.push({ staffIndex: sIdx, dayIndex: it.d, reason: `公休間隔が上限(6日)を超えているため公休(休)を挟んでください（有休・リフは公休に含まれません）` });
                        }
                    });
                }
            } else if (isPurePublicOffSymbol(sym)) {
                nonPureOffItems = [];
            }
        }

        // D. 5連勤後の2連休ルールチェック（6連勤可フラグOFFのスタッフのみ。係長は土日希望出勤時の単休＋平日代休を柔軟許容）
        if (!staff.allow6Consec && !staff.isSectionChief) {
            const seq = [];
            for (let p = 0; p < pLen; p++) seq.push((staff.prevDays && staff.prevDays[p]) || '');
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
                                const targetDay = checkIdx - pLen + 1; // 1-based day index
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
                // ★ 生活期テーブルは事前希望優先（土日出勤時もエラー不要）
                if (weekWorkCount >= 6 && !isLife) {
                    const sDay = wSpan[0] + 1;
                    const eDay = wSpan[wSpan.length - 1] + 1;
                    errors.push(`【スタッフ No.${staff.id} ${staff.name}】第${wIdx + 1}週（${sDay}日目〜${eDay}日目の日〜土）に出勤が${weekWorkCount}日指定されています（週休2日が必要です。出張・半休を除く）。`);
                    workDaysInWeek.forEach(d => {
                        conflictCells.push({ staffIndex: sIdx, dayIndex: d, reason: `日〜土の週に出勤が6日以上含まれるため休日を入れてください` });
                    });
                }
            });
        }
        // F. 個人別の希望公休（休）過多チェック
        const stdHol = options.standardHolidays !== undefined ? options.standardHolidays : 8.0;
        let wishPublicOff = 0;
        const wishHolidayDays = [];
        for (let d = 0; d < numDays; d++) {
            const sym = staff.days[d];
            if (!sym) continue;
            if (sym === SYMBOLS.OFF) {
                wishPublicOff += 1.0;
                wishHolidayDays.push(d);
            } else if (sym === SYMBOLS.HALF_WORK_OFF || sym === SYMBOLS.HALF_OFF_WORK) {
                wishPublicOff += 0.5;
                wishHolidayDays.push(d);
            } else if (isHolidaySymbol(sym) || isHalfDuty(sym)) {
                wishHolidayDays.push(d);
            }
        }
        if (wishPublicOff > stdHol + 0.01 && !(staff.isSectionChief && wishPublicOff <= stdHol + 4.0)) {
            errors.push(`【スタッフ No.${staff.id} ${staff.name}】事前希望の公休（休）が${wishPublicOff}日入力されており、基準公休日数（${stdHol}日）を超過しています。`);
            wishHolidayDays.forEach(d => {
                conflictCells.push({
                    staffIndex: sIdx,
                    dayIndex: d,
                    reason: `希望公休数が基準(${stdHol}日)を超過しています（現在:${wishPublicOff}日）`
                });
            });
        }
    });

    // 希望休（休・有・上1〜5・下1〜3・半休）判定ヘルパー
    const isWishLeaveSymbol = (sym) => {
        if (!sym) return false;
        return isHolidaySymbol(sym) || isHalfDuty(sym);
    };

    // 2. 日別の事前枠超過・希望休過多・属性別出勤可能数チェック
    for (let d = 0; d < numDays; d++) {
        const dayNum = d + 1;
        let earlyStaff = [], lateStaff = [], eveStaff = [], h8Staff = [];
        let holidayStaff = [];
        let schedAvailable = 0, roleAvailable = 0, fullTimeAvailable = 0, can8Available = 0;

        staffList.forEach((staff, sIdx) => {
            if (staff.isUnused) return;
            const sym = staff.days[d];
            // ★ 特殊勤務（早・遅・E）のカウントには、手当のつかないハヤ・オソ・イブは含めない
            if (sym === SYMBOLS.EARLY) earlyStaff.push(sIdx);
            if (sym === SYMBOLS.LATE) lateStaff.push(sIdx);
            if (sym === SYMBOLS.EVE) eveStaff.push(sIdx);
            if (sym === SYMBOLS.H8) h8Staff.push(sIdx);
            if (isWishLeaveSymbol(sym) || isExcludeSymbol(sym)) {
                if (isWishLeaveSymbol(sym)) holidayStaff.push(sIdx);
            } else {
                // 出勤可能スタッフ（空欄または出勤系記号）
                // スケ可は「○」で出勤できる必要があるため、特殊勤務や出張が事前固定されている場合はスケ可日勤(○)としてカウントしない
                if (staff.canSched && (!sym || sym === SYMBOLS.WORK || sym === '〇' || sym === '◯')) schedAvailable++;
                if ((staff.isSectionChief || staff.isChief) && sym !== SYMBOLS.TRIP) roleAvailable++;
                if (staff.isFullTime && sym !== SYMBOLS.TRIP) fullTimeAvailable++;
                if (staff.can8 && !staff.isSectionChief && (!sym || sym === SYMBOLS.WORK || sym === '〇' || sym === '◯' || sym === SYMBOLS.H8)) can8Available++;
            }
        });

        if (!isST && !isLife) {
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
                    conflictCells.push({ staffIndex: sIdx, dayIndex: d, reason: `${dayNum}日目: 希望休（休・有・上・下）が多すぎます。出勤に変更可能なスタッフを調整してください。` });
                });
            }

            // 属性充足チェック（事前希望休の重複で物理的に不足する場合、該当日に希望休[休・有・上・下]が入っている全対象スタッフにブルー網掛けを付与）
            const totalSched = staffList.filter(s => !s.isUnused && s.canSched).length;
            if (totalSched >= 2 && schedAvailable < 2) {
                errors.push(`【${dayNum}日目】「スケ可」スタッフの出勤可能人数が${schedAvailable}名しかおらず、必要数（2名以上）を満たせません（スケ可スタッフの希望休重複をご確認ください）。`);
                staffList.forEach((st, sIdx) => {
                    if (st.isUnused || !st.canSched) return;
                    const sym = st.days[d];
                    if (isWishLeaveSymbol(sym) || (sym && sym !== SYMBOLS.WORK)) {
                        conflictCells.push({
                            staffIndex: sIdx,
                            dayIndex: d,
                            reason: `⚠️ ${dayNum}日目: スケ可スタッフの希望休（${sym}）が重複し、スケ可2名以上を満たせません`
                        });
                    }
                });
            }

            const totalCan8 = staffList.filter(s => !s.isUnused && !s.isSectionChief && s.can8).length;
            // ★ 生活期テーブルでは土日は8時勤務が不要（定数0名）のため、平日の場合のみ8時可充足チェックを実施
            const di = (options.dates && options.dates[d]) ? options.dates[d] : null;
            const isWeekendDay = di ? (di.wIdx === 5 || di.wIdx === 6) : ((d % 7 === 5) || (d % 7 === 6));
            const isH8RequiredDay = isLife ? !isWeekendDay : true;

            if (isH8RequiredDay && totalCan8 >= 1 && can8Available < 1) {
                errors.push(`【${dayNum}日目】「8時可」スタッフの出勤可能人数が0名となっており、8時勤務（1名）を配置できません（8時可スタッフの希望休重複をご確認ください）。`);
                staffList.forEach((st, sIdx) => {
                    if (st.isUnused || st.isSectionChief || !st.can8) return;
                    const sym = st.days[d];
                    if (isWishLeaveSymbol(sym) || (sym && sym !== SYMBOLS.WORK && sym !== SYMBOLS.H8)) {
                        conflictCells.push({
                            staffIndex: sIdx,
                            dayIndex: d,
                            reason: `⚠️ ${dayNum}日目: 8時可スタッフ全員に希望休（${sym}）等が重なっており、8時勤務を配置できません`
                        });
                    }
                });
            }
        }

        // 係長・主任・副主任の充足チェック
        const sectionChiefs = staffList.filter(s => !s.isUnused && s.isSectionChief);
        const chiefs = staffList.filter(s => !s.isUnused && s.isChief);
        const subChiefs = staffList.filter(s => !s.isUnused && s.isSubChief);

        const dates = options.dates;
        const curDateInfo = (dates && dates[d]) ? dates[d] : null;
        const isWeekday = curDateInfo ? (curDateInfo.wIdx >= 0 && curDateInfo.wIdx <= 4) : ((d % 7) >= 0 && (d % 7) <= 4);

        // ★ 役職者出勤制約: STテーブル単独では制約なし。生活期も制約なし。POテーブルでは係長・主任・副主任の出勤を求めるが、ST役職者が出勤していれば条件クリア可能
        if (!options.isST && !options.isLife && (sectionChiefs.length > 0 || chiefs.length > 0)) {
            // 係長は平日は原則出勤、土日は原則休み（土日は希望の○等が入っている場合のみ出勤扱い）
            let scAvailableCount = 0;
            sectionChiefs.forEach(sc => {
                const sym = sc.days[d];
                if (isWeekday) {
                    if (!isWishLeaveSymbol(sym) && sym !== SYMBOLS.TRIP && !isExcludeSymbol(sym)) {
                        scAvailableCount++;
                    }
                } else {
                    if (sym && isWorkSymbol(sym) && sym !== SYMBOLS.TRIP && !isHalfDuty(sym)) {
                        scAvailableCount++;
                    }
                }
            });

            // 係長が不在（土日、または平日の希望休・有・リフ・出張等）の日の場合
            if (scAvailableCount === 0) {
                let chiefAvailableCount = 0;
                chiefs.forEach(ch => {
                    const sym = ch.days[d];
                    if (!isWishLeaveSymbol(sym) && sym !== SYMBOLS.TRIP && !isExcludeSymbol(sym)) {
                        chiefAvailableCount++;
                    }
                });

                // ★ ST主任が出勤しているかチェック（同階STの主任が出勤ならOK）
                const hasStChiefOnDay = options.stChiefWorkingDays && options.stChiefWorkingDays.has(d);
                if (hasStChiefOnDay) {
                    chiefAvailableCount++;
                }

                if (chiefAvailableCount < 1) {
                    // 主任も全員不在の場合、副主任がAチーム(PT A/OT A)とBチーム(PT B/OT B)どちらも出勤可能かチェック
                    let subAAvailable = 0, subBAvailable = 0;
                    subChiefs.forEach(sub => {
                        const sym = sub.days[d];
                        if (!isWishLeaveSymbol(sym) && sym !== SYMBOLS.TRIP && !isExcludeSymbol(sym)) {
                            const sec = sub.section || '';
                            if (sec === 'PT A' || sec === 'OT A' || sec.includes('A') || sec.includes('2')) subAAvailable++;
                            else if (sec === 'PT B' || sec === 'OT B' || sec.includes('B') || sec.includes('3')) subBAvailable++;
                        }
                    });

                    // ★ PT/OTの副主任がAかBに1人いれば、STの副主任を含めて条件クリア
                    const hasStSubChiefOnDay = options.stSubChiefWorkingDays && options.stSubChiefWorkingDays.has(d);
                    const subABOk = (subAAvailable >= 1 && subBAvailable >= 1) || (hasStSubChiefOnDay && (subAAvailable >= 1 || subBAvailable >= 1));

                    if (!subABOk) {
                        errors.push(`【${dayNum}日目】係長・主任ともに不在ですが、副主任（Aチーム・Bチーム両方、またはST副主任連携）の出勤可能者が不足しています（主任1名以上、または副主任を配置してください）。`);
                        // その日に希望休（休・有・上・下・半休・出張）が入っている係長・主任・副主任すべてにブルー網掛けを付与
                        staffList.forEach((st, sIdx) => {
                            if (st.isUnused) return;
                            if (st.isSectionChief || st.isChief || st.isSubChief) {
                                const sym = st.days[d];
                                if (isWishLeaveSymbol(sym) || sym === SYMBOLS.TRIP) {
                                    conflictCells.push({
                                        staffIndex: sIdx,
                                        dayIndex: d,
                                        reason: `⚠️ ${dayNum}日目: 役職者（係長・主任・副主任A/B）の希望休（${sym}）が重なり、役職者不在となっています`
                                    });
                                }
                            }
                        });
                    }
                }
            }
        }

        const totalFullTime = staffList.filter(s => !s.isUnused && s.isFullTime).length;
        const reqFT = options.isST ? 2 : (totalFullTime >= 4 ? 3 : (totalFullTime >= 2 ? 2 : 1));
        const isFullTimeDeficient = (totalFullTime >= reqFT && fullTimeAvailable < reqFT);
        if (isFullTimeDeficient) {
            if (!options.isST) {
                errors.push(`【${dayNum}日目】「専従」スタッフの出勤可能人数が${fullTimeAvailable}名しかおらず、必要数（${reqFT}名以上）を満たせません（専従スタッフの希望休重複をご確認ください）。`);
            } else {
                errors.push(`【${dayNum}日目】ST「専従」スタッフの出勤可能人数が${fullTimeAvailable}名しかおらず、必要数（2名）を満たせません（専従スタッフの希望休重複をご確認ください）。`);
            }
            staffList.forEach((st, sIdx) => {
                if (st.isUnused || !st.isFullTime) return;
                const sym = st.days[d];
                if (isWishLeaveSymbol(sym) || sym === SYMBOLS.TRIP) {
                    conflictCells.push({
                        staffIndex: sIdx,
                        dayIndex: d,
                        reason: `⚠️ ${dayNum}日目: 専従スタッフの希望休（${sym}）が重なり、専従必要数（${options.isST ? 2 : 3}名以上）を満たせません`
                    });
                }
            });
        }

        // ★ STテーブル専用: 日別各階（1階, 2階, 3階, 南）の「スケ可」出勤可能者チェック
        if (options.isST) {
            const floors = [
                { id: '1F', label: '1階' },
                { id: '2F', label: '2階' },
                { id: '3F', label: '3階' },
                { id: '南', label: '南' }
            ];
            floors.forEach(fl => {
                const flSchedStaff = [];
                let flSchedAvail = 0;
                staffList.forEach((st, sIdx) => {
                    if (st.isUnused) return;
                    const matchFl = (st.floor === fl.id || (st.floor && st.floor.includes(fl.label)) || st.floor === fl.label);
                    if (matchFl && st.canSched) {
                        flSchedStaff.push(sIdx);
                        const sym = st.days[d];
                        if (!isWishLeaveSymbol(sym) && sym !== SYMBOLS.TRIP && !isExcludeSymbol(sym)) {
                            flSchedAvail++;
                        }
                    }
                });

                if (flSchedStaff.length > 0 && flSchedAvail < 1) {
                    errors.push(`【${dayNum}日目】ST ${fl.label}（${fl.id}）の「スケ可」スタッフが全員希望休等のため、出勤可能なスケ可スタッフが0名です（各階毎日1名以上のスケ可スタッフの出勤が必要です）。`);
                    flSchedStaff.forEach(sIdx => {
                        const sym = staffList[sIdx].days[d];
                        if (isWishLeaveSymbol(sym) || sym === SYMBOLS.TRIP) {
                            conflictCells.push({
                                staffIndex: sIdx,
                                dayIndex: d,
                                reason: `⚠️ ${dayNum}日目: ${fl.label} スケ可スタッフ全員に希望休（${sym}）が重なり、スケ可出勤（各階1名以上）を満たせません`
                            });
                        }
                    });
                }
            });
        }
    }

    // ★ STテーブル専用: スケ可が各階（1階, 2階, 3階, 南）に1名以上配置されているか初期制約チェック
    if (options.isST) {
        const targetFloors = [
            { id: '1F', label: '1階' },
            { id: '2F', label: '2階' },
            { id: '3F', label: '3階' },
            { id: '南', label: '南' }
        ];
        targetFloors.forEach(fl => {
            const floorSchedCount = staffList.filter(s => !s.isUnused && (s.floor === fl.id || (s.floor && s.floor.includes(fl.label)) || s.floor === fl.label) && s.canSched).length;
            if (floorSchedCount < 1) {
                errors.push(`【ST階別制約エラー】${fl.label}（${fl.id}）に「スケ可」スタッフが1名も配置されていません。各階に1名以上の「スケ可」スタッフを設定してください。`);
            }
        });
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
        this.isST = !!(options && options.isST) || !!(this.options && this.options.isST);
        this.isSouth = !!(options && options.isSouth) || !!(this.options && this.options.isSouth);
        this.isLife = !!(options && options.isLife) || !!(this.options && this.options.isLife);
        // ★ 各フロア所属STスタッフの日別出勤実数（PT・OTの配分均等化時にST実数を加味）
        this.stDailyWork = (Array.isArray(options.stDailyWork) && options.stDailyWork.length === this.numDays)
            ? [...options.stDailyWork]
            : null;
        // ★ 各フロア所属STスタッフの日別出勤人数（頭数：0.5トグルの人でも出勤人数は1）
        this.stDailyHeadCount = (Array.isArray(options.stDailyHeadCount) && options.stDailyHeadCount.length === this.numDays)
            ? [...options.stDailyHeadCount]
            : null;
        this.stDailyFtWork = (Array.isArray(options.stDailyFtWork) && options.stDailyFtWork.length === this.numDays)
            ? [...options.stDailyFtWork]
            : null;
        this.stDailyEarly = (Array.isArray(options.stDailyEarly) && options.stDailyEarly.length === this.numDays)
            ? [...options.stDailyEarly]
            : null;
        this.stDailyLate = (Array.isArray(options.stDailyLate) && options.stDailyLate.length === this.numDays)
            ? [...options.stDailyLate]
            : null;
        this.stDailyEve = (Array.isArray(options.stDailyEve) && options.stDailyEve.length === this.numDays)
            ? [...options.stDailyEve]
            : null;
        this.stFloorFtCount = typeof options.stFloorFtCount === 'number' ? options.stFloorFtCount : 0;
        // ★ 生活期テーブルからのハ応援実数（ハ1→1F, ハ2→2F, ハ3→3F, ハ南→南）
        this.lifeDailyWork = (Array.isArray(options.lifeDailyWork) && options.lifeDailyWork.length === this.numDays)
            ? [...options.lifeDailyWork]
            : null;
        this.initGrid();
    }

    /**
     * 南病棟におけるスタッフ s の所属サブフロア（南2 or 南3）を取得
     */
    getSubFloor(s) {
        const st = this.staffList[s];
        if (!st) return (s % 2 === 0) ? '南2' : '南3';
        const sec = st.section || '';
        if (sec.includes('2') || sec === 'PT A' || sec === 'OT A') return '南2';
        if (sec.includes('3') || sec === 'PT B' || sec === 'OT B') return '南3';
        return (s % 2 === 0) ? '南2' : '南3';
    }

    /**
     * 日インデックス d の日付表示ラベル（例: "4/10"）を取得
     */
    formatDateLabel(d) {
        if (this.dates && this.dates[d]) {
            const item = this.dates[d];
            if (typeof item === 'object') {
                if (item.label) return item.label;
                if (item.m && item.day) return `${item.m}/${item.day}`;
                if (item.month && item.day) return `${item.month}/${item.day}`;
            } else if (typeof item === 'string') {
                const parts = item.split('-');
                if (parts.length === 3) return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
                return item;
            } else if (item instanceof Date) {
                return `${item.getMonth() + 1}/${item.getDate()}`;
            }
        }
        return `${d + 1}日目`;
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
        const staff = this.staffList[s];
        // ★ 0トグルON、または生活期の管理・Cl1は実数0としてカウント！
        if (staff.isZeroCount || staff.lifeSection === '管理' || staff.lifeSection === 'Cl1') {
            return 0;
        }
        // ★ ハ1〜ハ南のトグルON者は自動的に実数0.5換算（0.5トグルの有無はハーフマンには使用しない）
        const isHaDuty = !!(staff.haSection && ['ハ1', 'ハ2', 'ハ3', 'ハ4', 'ハ南'].includes(staff.haSection));
        const factor = (staff.isHalf || isHaDuty) ? 0.5 : 1.0;
        return amt * factor;
    }

    /**
     * 当日 d の出勤実数ベース合計（加減枠適用前）を取得
     * ★ ST実数（所属階STスタッフの実数）も合算してPT・OTの配分平準化に反映！
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
            if (this.stDailyWork && this.stDailyWork[d]) {
                base += this.stDailyWork[d];
            }
            if (this.lifeDailyWork && this.lifeDailyWork[d]) {
                base += this.lifeDailyWork[d];
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

    /**
     * 日 d が平日（月〜金: wIdx 0〜4）かどうかを判定（祝日は関係なく月〜金が平日）
     */
    isWeekdayIndex(d) {
        const curDateInfo = (this.dates && this.dates[d]) ? this.dates[d] : null;
        return curDateInfo ? (curDateInfo.wIdx >= 0 && curDateInfo.wIdx <= 4) : ((d % 7) >= 0 && (d % 7) <= 4);
    }

    /**
     * 係長(isSectionChief)について、土日だけで必要公休数を満たせるか（平日に未固定の「休」を入れる必要があるか）を計算
     * 土日の未固定枠数 >= 残り必要公休数 なら、平日に未固定の「休」は一切入れない（月〜金完全出勤・土日休）
     */
    getMaxAllowedUnfixedWeekdayOffForSectionChief(s) {
        const staff = this.staffList[s];
        if (!staff || !staff.isSectionChief) return this.numDays;
        let weekendFixedWorkCount = 0;
        let preSpecialNextWeekdayOffCount = 0;
        let fixedOff = 0;
        let availableWeekendSlots = 0;
        for (let d = 0; d < this.numDays; d++) {
            const isWkday = this.isWeekdayIndex(d);
            if (this.grid[s][d].isFixed || this.grid[s][d].isAfterPreSpecial) {
                const sym = this.grid[s][d].symbol;
                if (sym === SYMBOLS.OFF) fixedOff += 1.0;
                else if (sym === SYMBOLS.HALF_WORK_OFF || sym === SYMBOLS.HALF_OFF_WORK) fixedOff += 0.5;
                if (!isWkday && isWorkSymbol(sym)) weekendFixedWorkCount++;
                if (isWkday && this.grid[s][d].isAfterPreSpecial) preSpecialNextWeekdayOffCount++;
            } else if (!isWkday) {
                availableWeekendSlots += 1;
            }
        }
        const neededUnfixedOff = Math.max(0, Math.round(this.options.standardHolidays - fixedOff));
        return Math.max(neededUnfixedOff - availableWeekendSlots, weekendFixedWorkCount + preSpecialNextWeekdayOffCount);
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
            const pDays = this.staffList[s].prevDays;
            if (!pDays) return '';
            const pIdx = d + pDays.length;
            return (pIdx >= 0 && pIdx < pDays.length) ? (pDays[pIdx] || '') : '';
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

        // 3. 特殊勤務（早・遅・E・ハヤ・オソ・イブ）の配置可否判定（※係長は翌日休不要のため除外）
        if (!staff.isSectionChief) {
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

        // 前ターム末尾の最後の公休位置（-pLen 〜 -1、無ければ -(pLen+1)）
        const pDays = this.staffList[s].prevDays || [];
        const pLen = pDays.length;
        let lastPrevHol = -pLen - 1;
        for (let p = pLen - 1; p >= 0; p--) {
            if (isFullOffSymbol(pDays[p])) {
                lastPrevHol = p - pLen;
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
        const isWeekday = this.isWeekdayIndex(d);

        // ★ 最優先ハード制約1: 係長は祝日に関係なく月曜日〜金曜日（平日）に出勤（土日で公休が足りる限り平日は絶対に休みにしない）
        if (staff.isSectionChief && isWeekday) {
            const maxWeekdayOff = this.getMaxAllowedUnfixedWeekdayOffForSectionChief(s);
            if (maxWeekdayOff <= 0) {
                return false; // 平日は休みにしない（月〜金5連勤・土日休）
            }
        }

        // ★ 最優先ハード制約2: 係長不在時は主任を出勤にする。主任も難しければ副主任をAとBどちらも出勤させる（A/BはPT・OTどちらも可）
        let scWorking = false;
        let hasActiveSc = false;
        for (let otherS = 0; otherS < this.numStaff; otherS++) {
            if (this.staffList[otherS].isUnused) continue;
            if (this.staffList[otherS].isSectionChief) {
                hasActiveSc = true;
                const sym = this.grid[otherS][d].symbol;
                if (!isHolidaySymbol(sym) && sym !== SYMBOLS.TRIP && !isExcludeSymbol(sym)) {
                    scWorking = true;
                    break;
                }
            }
        }

        const checkSubChiefABAvailable = (excludeS = -1) => {
            let subA = 0, subB = 0;
            for (let otherS = 0; otherS < this.numStaff; otherS++) {
                if (otherS === excludeS || this.staffList[otherS].isUnused || !this.staffList[otherS].isSubChief) continue;
                const sym = this.grid[otherS][d].symbol;
                if (!isHolidaySymbol(sym) && sym !== SYMBOLS.TRIP && !isExcludeSymbol(sym)) {
                    const sec = this.staffList[otherS].section || '';
                    if (sec === 'PT A' || sec === 'OT A') subA++;
                    else if (sec === 'PT B' || sec === 'OT B') subB++;
                }
            }
            return subA >= 1 && subB >= 1;
        };

        // 係長不在時（平日・土日とも）はまず主任を最低1名出勤維持（どうしても主任が出勤困難な場合は副主任A・B両方が揃う日のみフォールバック許容）
        if (staff.isChief && (!hasActiveSc || !scWorking)) {
            let otherChiefWorking = false;
            for (let otherS = 0; otherS < this.numStaff; otherS++) {
                if (otherS === s || this.staffList[otherS].isUnused) continue;
                if (this.staffList[otherS].isChief) {
                    const sym = this.grid[otherS][d].symbol;
                    if (!isHolidaySymbol(sym) && sym !== SYMBOLS.TRIP && !isExcludeSymbol(sym)) {
                        otherChiefWorking = true;
                        break;
                    }
                }
            }
            if (!otherChiefWorking) {
                if (strictLevel === 0) return false;
                if (!checkSubChiefABAvailable(s)) return false;
            }
        }

        // ★ 制約3: 副主任保護（係長・主任がともに不在の時は、Aチーム[PT A/OT A]に1名以上かつBチーム[PT B/OT B]に1名以上の副主任をどちらも必ず出勤維持）
        if (staff.isSubChief) {
            let chiefWorking = false;
            for (let otherS = 0; otherS < this.numStaff; otherS++) {
                if (this.staffList[otherS].isUnused || !this.staffList[otherS].isChief) continue;
                const sym = this.grid[otherS][d].symbol;
                if (!isHolidaySymbol(sym) && sym !== SYMBOLS.TRIP && !isExcludeSymbol(sym)) {
                    chiefWorking = true;
                    break;
                }
            }
            if ((!hasActiveSc || !scWorking) && !chiefWorking) {
                const sec = staff.section || '';
                const isTeamA = (sec === 'PT A' || sec === 'OT A');
                const isTeamB = (sec === 'PT B' || sec === 'OT B');
                if (isTeamA || isTeamB) {
                    let otherTeamSubWorking = 0;
                    for (let otherS = 0; otherS < this.numStaff; otherS++) {
                        if (otherS === s || this.staffList[otherS].isUnused) continue;
                        if (!this.staffList[otherS].isSubChief) continue;
                        const oSec = this.staffList[otherS].section || '';
                        const sameTeam = isTeamA ? (oSec === 'PT A' || oSec === 'OT A') : (oSec === 'PT B' || oSec === 'OT B');
                        if (sameTeam) {
                            const sym = this.grid[otherS][d].symbol;
                            if (!isHolidaySymbol(sym) && sym !== SYMBOLS.TRIP && !isExcludeSymbol(sym)) {
                                otherTeamSubWorking++;
                            }
                        }
                    }
                    if (otherTeamSubWorking < 1) return false;
                }
            }
        }

        if (strictLevel >= 2) return true; // 上記の係長・主任ハード制約を守った上で個人制約を優先

        const reqSched = strictLevel === 1 ? 2 : 3;
        const reqCan8 = strictLevel === 1 ? 1 : 2;
        const reqFt = strictLevel === 1 ? 2 : 3;

        // 1. スケ可保護：当日dに出勤できる「スケ可」スタッフを維持
        if (staff.canSched) {
            let available = 0;
            for (let otherS = 0; otherS < this.numStaff; otherS++) {
                if (otherS === s || this.staffList[otherS].isUnused) continue;
                if (this.staffList[otherS].canSched && !isHolidaySymbol(this.grid[otherS][d].symbol)) {
                    available++;
                }
            }
            const totalSched = this.staffList.filter(st => !st.isUnused && st.canSched).length;
            const minKeep = Math.min(reqSched, totalSched);
            if (available < minKeep) return false;
        }
        // 1-2. 8時可保護：当日dに出勤できる「8時可」スタッフ（係長除く）を維持
        if (staff.can8 && !staff.isSectionChief) {
            let available = 0;
            for (let otherS = 0; otherS < this.numStaff; otherS++) {
                if (otherS === s || this.staffList[otherS].isUnused || this.staffList[otherS].isSectionChief) continue;
                if (this.staffList[otherS].can8 && !isHolidaySymbol(this.grid[otherS][d].symbol)) {
                    available++;
                }
            }
            const totalCan8 = this.staffList.filter(st => !st.isUnused && !st.isSectionChief && st.can8).length;
            const minKeep = Math.min(reqCan8, totalCan8);
            if (available < minKeep) return false;
        }
        // 3. 専従保護：当日dに出勤できる「専従」スタッフ（出張除く）を維持
        if (staff.isFullTime) {
            let available = 0;
            for (let otherS = 0; otherS < this.numStaff; otherS++) {
                if (otherS === s || this.staffList[otherS].isUnused) continue;
                if (this.staffList[otherS].isFullTime && !isHolidaySymbol(this.grid[otherS][d].symbol) && this.grid[otherS][d].symbol !== SYMBOLS.TRIP) {
                    available++;
                }
            }
            const totalFullTime = this.staffList.filter(st => !st.isUnused && st.isFullTime).length;
            const minKeep = Math.min(reqFt, totalFullTime);
            if (available < minKeep) return false;
        }
        return true;
    }

    /**
     * ★ ST専用スケジュール自動生成メイン
     */
    solveST(options = {}) {
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

        // ステップ1: 事前入力されている特殊勤務（早）の翌日を休日に設定
        this.ensureHolidaysAfterPreAssignedSpecials();

        // ステップ2: 各フロア（1F, 2F, 3F, 南）ごとに公休日数（8日/8.5日）を均等配分（各階毎日2〜3名出勤、全社11〜12名出勤を数学的保証）
        this.assignHolidaysForST();

        // ステップ2.5: 早番配置前に各フロアの実数を事前平準化スワップ（1.5や3.0の極端な偏りを根絶）
        this.balanceWorkforceForST();

        // ステップ3: 特殊勤務「早」を各人3回ずつ割り当て（公休日の前日に配置して翌日休を100%保証）
        // ★ 基本勤務表生成（solveBaseSchedule）時は早番を入れず、特殊勤務配置時（assignSpecialDutiesToGrid）のみ実行
        if (options && options.assignSpecial === true) {
            this.assignEarlyDutiesForST();
        }

        // ステップ4: スケ可スタッフの出勤保証（各階で毎日1名以上のスケ可スタッフを出勤維持）
        this.ensureSchedCoverageForST();

        // ステップ4.5: 専従スタッフの出勤平準化（全階合計で毎日2名が出勤）
        this.ensureFullTimeCoverageForST();

        // ステップ5: 平準化スワップ（希望休や固定枠による歪みがある場合のみ微調整）
        this.balanceWorkforceForST();

        return {
            success: true,
            grid: this.grid,
            stats: this.calculateStats()
        };
    }

    /**
     * ST用公休割当：各フロア（1F, 2F, 3F, 南）内で土日祝関係なく毎日均等に出勤するように公休を配置
     * - 各階4名に黄金ローテーションパターンを適用（連勤3〜4日、毎日2〜3名出勤、スケ可毎日出勤を完全保証）
     * - フロアごとに開始日を1日ずつシフトし、全社合計で毎日11〜12名出勤（ブレ幅わずか1名）を達成
     */
    assignHolidaysForST() {
        const floors = ['1F', '2F', '3F', '南'];
        const stdHols = this.options.standardHolidays;

        // 黄金公休パターン（各人8日公休、スケ可0と1は完全直交、フロア出勤は毎日2〜3名）
        const basePatterns = [
            [0, 3, 7, 10, 14, 17, 21, 24], // idx 0 (スケ可A)
            [2, 5, 9, 12, 16, 19, 23, 26], // idx 1 (スケ可B: 0と絶対に被らない)
            [1, 4, 8, 11, 15, 18, 22, 25], // idx 2
            [3, 6, 10, 13, 17, 20, 24, 27] // idx 3
        ];

        floors.forEach((fl, fIdx) => {
            const floorStaff = [];
            for (let s = 0; s < this.numStaff; s++) {
                if (!this.staffList[s].isUnused && this.staffList[s].floor === fl) {
                    floorStaff.push(s);
                }
            }
            if (floorStaff.length === 0) return;

            // スケ可スタッフを idx 0 と idx 1 に配置
            floorStaff.sort((a, b) => {
                const sA = this.staffList[a].canSched ? 1 : 0;
                const sB = this.staffList[b].canSched ? 1 : 0;
                return sB - sA;
            });

            const floorShift = fIdx; // フロアごとに1日ずつシフト

            floorStaff.forEach((s, idxInFloor) => {
                let currentOff = 0;
                // ★ ユーザー指示: リフレッシュ休暇(上/下)や有休は公休とは別枠！純粋な公休「休」だけで必ず8日満額配置する！
                for (let d = 0; d < this.numDays; d++) {
                    const sym = this.grid[s][d].symbol;
                    if (sym === SYMBOLS.OFF) currentOff += 1.0;
                    else if (sym === '○/休' || sym === '休/○' || sym === '〇/休' || sym === '休/〇') currentOff += 0.5;
                }

                const pattern = basePatterns[idxInFloor % 4];
                const targetDays = pattern.map(d => (d + floorShift) % this.numDays);

                // パターンの公休日を優先配置
                targetDays.forEach(d => {
                    if (currentOff >= stdHols) return;
                    if (this.grid[s][d].isFixed || this.grid[s][d].symbol !== '') return;

                    this.setSymbol(s, d, SYMBOLS.OFF, false);
                    currentOff++;
                });

                // まだ足りない場合の安全配置
                while (currentOff < stdHols) {
                    let bestDay = -1;
                    let bestFloorLoad = -999;
                    for (let d = 0; d < this.numDays; d++) {
                        if (this.grid[s][d].isFixed || this.grid[s][d].symbol !== '') continue;
                        let flLoad = 0;
                        floorStaff.forEach(oS => {
                            if (!isHolidaySymbol(this.grid[oS][d].symbol)) flLoad++;
                        });
                        if (flLoad > bestFloorLoad) {
                            bestFloorLoad = flLoad;
                            bestDay = d;
                        }
                    }
                    if (bestDay >= 0) {
                        this.setSymbol(s, bestDay, SYMBOLS.OFF, false);
                        currentOff++;
                    } else {
                        break;
                    }
                }

                // 残りの空き枠をすべて「○（日勤）」で確定
                for (let d = 0; d < this.numDays; d++) {
                    if (this.grid[s][d].symbol === '') {
                        this.setSymbol(s, d, SYMBOLS.WORK, false);
                    }
                }
            });
        });

        // フロア未設定のスタッフがいれば同様に確定
        for (let s = 0; s < this.numStaff; s++) {
            if (this.staffList[s].isUnused) continue;
            for (let d = 0; d < this.numDays; d++) {
                if (this.grid[s][d].symbol === '') {
                    this.setSymbol(s, d, SYMBOLS.WORK, false);
                }
            }
        }
    }

    /**
     * ST用特殊勤務割当：特殊勤務は「早」のみで、各スタッフに3回ずつ割り振る（翌日休）
     * - 各スタッフには公休日が8日あるため、その直前日（計8箇所）の中から3日を選定して「早」に設定
     * - 各フロア内で早番が同日に重ならないよう分散し、全スタッフ確実に3回配置
     */
    assignEarlyDutiesForST() {
        const floors = ['1F', '2F', '3F', '南'];
        const counts = new Array(this.numStaff).fill(0);
        const lastAssigned = new Array(this.numStaff).fill(-10);

        // 事前入力された早番をカウント
        for (let s = 0; s < this.numStaff; s++) {
            if (this.staffList[s].isUnused) continue;
            for (let d = 0; d < this.numDays; d++) {
                if (this.grid[s][d].symbol === SYMBOLS.EARLY || this.grid[s][d].symbol === SYMBOLS.NO_ALLOW_EARLY) {
                    counts[s]++;
                    lastAssigned[s] = Math.max(lastAssigned[s], d);
                }
            }
        }

        floors.forEach((fl, fIdx) => {
            const floorStaff = [];
            for (let s = 0; s < this.numStaff; s++) {
                if (!this.staffList[s].isUnused && this.staffList[s].floor === fl && !this.staffList[s].noEarly) {
                    floorStaff.push(s);
                }
            }
            if (floorStaff.length === 0) return;

            floorStaff.forEach(s => {
                const needed = 3 - counts[s];
                if (needed <= 0) return;

                // 翌日（d+1）が休日である出勤日 d をすべて抽出
                const preOffDays = [];
                for (let d = 0; d < this.numDays; d++) {
                    if (this.grid[s][d].isFixed || this.grid[s][d].symbol !== SYMBOLS.WORK) continue;
                    if (d + 1 < this.numDays && isHolidaySymbol(this.grid[s][d + 1].symbol)) {
                        preOffDays.push(d);
                    } else if (d === this.numDays - 1) {
                        preOffDays.push(d); // 最終日
                    }
                }

                // preOffDays の中から、フロア内の他の早番と重ならず、均等に分散する3日を選択
                const candidates = preOffDays.map(d => {
                    let flEarly = 0;
                    floorStaff.forEach(oS => {
                        if (oS !== s && this.grid[oS][d].symbol === SYMBOLS.EARLY) flEarly++;
                    });
                    let totalEarly = 0;
                    for (let oS = 0; oS < this.numStaff; oS++) {
                        if (oS !== s && this.grid[oS][d].symbol === SYMBOLS.EARLY) totalEarly++;
                    }
                    return { d, flEarly, totalEarly };
                });

                // フロア内早番重複なし（flEarly === 0）を最優先、次に全体早番が少ない日
                candidates.sort((a, b) => {
                    if (a.flEarly !== b.flEarly) return a.flEarly - b.flEarly;
                    return a.totalEarly - b.totalEarly;
                });

                for (const cand of candidates) {
                    if (counts[s] >= 3) break;
                    if (Math.abs(cand.d - lastAssigned[s]) >= 4) {
                        this.setSymbol(s, cand.d, SYMBOLS.EARLY, false);
                        counts[s]++;
                        lastAssigned[s] = cand.d;
                    }
                }

                // まだ足りない場合は間隔制約を緩和して割り当て
                if (counts[s] < 3) {
                    for (const cand of candidates) {
                        if (counts[s] >= 3) break;
                        if (this.grid[s][cand.d].symbol === SYMBOLS.WORK) {
                            this.setSymbol(s, cand.d, SYMBOLS.EARLY, false);
                            counts[s]++;
                            lastAssigned[s] = cand.d;
                        }
                    }
                }
            });
        });
    }

    /**
     * ST用スケ可出勤保証：各階（1F, 2F, 3F, 南）で毎日少なくとも1名のスケ可スタッフが出勤することを保証
     */
    ensureSchedCoverageForST() {
        const floors = ['1F', '2F', '3F', '南'];

        floors.forEach(fl => {
            const schedStaff = [];
            for (let s = 0; s < this.numStaff; s++) {
                if (!this.staffList[s].isUnused && this.staffList[s].floor === fl && this.staffList[s].canSched) {
                    schedStaff.push(s);
                }
            }
            if (schedStaff.length < 1) return; // スケ可スタッフがフロアに1名以上いる場合に保証

            for (let d = 0; d < this.numDays; d++) {
                let workingCount = 0;
                schedStaff.forEach(s => {
                    const sym = this.grid[s][d].symbol;
                    if (isWorkSymbol(sym)) workingCount++;
                });

                // もしそのフロアのスケ可スタッフが0名なら、別の日（2名以上出勤している日）と公休をスワップして1名を出勤にする
                if (workingCount === 0) {
                    for (const s of schedStaff) {
                        if (this.grid[s][d].isFixed) continue;
                        // s の公休を○に変更できるか、かつ別の出勤日 otherD を公休にスワップ
                        let swapped = false;
                        for (let otherD = 0; otherD < this.numDays; otherD++) {
                            if (otherD === d || this.grid[s][otherD].isFixed || !isWorkSymbol(this.grid[s][otherD].symbol)) continue;

                            // otherD に他のスケ可スタッフが出勤しているか
                            let otherDayCount = 0;
                            schedStaff.forEach(oS => {
                                if (oS !== s && isWorkSymbol(this.grid[oS][otherD].symbol)) otherDayCount++;
                            });
                            if (otherDayCount < 1) continue; // otherD も1名未満になってしまうなら不可

                            // スワップ試行: dを○にし、otherDを休にする
                            const oldDSym = this.grid[s][d].symbol;
                            const oldOtherSym = this.grid[s][otherD].symbol;

                            this.setSymbol(s, d, SYMBOLS.WORK, false);
                            this.setSymbol(s, otherD, SYMBOLS.OFF, false);

                            if (this.isStaffHardValid(s)) {
                                swapped = true;
                                break;
                            } else {
                                this.setSymbol(s, d, oldDSym, false);
                                this.setSymbol(s, otherD, oldOtherSym, false);
                            }
                        }
                        if (swapped) break;
                    }
                }
            }
        });
    }

    /**
     * ST専用: 専従（isFullTime）スタッフの出勤平準化
     * 要望: 「専従は全ての階合計で2名が出勤するようにする」
     */
    ensureFullTimeCoverageForST() {
        const fullTimeStaff = [];
        for (let s = 0; s < this.numStaff; s++) {
            if (!this.staffList[s].isUnused && this.staffList[s].isFullTime) {
                fullTimeStaff.push(s);
            }
        }
        if (fullTimeStaff.length === 0) return;

        const TARGET_DAILY_FULLTIME = 2;
        if (fullTimeStaff.length <= TARGET_DAILY_FULLTIME) {
            return;
        }

        for (let d = 0; d < this.numDays; d++) {
            const workingFt = fullTimeStaff.filter(s => isWorkSymbol(this.grid[s][d].symbol));
            const offFt = fullTimeStaff.filter(s => isFullOffSymbol(this.grid[s][d].symbol) && !this.grid[s][d].isFixed);

            if (workingFt.length < TARGET_DAILY_FULLTIME && offFt.length > 0) {
                const need = TARGET_DAILY_FULLTIME - workingFt.length;
                for (let k = 0; k < need && k < offFt.length; k++) {
                    const s = offFt[k];
                    let swapped = false;
                    for (let otherD = 0; otherD < this.numDays; otherD++) {
                        if (otherD === d) continue;
                        if (!isWorkSymbol(this.grid[s][otherD].symbol) || this.grid[s][otherD].isFixed) continue;
                        const otherFtWorkCount = fullTimeStaff.filter(otherS => isWorkSymbol(this.grid[otherS][otherD].symbol)).length;
                        if (otherFtWorkCount > TARGET_DAILY_FULLTIME) {
                            const symWork = this.grid[s][otherD].symbol === '早' ? '早' : '○';
                            this.grid[s][d] = { symbol: symWork, isFixed: false };
                            this.grid[s][otherD] = { symbol: '休', isFixed: false };
                            swapped = true;
                            break;
                        }
                    }
                    if (!swapped) {
                        for (let otherD = 0; otherD < this.numDays; otherD++) {
                            if (otherD === d) continue;
                            if (!isWorkSymbol(this.grid[s][otherD].symbol) || this.grid[s][otherD].isFixed) continue;
                            const symWork = this.grid[s][otherD].symbol === '早' ? '早' : '○';
                            this.grid[s][d] = { symbol: symWork, isFixed: false };
                            this.grid[s][otherD] = { symbol: '休', isFixed: false };
                            break;
                        }
                    }
                }
            } else if (workingFt.length > TARGET_DAILY_FULLTIME) {
                const excess = workingFt.length - TARGET_DAILY_FULLTIME;
                for (let k = 0; k < excess && k < workingFt.length; k++) {
                    const s = workingFt[k];
                    if (this.grid[s][d].isFixed) continue;

                    for (let otherD = 0; otherD < this.numDays; otherD++) {
                        if (otherD === d) continue;
                        if (!isFullOffSymbol(this.grid[s][otherD].symbol) || this.grid[s][otherD].isFixed) continue;

                        const otherFtWorkCount = fullTimeStaff.filter(otherS => isWorkSymbol(this.grid[otherS][otherD].symbol)).length;
                        if (otherFtWorkCount < TARGET_DAILY_FULLTIME) {
                            const origSym = this.grid[s][d].symbol;
                            this.grid[s][d] = { symbol: '休', isFixed: false };
                            this.grid[s][otherD] = { symbol: origSym, isFixed: false };
                            break;
                        }
                    }
                }
            }
        }
    }

    /**
     * ST用平準化スワップ：各フロア内の日別出勤人数および全フロア合計出勤人数を土日祝関係なく毎日均等に平準化
     */
    balanceWorkforceForST() {
        const floors = ['1F', '2F', '3F', '南'];

        // ★ ユーザー指示: STテーブルの平均化は出勤人数（頭数）ではなく「実数（0.5トグル考慮）」で行う！
        const getSTRealWork = (s, d) => {
            const sym = this.grid[s][d].symbol;
            if (!isWorkSymbol(sym)) return 0.0;
            if (this.staffList[s].isZeroCount) return 0.0;
            if (this.staffList[s].isHalf || sym.includes('/')) return 0.5;
            return 1.0;
        };

        // 1. 各フロア内での実数平準化（極端な不足日1.5や超過日3.0を完全根絶しブレ幅を最小化）
        floors.forEach(fl => {
            const floorStaff = [];
            for (let s = 0; s < this.numStaff; s++) {
                if (!this.staffList[s].isUnused && this.staffList[s].floor === fl) {
                    floorStaff.push(s);
                }
            }
            if (floorStaff.length <= 1) return;

            for (let iter = 0; iter < 150; iter++) {
                let improved = false;
                const dailyLoads = [];
                for (let d = 0; d < this.numDays; d++) {
                    let realSum = 0;
                    floorStaff.forEach(s => { realSum += getSTRealWork(s, d); });
                    dailyLoads.push({ d, realSum });
                }

                const maxDayObj = dailyLoads.reduce((max, cur) => cur.realSum > max.realSum ? cur : max, dailyLoads[0]);
                const minDayObj = dailyLoads.reduce((min, cur) => cur.realSum < min.realSum ? cur : min, dailyLoads[0]);
                if (maxDayObj.realSum - minDayObj.realSum <= 0.5) break; // ブレ幅0.5以内なら達成！

                // 超過日 (実数2.5超: 3.5や3.0) と 不足日 (実数2.0以下: 1.5や2.0) を優先ペアリング
                const highDays = dailyLoads.filter(x => x.realSum > 2.5).sort((a, b) => b.realSum - a.realSum);
                const lowDays = dailyLoads.filter(x => x.realSum <= 2.0).sort((a, b) => a.realSum - b.realSum);

                // 日付の近いペアから優先的にスワップ試行
                const candidatePairs = [];
                for (const h of highDays) {
                    for (const l of lowDays) {
                        candidatePairs.push({ h: h.d, l: l.d, dist: Math.abs(h.d - l.d) });
                    }
                }
                candidatePairs.sort((a, b) => a.dist - b.dist);

                for (const pair of candidatePairs) {
                    for (const s of floorStaff) {
                        if (this.grid[s][pair.h].isFixed || this.grid[s][pair.l].isFixed) continue;
                        const symH = this.grid[s][pair.h].symbol;
                        const symL = this.grid[s][pair.l].symbol;
                        if (!isWorkSymbol(symH) || symL !== SYMBOLS.OFF) continue;

                        // スケ可保護: pair.h から s が抜けても残りのスケ可スタッフがいるか
                        if (this.staffList[s].canSched) {
                            let remSched = 0;
                            floorStaff.forEach(oS => {
                                if (oS !== s && this.staffList[oS].canSched && isWorkSymbol(this.grid[oS][pair.h].symbol)) {
                                    remSched++;
                                }
                            });
                            if (remSched < 1) continue;
                        }

                        // スワップ試行
                        const nextSymL = (symH === '早') ? '早' : SYMBOLS.WORK;
                        this.setSymbol(s, pair.h, SYMBOLS.OFF, false);
                        this.setSymbol(s, pair.l, nextSymL, false);

                        if (this.isStaffHardValid(s)) {
                            improved = true;
                            break;
                        } else {
                            this.setSymbol(s, pair.h, symH, false);
                            this.setSymbol(s, pair.l, symL, false);
                        }
                    }
                    if (improved) break;
                }
                if (!improved) {
                    // 距離ソートで届かなかった場合、超過日(realSum >= 3.0)と全公休日でフォールバックスワップ探索
                    for (let dH = 0; dH < this.numDays; dH++) {
                        let rH = 0;
                        floorStaff.forEach(s => { rH += getSTRealWork(s, dH); });
                        if (rH < 3.0) continue;

                        for (let dL = 0; dL < this.numDays; dL++) {
                            if (dH === dL) continue;
                            let rL = 0;
                            floorStaff.forEach(s => { rL += getSTRealWork(s, dL); });
                            if (rL > 2.0) continue;

                            for (const s of floorStaff) {
                                if (this.grid[s][dH].isFixed || this.grid[s][dL].isFixed) continue;
                                const symH = this.grid[s][dH].symbol;
                                const symL = this.grid[s][dL].symbol;
                                if (!isWorkSymbol(symH) || symL !== SYMBOLS.OFF) continue;

                                if (this.staffList[s].canSched) {
                                    let remSched = 0;
                                    floorStaff.forEach(oS => {
                                        if (oS !== s && this.staffList[oS].canSched && isWorkSymbol(this.grid[oS][dH].symbol)) {
                                            remSched++;
                                        }
                                    });
                                    if (remSched < 1) continue;
                                }

                                const nextSymL = (symH === '早') ? '早' : SYMBOLS.WORK;
                                this.setSymbol(s, dH, SYMBOLS.OFF, false);
                                this.setSymbol(s, dL, nextSymL, false);

                                if (this.isStaffHardValid(s)) {
                                    improved = true;
                                    break;
                                } else {
                                    this.setSymbol(s, dH, symH, false);
                                    this.setSymbol(s, dL, symL, false);
                                }
                            }
                            if (improved) break;
                        }
                        if (improved) break;
                    }
                }
                if (!improved) break;
            }
        });

        // 2. 4フロア合計出勤実数の平準化（各フロアの実数を崩さず全体実数のブレ幅を最小化）
        for (let iter = 0; iter < 120; iter++) {
            let improved = false;
            const dailyTotals = [];
            for (let d = 0; d < this.numDays; d++) {
                let realSum = 0;
                for (let s = 0; s < this.numStaff; s++) {
                    if (!this.staffList[s].isUnused) realSum += getSTRealWork(s, d);
                }
                dailyTotals.push({ d, realSum });
            }
            dailyTotals.sort((a, b) => b.realSum - a.realSum);

            const highD = dailyTotals[0];
            const lowD = dailyTotals[dailyTotals.length - 1];
            if (highD.realSum - lowD.realSum <= 0.5) break;

            for (let s = 0; s < this.numStaff; s++) {
                if (this.staffList[s].isUnused) continue;
                if (this.grid[s][highD.d].isFixed || this.grid[s][lowD.d].isFixed) continue;
                if (this.grid[s][highD.d].symbol !== SYMBOLS.WORK || this.grid[s][lowD.d].symbol !== SYMBOLS.OFF) continue;

                const fl = this.staffList[s].floor;

                // フロア出勤実数の範囲チェック（1.5〜3.0実数を維持）
                let flRealHigh = 0;
                let flRealLow = 0;
                for (let oS = 0; oS < this.numStaff; oS++) {
                    if (oS !== s && !this.staffList[oS].isUnused && this.staffList[oS].floor === fl) {
                        flRealHigh += getSTRealWork(oS, highD.d);
                    }
                    if (!this.staffList[oS].isUnused && this.staffList[oS].floor === fl) {
                        flRealLow += getSTRealWork(oS, lowD.d);
                    }
                }
                if (flRealHigh < 1.5 || flRealLow >= 3.0) continue;

                // スケ可保護
                if (this.staffList[s].canSched) {
                    let remSched = 0;
                    for (let oS = 0; oS < this.numStaff; oS++) {
                        if (oS !== s && !this.staffList[oS].isUnused && this.staffList[oS].floor === fl && this.staffList[oS].canSched) {
                            if (isWorkSymbol(this.grid[oS][highD.d].symbol)) remSched++;
                        }
                    }
                    if (remSched < 1) continue;
                }

                this.setSymbol(s, highD.d, SYMBOLS.OFF, false);
                this.setSymbol(s, lowD.d, SYMBOLS.WORK, false);

                if (this.isStaffHardValid(s)) {
                    improved = true;
                    break;
                } else {
                    this.setSymbol(s, highD.d, SYMBOLS.WORK, false);
                    this.setSymbol(s, lowD.d, SYMBOLS.OFF, false);
                }
            }
            if (!improved) break;
        }
    }

    /**
     * ★ 生活期専用スケジュール自動生成メイン
     * - Group A（土日休み固定）: 訪問, 管理, Cl1, ハ1, ハ2
     *   ※事前希望（〇, 出張, イブ等）最優先、エラー不要
     * - Group B（日曜休み固定＋平日分散公休）: 通所, Cl2, ハ3, ハ4(ハ南)
     *   ※事前希望最優先、日曜日以外の公休は平日の任意の場所に分散配置
     * - 8時勤務: 訪問スタッフのみ必要、can8がONの訪問スタッフに平日毎日1名配置
     * - 早・遅・E: 配置不要
     * - スケジュール: 不要
     */
        /**
     * 生活期専用ソルバー (solveLife)
     * - Pattern A (土日休): 訪問, 管理, Cl1, ハ1, ハ2, または「土日休」トグルON
     * - Pattern B (日休＋平日分散): 通所, Cl2, ハ3, ハ4/ハ南, または「日休」トグルON
     * - 公休8日厳格死守（9日になるバグを完全解消）
     * - CL2（2名）の平日公休が重ならない直交・交互配置
     * - 通所＋CL2の月〜土出勤人数・実数の均等平準化
     * - 訪問の月〜金（平日）に毎日1名8時勤務を均等選出
     */
    solveLife(options = {}) {
        const stdHols = this.options.standardHolidays || 8;
        const dates = this.dates || [];

        // 1. 各スタッフの事前希望枠を初期設定（土日固定・日曜固定を事前反映）
        for (let s = 0; s < this.numStaff; s++) {
            const staff = this.staffList[s];
            if (staff.isUnused) continue;

            const sec = staff.lifeSection || '';
            const ha = staff.haSection || '';
            // Group A（土日休み固定）: 訪問, 管理, Cl1, ハ1, ハ2
            const isPatA = !!staff.isSatSunOff || (!staff.isSunOff && (sec === '訪問' || sec === '管理' || sec === 'Cl1' || ha === 'ハ1' || ha === 'ハ2'));
            // Group B（日曜休み固定＋平日分散公休）: 通所, Cl2, ハ3, ハ南
            const isPatB = !isPatA && (!!staff.isSunOff || (sec === '通所' || sec === 'Cl2' || ha === 'ハ3' || ha === 'ハ南' || ha === 'ハ4'));

            for (let d = 0; d < this.numDays; d++) {
                const wish = (staff.days && staff.days[d]) ? staff.days[d] : '';
                if (wish) {
                    this.grid[s][d] = {
                        symbol: wish.replace(/[◦•･◯〇●]/g, '○'),
                        isFixed: true,
                        isOriginalWish: true
                    };
                } else {
                    const di = dates[d];
                    const isSun = di ? (di.wIdx === 6) : (d % 7 === 6);
                    const isSat = di ? (di.wIdx === 5) : (d % 7 === 5);

                    if (isPatA && (isSat || isSun)) {
                        this.grid[s][d] = { symbol: SYMBOLS.OFF, isFixed: true };
                    } else if (isPatB && isSun) {
                        this.grid[s][d] = { symbol: SYMBOLS.OFF, isFixed: true };
                    } else {
                        this.grid[s][d] = { symbol: '', isFixed: false };
                    }
                }
            }
        }

        // 2. 全スタッフの基本勤務表を solveStaffScheduleWeekly（厳格CSPソルバー）で生成！
        for (let s = 0; s < this.numStaff; s++) {
            if (this.staffList[s].isUnused) continue;
            const maxConsec = this.staffList[s].allow6Consec ? 6 : 5;
            const solved = this.solveStaffScheduleWeekly(s, stdHols, maxConsec);
            if (solved) {
                for (let d = 0; d < this.numDays; d++) {
                    const curFixed = this.grid[s][d].isFixed;
                    const origWish = this.grid[s][d].isOriginalWish;
                    this.grid[s][d] = {
                        symbol: solved[d],
                        isFixed: origWish ? true : false,
                        isOriginalWish: origWish
                    };
                }
            }
        }

        // 3. 訪問スタッフから月〜金（国民の祝日を含む平日扱い稼働日）に毎日1名「8時」勤務を選出！
        const h8StaffList = [];
        for (let s = 0; s < this.numStaff; s++) {
            const staff = this.staffList[s];
            if (staff.isUnused || staff.isSectionChief) continue;
            const sec = staff.lifeSection || '';
            if (sec === '訪問' && staff.can8) {
                h8StaffList.push(s);
            }
        }

        const h8AssignedCounts = new Array(this.numStaff).fill(0);
        for (let d = 0; d < this.numDays; d++) {
            const di = dates[d];
            const isWeekend = di ? (di.wIdx === 5 || di.wIdx === 6) : ((d % 7 === 5) || (d % 7 === 6));
            if (isWeekend) continue; // 土日は8時なし

            let alreadyH8 = false;
            for (let s = 0; s < this.numStaff; s++) {
                if (this.grid[s][d].symbol === SYMBOLS.H8) {
                    alreadyH8 = true;
                    h8AssignedCounts[s]++;
                    break;
                }
            }
            if (alreadyH8) continue;

            const cands = [];
            for (const s of h8StaffList) {
                if ((this.grid[s][d].symbol === SYMBOLS.WORK || this.grid[s][d].symbol === '○') && !this.grid[s][d].isFixed) {
                    let score = h8AssignedCounts[s] * 1000;
                    const prevSym8 = (d > 0) ? this.grid[s][d - 1].symbol : '';
                    const nextSym8 = (d + 1 < this.numDays) ? this.grid[s][d + 1].symbol : '';
                    if (prevSym8 === SYMBOLS.H8 || nextSym8 === SYMBOLS.H8) score += 500000;
                    cands.push({ s, score });
                }
            }
            if (cands.length > 0) {
                cands.sort((a, b) => a.score - b.score);
                const pick = cands[0].s;
                this.grid[pick][d].symbol = SYMBOLS.H8;
                h8AssignedCounts[pick]++;
            }
        }

        // 4. Cl2 スタッフのリストアップ
        const cl2Staff = [];
        for (let s = 0; s < this.numStaff; s++) {
            if (this.staffList[s].isUnused) continue;
            if (this.staffList[s].lifeSection === 'Cl2') cl2Staff.push(s);
        }

        // 5. 通所出勤実数の厳格平準化（月〜土の通所出勤ブレを極小化）
        this.balanceLifeWorkforceDirectly(cl2Staff);

        return {
            success: true,
            grid: this.grid,
            stats: this.calculateStats()
        };
    }

    /**
     * 生活期（通所・訪問）の出勤実数厳格平準化
     */
    balanceLifeWorkforceDirectly(cl2Staff = []) {
        const dates = this.dates || [];

        // --- A. 通所スタッフ（Pattern B: 日休＋平日分散）の月〜土出勤平準化 ---
        const patBStaff = [];
        for (let s = 0; s < this.numStaff; s++) {
            const staff = this.staffList[s];
            if (staff.isUnused) continue;
            const sec = staff.lifeSection || '';
            const ha = staff.haSection || '';
            const isPatA = !!staff.isSatSunOff || (!staff.isSunOff && (sec === '訪問' || sec === '管理' || sec === 'Cl1' || ha === 'ハ1' || ha === 'ハ2'));
            // 通所実数平準化: 通所スタッフ ＋ Cl2（実数1） ＋ ハ3(0.5) ＋ ハ南(0.5)
            const isPatB = !isPatA && (sec === '通所' || sec === 'Cl2' || ha === 'ハ3' || ha === 'ハ南' || ha === 'ハ4');
            if (isPatB) patBStaff.push(s);
        }

        // 月〜土の通所稼働日
        const tsushoWorkingDays = [];
        for (let d = 0; d < this.numDays; d++) {
            const di = dates[d];
            const isSun = di ? (di.wIdx === 6) : (d % 7 === 6);
            if (!isSun) tsushoWorkingDays.push(d);
        }

        if (patBStaff.length > 0 && tsushoWorkingDays.length >= 2) {
            for (let iter = 0; iter < 80; iter++) {
                // 通所出勤実数を計算（通所トグルON + CLトグルON + ハ3/ハ南トグルON(0.5換算)）
                const dailyLoads = tsushoWorkingDays.map(d => {
                    let real = 0;
                    for (const s of patBStaff) {
                        const sym = this.grid[s][d].symbol;
                        const ha = this.staffList[s].haSection || '';
                        const w = (ha === 'ハ3' || ha === 'ハ南' || ha === 'ハ4') ? 0.5 : (this.staffList[s].isZeroCount ? 0.0 : (this.staffList[s].isHalf ? 0.5 : 1.0));
                        if (isWorkSymbol(sym)) real += w;
                        else if (isHalfDuty(sym)) real += 0.5 * w;
                    }
                    return { day: d, real };
                });

                dailyLoads.sort((a, b) => b.real - a.real);
                const maxItem = dailyLoads[0];
                const minItem = dailyLoads[dailyLoads.length - 1];

                // ブレ幅が0.5名以内なら理想達成
                if (maxItem.real - minItem.real <= 0.6) break;

                let swapped = false;
                for (let h = 0; h < Math.min(4, dailyLoads.length); h++) {
                    const maxD = dailyLoads[h].day;
                    for (let l = dailyLoads.length - 1; l >= Math.max(0, dailyLoads.length - 4); l--) {
                        const minD = dailyLoads[l].day;
                        if (dailyLoads[h].real - dailyLoads[l].real <= 0.6) continue;

                        for (const s of patBStaff) {
                            const staff = this.staffList[s];
                            if (this.grid[s][maxD].symbol === SYMBOLS.WORK && !this.grid[s][maxD].isFixed &&
                                this.grid[s][minD].symbol === SYMBOLS.OFF && !this.grid[s][minD].isFixed) {

                                // CL2通所同士の公休重複回避
                                if (cl2Staff.includes(s)) {
                                    const otherCl2 = cl2Staff.find(o => o !== s);
                                    if (otherCl2 && isHolidaySymbol(this.grid[otherCl2][minD].symbol)) continue;
                                }

                                this.setSymbol(s, maxD, SYMBOLS.OFF, false);
                                this.setSymbol(s, minD, SYMBOLS.WORK, false);

                                const checkPureOffStreak = (sIdx) => {
                                    let strk = 0;
                                    const stf = this.staffList[sIdx];
                                    if (stf.prevDays) {
                                        for (let p = stf.prevDays.length - 1; p >= 0; p--) {
                                            if (!isPurePublicOffSymbol(stf.prevDays[p])) strk++;
                                            else break;
                                        }
                                    }
                                    for (let cd = 0; cd < this.numDays; cd++) {
                                        if (!isPurePublicOffSymbol(this.grid[sIdx][cd].symbol)) {
                                            strk++;
                                            if (strk > 6) return false;
                                        } else {
                                            strk = 0;
                                        }
                                    }
                                    return true;
                                };

                                if (this.isStaffHardValid(s) && checkPureOffStreak(s)) {
                                    swapped = true;
                                    break;
                                } else {
                                    this.setSymbol(s, maxD, SYMBOLS.WORK, false);
                                    this.setSymbol(s, minD, SYMBOLS.OFF, false);
                                }
                            }
                        }
                        if (swapped) break;
                    }
                    if (swapped) break;
                }
                if (!swapped) break;
            }
        }

        // --- B. 訪問スタッフ（Pattern A: 土日休）の平日出勤平準化 ---
        const visitStaff = [];
        for (let s = 0; s < this.numStaff; s++) {
            const staff = this.staffList[s];
            if (staff.isUnused || staff.isSectionChief) continue;
            const sec = staff.lifeSection || '';
            const isVisit = (sec === '訪問');
            if (isVisit) visitStaff.push(s);
        }

        const visitWeekdays = [];
        for (let d = 0; d < this.numDays; d++) {
            const di = dates[d];
            const isWknd = di ? (di.wIdx === 5 || di.wIdx === 6) : ((d % 7 === 5) || (d % 7 === 6));
            if (!isWknd) visitWeekdays.push(d);
        }

        if (visitStaff.length > 0 && visitWeekdays.length >= 2) {
            for (let iter = 0; iter < 60; iter++) {
                const dailyLoads = visitWeekdays.map(d => {
                    let real = 0;
                    for (const s of visitStaff) {
                        const sym = this.grid[s][d].symbol;
                        if (isWorkSymbol(sym)) real += (this.staffList[s].isHalf ? 0.5 : 1.0);
                        else if (isHalfDuty(sym)) real += 0.5 * (this.staffList[s].isHalf ? 0.5 : 1.0);
                    }
                    return { day: d, real };
                });

                dailyLoads.sort((a, b) => b.real - a.real);
                const maxItem = dailyLoads[0];
                const minItem = dailyLoads[dailyLoads.length - 1];

                if (maxItem.real - minItem.real <= 1.0) break;

                let swapped = false;
                for (let h = 0; h < Math.min(3, dailyLoads.length); h++) {
                    const maxD = dailyLoads[h].day;
                    for (let l = dailyLoads.length - 1; l >= Math.max(0, dailyLoads.length - 3); l--) {
                        const minD = dailyLoads[l].day;
                        if (dailyLoads[h].real - dailyLoads[l].real <= 1.0) continue;

                        for (const s of visitStaff) {
                            // 8時勤務の人は動かさない
                            if (this.grid[s][maxD].symbol === SYMBOLS.H8 || this.grid[s][minD].symbol === SYMBOLS.H8) continue;

                            if (this.grid[s][maxD].symbol === SYMBOLS.WORK && !this.grid[s][maxD].isFixed &&
                                this.grid[s][minD].symbol === SYMBOLS.OFF && !this.grid[s][minD].isFixed) {

                                this.setSymbol(s, maxD, SYMBOLS.OFF, false);
                                this.setSymbol(s, minD, SYMBOLS.WORK, false);

                                if (this.isStaffHardValid(s)) {
                                    swapped = true;
                                    break;
                                } else {
                                    this.setSymbol(s, maxD, SYMBOLS.WORK, false);
                                    this.setSymbol(s, minD, SYMBOLS.OFF, false);
                                }
                            }
                        }
                        if (swapped) break;
                    }
                    if (swapped) break;
                }
                if (!swapped) break;
            }
        }
    }

    /**
     * 第1段階: 基本勤務表の自動生成
     * （特殊勤務の自動割り振りは行わず、希望休・公休日数・連勤・週休・属性充足を満たして空き枠を「○」で確定）
     */
    solveBaseSchedule(options = {}) {
        if (this.isST) {
            return this.solveST(Object.assign({}, options, { assignSpecial: false }));
        }
        if (this.isLife) {
            return this.solveLife(options);
        }
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

        // ★ 係長不在日の主任・副主任出勤保証リペア
        this.ensureRoleCoverage();

        // ★ スケ可スタッフ毎日2名以上出勤保証リペア
        this.ensureSchedCoverage();

        // ★ 専従スタッフ毎日3名以上出勤保証リペア
        this.ensureFullTimeCoverage();

        // ★ ユーザー指示: 週休2日違反・単発勤務・連勤違反等のスマート自動微修正
        this.repairScheduleViolations();
        this.ensureRoleCoverage();
        this.ensureSchedCoverage();
        this.ensureFullTimeCoverage();

        // ★ 平日出勤実数および土日祝出勤実数のブレ極小化（最終仕上げ）
        this.balanceWeekdayWeekendOffset();
        this.balanceWeekdaysDirectly();
        this.balanceWeekendsDirectly();
        this.ensureRoleCoverage();
        this.ensureSchedCoverage();
        this.ensureFullTimeCoverage();

        // 基本制約の検証
        let baseErrors = this.verifyBaseHardConstraints();
        if (baseErrors.length > 0) {
            // ★ ユーザー指示: 一度エラーが出た後に勤務の微調整をおこなうシステムを構築し、エラーを回避してから出力する！
            for (let rPass = 0; rPass < 5; rPass++) {
                this.repairScheduleViolations();
                this.ensureRoleCoverage();
                this.ensureSchedCoverage();
                this.ensureFullTimeCoverage();
                this.balanceWeekdayWeekendOffset();
                this.balanceWeekdaysDirectly();
                this.balanceWeekendsDirectly();
                baseErrors = this.verifyBaseHardConstraints();
                if (baseErrors.length === 0) break;
            }
            if (baseErrors.length > 0 && !force) {
                return { success: false, errors: baseErrors };
            }
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
        if (this.isST) {
            return this.solveST(Object.assign({}, options, { assignSpecial: true }));
        }
        if (this.isLife) {
            return this.solveLife(options);
        }
        const force = options && options.force === true;

        // ステップ0: 事前希望の特殊勤務の翌日休フラグを確実に同期し、係長に非固定の特殊勤務が混入していればクリーンアップ
        this.ensureHolidaysAfterPreAssignedSpecials();
        for (let s = 0; s < this.numStaff; s++) {
            if (this.staffList[s].isUnused || !this.staffList[s].isSectionChief) continue;
            let hadUnfixedSpecial = false;
            for (let d = 0; d < this.numDays; d++) {
                if (!this.grid[s][d].isFixed && (isRestrictedSpecial(this.grid[s][d].symbol) || this.grid[s][d].symbol === SYMBOLS.H8)) {
                    this.grid[s][d].symbol = this.isWeekdayIndex(d) ? SYMBOLS.WORK : SYMBOLS.OFF;
                    hadUnfixedSpecial = true;
                }
            }
            if (hadUnfixedSpecial) {
                const maxConsec = this.staffList[s].allow6Consec ? 6 : 5;
                const scGrid = this.solveSectionChiefSchedule(s, this.options.standardHolidays, maxConsec);
                if (scGrid) {
                    for (let d = 0; d < this.numDays; d++) {
                        const curSym = this.grid[s][d].symbol;
                        const isRef = SYMBOLS.REF_SUMMER.includes(curSym) || SYMBOLS.REF_WINTER.includes(curSym);
                        if (!this.grid[s][d].isFixed && !isRef) this.setSymbol(s, d, scGrid[d], false);
                    }
                }
            }
        }

        // ステップ1: 8時勤務（1名/日）を優先配置！（南病棟でも南2・南3から毎日1名均等に自動選出）
        if (!this.isST) {
            const h8Result = this.assign8ClockDuties(options);
            if (!h8Result.success && !force) {
                return h8Result;
            }
        }

        // ステップ2: 毎日の特殊勤務（遅1, E2, 早3）を配置し、翌日を自動的に「休」に設定
        const specialResult = this.assignSpecialDuties(options);
        if (!specialResult.success && !force) {
            return specialResult;
        }

        // ★ ユーザー指示: 修正作業エリアで手動微調整・目視確認が完了した勤務表に対しては、
        // 公休（休）や出勤（○）の配置を勝手に移動させるスワップ処理を一切実行せず、
        // 既存の日勤「○」の中からのみ特殊勤務を昇格割り当てする！
        if (options && options.preserveGrid === true) {
            this.autoFixOverallocatedEarlyDuties();
            let finalErrors = this.verifyAllHardConstraints();
            if (finalErrors.length > 0 && !force) {
                return { success: false, errors: finalErrors };
            }
            return {
                success: true,
                grid: this.grid,
                stats: this.calculateStats()
            };
        }

        // ★ 係長不在日の主任・副主任（Aチーム1名以上かつBチーム1名以上）出勤保証リペア
        this.ensureRoleCoverage();
        this.ensureSchedCoverage();
        this.ensureFullTimeCoverage();

        // ステップ3: 特殊勤務を崩さず、一般勤務(○)と公休(休)のスワップで出勤人数を厳格に平準化
        this.balanceDailyWorkforce();
        this.ensureRoleCoverage();
        this.ensureSchedCoverage();
        this.ensureFullTimeCoverage();

        this.eliminateSingleDayWork();
        this.ensureRoleCoverage();
        this.ensureSchedCoverage();
        this.ensureFullTimeCoverage();

        // ★ ユーザー指示: 特殊勤務翌日休違反・8時不足・週休2日違反のスマート自動微修正（完全自動リペア）
        this.repairScheduleViolations();
        this.ensureRoleCoverage();
        this.ensureSchedCoverage();
        this.ensureFullTimeCoverage();

        // ★ ST早番等と合算して早番が4名になる不一致を自動修復
        this.autoFixOverallocatedEarlyDuties();

        // ★ 平日出勤実数および土日祝出勤実数のブレ極小化（最終仕上げ）
        this.balanceWeekdayWeekendOffset();
        this.balanceWeekdaysDirectly();
        this.balanceWeekendsDirectly();
        this.ensureRoleCoverage();
        this.ensureSchedCoverage();
        this.ensureFullTimeCoverage();

        // 最終全ハード制約の検証
        let finalErrors = this.verifyAllHardConstraints();
        if (finalErrors.length > 0) {
            // ★ ユーザー指示: 一度エラーが出た後に勤務の微調整をおこなうシステムを構築し、エラーを回避してから出力する！
            for (let rPass = 0; rPass < 5; rPass++) {
                this.repairScheduleViolations();
                this.autoFixOverallocatedEarlyDuties();
                this.ensureRoleCoverage();
                this.ensureSchedCoverage();
                this.ensureFullTimeCoverage();
                this.balanceWeekdayWeekendOffset();
                this.balanceWeekdaysDirectly();
                this.balanceWeekendsDirectly();
                finalErrors = this.verifyAllHardConstraints();
                if (finalErrors.length === 0) break;
            }
            if (finalErrors.length > 0 && !force) {
                return { success: false, errors: finalErrors };
            }
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
     * ステップ1: 事前に入力されている特殊勤務（早・遅・E）の翌日を自動的に休みに設定（※係長のみ特殊勤務の翌日は休みにしなくてよいため除外）
     */
    ensureHolidaysAfterPreAssignedSpecials() {
        for (let s = 0; s < this.numStaff; s++) {
            if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;
            for (let d = 0; d < this.numDays - 1; d++) {
                const sym = this.grid[s][d].symbol;
                if (isRestrictedSpecial(sym)) {
                    if (this.grid[s][d + 1].symbol === '' && !this.grid[s][d + 1].isFixed) {
                        this.setSymbol(s, d + 1, SYMBOLS.OFF, false);
                        this.grid[s][d + 1].isAfterPreSpecial = true;
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
                if (sym === SYMBOLS.EARLY) { counts.early[s]++; counts.total[s]++; lastDay[s] = Math.max(lastDay[s], d); }
                if (sym === SYMBOLS.LATE) { counts.late[s]++; counts.total[s]++; lastDay[s] = Math.max(lastDay[s], d); }
                if (sym === SYMBOLS.EVE) { counts.eve[s]++; counts.total[s]++; lastDay[s] = Math.max(lastDay[s], d); }
                if (sym === SYMBOLS.H8) { counts.h8[s]++; }
            }
        }

        const getSubFloor = (s) => this.getSubFloor(s);

        for (let d = 0; d < this.numDays; d++) {
            const dayNum = d + 1;

            let requirements = [];
            if (this.isSouth) {
                // 南病棟特殊ルール:
                // ・遅: 南2に1名、南3に1名ずつだけ配置、合計2名
                // ・E: 南2に1名、南3に1名ずつだけ配置、合計2名
                // ・早: 南2に1名、南3に1名ずつだけ配置、合計2名（ST早番は南2または南3どちらにカウントしてもOK）
                requirements = [
                    { type: SYMBOLS.LATE, count: 1, targetFloor: '南2', label: '南2遅番', key: 'late', noFlag: 'noLate', matchSyms: [SYMBOLS.LATE] },
                    { type: SYMBOLS.LATE, count: 1, targetFloor: '南3', label: '南3遅番', key: 'late', noFlag: 'noLate', matchSyms: [SYMBOLS.LATE] },
                    { type: SYMBOLS.EVE, count: 1, targetFloor: '南2', label: '南2イブニング(E)', key: 'eve', noFlag: 'noEve', matchSyms: [SYMBOLS.EVE] },
                    { type: SYMBOLS.EVE, count: 1, targetFloor: '南3', label: '南3イブニング(E)', key: 'eve', noFlag: 'noEve', matchSyms: [SYMBOLS.EVE] }
                ];

                const rawStEarly = (this.stDailyEarly && this.stDailyEarly[d]) ? this.stDailyEarly[d] : 0;
                const effectiveStEarly = Math.min(1, rawStEarly);
                if (effectiveStEarly === 1) {
                    // ST早番がある場合（最大1名充当）: 南2または南3のどちらか一方にSTを充当し、もう一方にPO早番1名を必ず配置！
                    let s2HasEarly = false, s3HasEarly = false;
                    for (let s = 0; s < this.numStaff; s++) {
                        if (this.staffList[s].isUnused) continue;
                        if (this.grid[s][d].symbol === SYMBOLS.EARLY) {
                            if (getSubFloor(s) === '南2') s2HasEarly = true;
                            if (getSubFloor(s) === '南3') s3HasEarly = true;
                        }
                    }
                    if (s2HasEarly && s3HasEarly) {
                        // 両方に事前PO早番希望がある場合
                        requirements.push({ type: SYMBOLS.EARLY, count: 1, targetFloor: '南2', label: '南2早番', key: 'early', noFlag: 'noEarly', matchSyms: [SYMBOLS.EARLY] });
                        requirements.push({ type: SYMBOLS.EARLY, count: 1, targetFloor: '南3', label: '南3早番', key: 'early', noFlag: 'noEarly', matchSyms: [SYMBOLS.EARLY] });
                    } else if (s2HasEarly && !s3HasEarly) {
                        // 南2に既にPO早番があるため、ST早番は南3に充当（南2にPO早番1名要求）
                        requirements.push({ type: SYMBOLS.EARLY, count: 1, targetFloor: '南2', label: '南2早番', key: 'early', noFlag: 'noEarly', matchSyms: [SYMBOLS.EARLY] });
                    } else if (s3HasEarly && !s2HasEarly) {
                        // 南3に既にPO早番があるため、ST早番は南2に充当（南3にPO早番1名要求）
                        requirements.push({ type: SYMBOLS.EARLY, count: 1, targetFloor: '南3', label: '南3早番', key: 'early', noFlag: 'noEarly', matchSyms: [SYMBOLS.EARLY] });
                    } else {
                        // どちらも事前希望なしの場合: 交互に割り当てて、もう片方にPO早番1名を配置
                        if (d % 2 === 0) {
                            requirements.push({ type: SYMBOLS.EARLY, count: 1, targetFloor: '南2', label: '南2早番', key: 'early', noFlag: 'noEarly', matchSyms: [SYMBOLS.EARLY] });
                        } else {
                            requirements.push({ type: SYMBOLS.EARLY, count: 1, targetFloor: '南3', label: '南3早番', key: 'early', noFlag: 'noEarly', matchSyms: [SYMBOLS.EARLY] });
                        }
                    }
                } else {
                    // ST早番なし: 南2に1名、南3に1名
                    requirements.push({ type: SYMBOLS.EARLY, count: 1, targetFloor: '南2', label: '南2早番', key: 'early', noFlag: 'noEarly', matchSyms: [SYMBOLS.EARLY] });
                    requirements.push({ type: SYMBOLS.EARLY, count: 1, targetFloor: '南3', label: '南3早番', key: 'early', noFlag: 'noEarly', matchSyms: [SYMBOLS.EARLY] });
                }
            } else {
                // 1階・2階・3階: PT早＋OT早＋ST早の合計が3つ（遅は1、Eは2）
                // 同階所属のSTスタッフ特殊勤務がある場合、PO必要枠から差し引いて合計定数を厳格維持！
                const rawStEarly = (this.stDailyEarly && this.stDailyEarly[d]) ? this.stDailyEarly[d] : 0;
                const rawStLate = (this.stDailyLate && this.stDailyLate[d]) ? this.stDailyLate[d] : 0;
                const rawStEve = (this.stDailyEve && this.stDailyEve[d]) ? this.stDailyEve[d] : 0;
                const needEarly = Math.max(0, 3 - rawStEarly);
                const needLate = Math.max(0, 1 - rawStLate);
                const needEve = Math.max(0, 2 - rawStEve);

                requirements = [
                    { type: SYMBOLS.LATE, count: needLate, label: '遅番', key: 'late', noFlag: 'noLate', matchSyms: [SYMBOLS.LATE] },
                    { type: SYMBOLS.EVE, count: needEve, label: 'イブニング(E)', key: 'eve', noFlag: 'noEve', matchSyms: [SYMBOLS.EVE] },
                    { type: SYMBOLS.EARLY, count: needEarly, label: '早番', key: 'early', noFlag: 'noEarly', matchSyms: [SYMBOLS.EARLY] }
                ];
            }

            for (const req of requirements) {
                let assigned = 0;
                for (let s = 0; s < this.numStaff; s++) {
                    if (this.staffList[s].isUnused) continue;
                    // ★ 南病棟の場合はフロア（南2 or 南3）を厳密に区別してカウント！
                    if (req.targetFloor && getSubFloor(s) !== req.targetFloor) continue;
                    if (req.matchSyms.includes(this.grid[s][d].symbol)) assigned++;
                }

                const needed = req.count - assigned;
                if (needed <= 0) continue;

                let candidates = [];
                for (let s = 0; s < this.numStaff; s++) {
                    if (this.staffList[s].isUnused) continue;
                    // ★ 係長は特殊勤務なし（事前希望で入力された特殊勤務のみ残し、自動割当は一切行わない）
                    if (this.staffList[s].isSectionChief) continue;
                    // 当日dが非固定の○であること
                    if (this.grid[s][d].isFixed || this.grid[s][d].symbol !== SYMBOLS.WORK) continue;

                    // 個別不可フラグ
                    if (this.staffList[s][req.noFlag]) continue;


                    // 南病棟のフロア指定チェック
                    if (req.targetFloor && getSubFloor(s) !== req.targetFloor) continue;

                    // 1年目スタッフの制約チェック
                    if (this.staffList[s].isFirstYear) {
                        if (this.isSouth) {
                            if (req.key === 'early') {
                                let curEarlyFY = 0;
                                for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                    if (this.staffList[otherS].isFirstYear && this.grid[otherS][d].symbol === SYMBOLS.EARLY) curEarlyFY++;
                                }
                                if (curEarlyFY >= 1) continue;
                            }
                            if (req.key === 'eve') {
                                let curEveFY = 0;
                                for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                    if (this.staffList[otherS].isFirstYear && this.grid[otherS][d].symbol === SYMBOLS.EVE) curEveFY++;
                                }
                                if (curEveFY >= 1) continue;
                            }
                            const subFl = getSubFloor(s);
                            if (req.key === 'late') {
                                let floorEveFY = 0;
                                for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                    if (getSubFloor(otherS) === subFl && this.staffList[otherS].isFirstYear && this.grid[otherS][d].symbol === SYMBOLS.EVE) floorEveFY++;
                                }
                                if (floorEveFY >= 1) continue;
                            }
                            if (req.key === 'eve') {
                                let floorLateFY = 0;
                                for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                    if (getSubFloor(otherS) === subFl && this.staffList[otherS].isFirstYear && this.grid[otherS][d].symbol === SYMBOLS.LATE) floorLateFY++;
                                }
                                if (floorLateFY >= 1) continue;
                            }
                        } else {
                            if (req.key === 'early') {
                                let curEarlyFY = 0;
                                for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                    if (this.staffList[otherS].isFirstYear && this.grid[otherS][d].symbol === SYMBOLS.EARLY) curEarlyFY++;
                                }
                                if (curEarlyFY >= 1) continue;
                            }
                            if (req.key === 'late' || req.key === 'eve') {
                                let curLateEveFY = 0;
                                for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                    if (this.staffList[otherS].isFirstYear && (this.grid[otherS][d].symbol === SYMBOLS.LATE || this.grid[otherS][d].symbol === SYMBOLS.EVE)) curLateEveFY++;
                                }
                                if (curLateEveFY >= 1) continue;
                            }
                        }
                    }

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
                    } else if (!options.preserveGrid && !this.grid[s][d + 1].isFixed && this.grid[s][d + 1].symbol === SYMBOLS.WORK && !(this.staffList[s].isSectionChief && this.isWeekdayIndex(d + 1))) {
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
                            let canSetD1Off = this.canPlaceHoliday(s, d + 1, 1);
                            if (canSetD1Off) {
                                // ★ 実数合計（getDailyEffectiveRealLoad）および同セクション・同チーム出勤数が少ない日（同週優先）から順にスワップ先を探索
                                const d1Week = this.weekSpans.findIndex(span => span.includes(d + 1));
                                const stSec = this.staffList[s].section || '';
                                const stTeam = (stSec === 'PT A' || stSec === 'OT A') ? 'A' : ((stSec === 'PT B' || stSec === 'OT B') ? 'B' : '');
                                const dayCandidates = [];
                                for (let candD = 0; candD < this.numDays; candD++) {
                                    if (candD === d || candD === d + 1) continue;
                                    const realLoad = this.getDailyEffectiveRealLoad(candD);
                                    const secMap = this.getDailySectionWorkMap(candD);
                                    const secLoad = stSec && (stSec in secMap) ? secMap[stSec] : 0;
                                    const teamLoad = stTeam === 'A' ? secMap.teamA : (stTeam === 'B' ? secMap.teamB : 0);
                                    const candWeek = this.weekSpans.findIndex(span => span.includes(candD));
                                    dayCandidates.push({
                                        day: candD,
                                        realLoad: realLoad,
                                        secLoad: secLoad,
                                        teamLoad: teamLoad,
                                        sameWeek: (candWeek === d1Week) ? 1 : 0
                                    });
                                }
                                dayCandidates.sort((a, b) => {
                                    if (a.sameWeek !== b.sameWeek) return b.sameWeek - a.sameWeek;
                                    const scoreA = a.realLoad * 2.0 + a.secLoad * 1.2 + a.teamLoad * 0.8;
                                    const scoreB = b.realLoad * 2.0 + b.secLoad * 1.2 + b.teamLoad * 0.8;
                                    return scoreA - scoreB;
                                });

                                for (const dObj of dayCandidates) {
                                    const otherD = dObj.day;
                                    if (!this.grid[s][otherD].isFixed && !this.grid[s][otherD].isAfterPreSpecial && this.grid[s][otherD].symbol === SYMBOLS.OFF) {
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

                    // ★ 要件: 1勤（前日も翌日も休日となる単発勤務）には特殊勤務（早・遅・E）を自動で一切振らない
                    // canNextBeOff === true の場合、翌日(d+1)は休日になるため、前日(d-1)が休日（かつスワップ先がd-1でない）なら1勤になるため完全除外
                    const prevSym = this.getSymbol(s, d - 1);
                    const prevRemainsHoliday = isHolidaySymbol(prevSym) && (swapDay !== d - 1);
                    if (prevRemainsHoliday) continue;

                    // ★ ユーザー指示: 8時がある人は特殊勤務（早・遅・E・8時）を「2つに固定」！
                    // counts.h8[s]: 8時回数, counts.total[s]: 早+遅+E回数
                    // ★ ユーザー指示: 8時担当スタッフは、8時を3〜4回担当して日勤が減るため、早・遅・Eなどの「他の特殊勤務」を2個程度（最大2個）に抑える！
                    const is8ClockStaff = !!this.staffList[s].can8;
                    // ★ 遅番上限: 1階〜3階病棟は全スタッフ「最大1回」厳守。
                    // 南病棟は南2で28回・南3で28回必要（各約23名）なため、全員1回行き届かせた上で不足分のみ2回まで均等選出！
                    const maxLate = this.isSouth ? 2 : 1;
                    if (req.key === 'late' && counts.late[s] >= maxLate) continue;
                    // ★ 8時担当スタッフは特殊勤務合計（早・遅・E・8時）をちょうど2回に固定（早遅Eは最大1回）
                    if (is8ClockStaff && counts.total[s] >= 1) continue;
                    // ★ 一般スタッフ（8時なし）は特殊勤務合計（早・遅・E）最大5回（6回以上は完全除外）
                    // ★ 46名全員で1人あたり4〜5回を厳守！6回以上は完全禁止！
                    if (!is8ClockStaff && counts.total[s] >= 5) continue;
                    // 早番は最大2回（枠数不足時のみ一部3回許容）
                    if (req.key === 'early' && counts.early[s] >= 3) continue;
                    // Eは最大2回（原則1回、0回の人優先）
                    if (req.key === 'eve' && counts.eve[s] >= 2) continue;
                    const has8 = counts.h8[s] > 0 || is8ClockStaff;
                    if (has8) {
                        // 早・遅・Eの合計（counts.total[s]）が2回に達していれば、それ以上早遅Eを追加しない！
                        if (counts.total[s] >= 2) continue;
                    }

                    // 1. 合計回数ペナルティ（早+遅+E）
                    let totalCountPenalty = 0;
                    if (is8ClockStaff || counts.h8[s] > 0) {
                        // ★ ユーザー指示: 8時がある人は特殊勤務（早・遅・E・8時）を「2つに固定」！
                        // 8時が1回ある人は、早・遅・Eのいずれかをもう1回割り当てて合計【ちょうど2回】に確定させる！
                        // 8時担当スタッフ: 早・遅・Eの合計（counts.total[s]）を2個程度（0〜2回）に抑える
                        if (counts.total[s] === 1) {
                            totalCountPenalty = 10000; // 1回あれば十分
                        } else if (counts.total[s] === 0) {
                            totalCountPenalty = -2000; // 0回〜1回まで許容
                        } else {
                            totalCountPenalty = 500000; // 早遅Eが2回に達したら追加禁止
                        }
                    } else {
                        // ★ ユーザー指示: 特殊勤務の合計数が3の人と5の人がいる。ばらつきを極限まで減らして極力全員4回均等配分！
                        if (counts.total[s] >= 5) {
                            totalCountPenalty = 500000 + (counts.total[s] - 5) * 100000; // 5回以上は絶対禁止
                        } else if (counts.total[s] === 4) {
                            totalCountPenalty = 80000; // 4回に達したスタッフは強いペナルティで抑止
                        } else if (counts.total[s] === 3) {
                            totalCountPenalty = 0; // 3回のスタッフは4回目を目指して配置
                        } else if (counts.total[s] === 2) {
                            totalCountPenalty = -12000;
                        } else if (counts.total[s] === 1) {
                            totalCountPenalty = -25000;
                        } else {
                            totalCountPenalty = -40000; // まだ0〜2回のスタッフを最優先して4回に引き上げる！
                        }
                    }

                    // 2. 勤務種別（早・遅・E）ごとの平均化ペナルティ
                    let dutyTypePenalty = 0;
                    // ★ ユーザー指示: 特殊勤務の回数バランス（もし4回なら早2、遅1、E1）を厳密遵守！
                    if (req.key === 'late') {
                        if (this.isSouth) {
                            if (counts.late[s] >= 2) {
                                dutyTypePenalty = 1000000 + (counts.late[s] - 2) * 500000;
                            } else if (counts.late[s] === 1) {
                                dutyTypePenalty = 20000; // 0回の人を優先しつつ2回目を均等配分
                            } else {
                                dutyTypePenalty = -12000; // 0回の人を最優先！
                            }
                        } else {
                            if (counts.late[s] >= 1) {
                                dutyTypePenalty = 1000000 + counts.late[s] * 500000;
                            } else {
                                dutyTypePenalty = -5000; // 0回の人を最優先
                            }
                        }
                    } else if (req.key === 'eve') {
                        // E(イブニング): 原則1回（最大2回まで）。0回の人を最優先して1回行き届かせる
                        if (counts.eve[s] >= 2) {
                            dutyTypePenalty = 500000 + (counts.eve[s] - 2) * 200000; // 3回以上は絶対禁止
                        } else if (counts.eve[s] === 1) {
                            dutyTypePenalty = 25000; // 1回ある人は抑制
                        } else {
                            dutyTypePenalty = -8000; // 0回の人を最優先！
                        }
                    } else if (req.key === 'early') {
                        // 早番: 目標「2回」（枠数に応じて一部3回）。0〜1回の人を最優先して2回まで均等配分！
                        if (is8ClockStaff) {
                            if (counts.early[s] >= 2) {
                                dutyTypePenalty = 500000;
                            } else if (counts.early[s] === 1) {
                                dutyTypePenalty = 10000;
                            } else {
                                dutyTypePenalty = -3000;
                            }
                        } else {
                            if (counts.early[s] >= 3) {
                                dutyTypePenalty = 500000 + (counts.early[s] - 3) * 100000; // 3回を超えたら禁止
                            } else if (counts.early[s] === 2) {
                                dutyTypePenalty = 30000; // 2回に達したら強く抑制
                            } else if (counts.early[s] === 1) {
                                dutyTypePenalty = -2000; // 1回の人は2回目を目指す
                            } else {
                                dutyTypePenalty = -15000; // まだ早番0回のスタッフを最優先！
                            }
                        }
                    }

                    // スコア計算:
                    let score = totalCountPenalty + dutyTypePenalty;
                    if (d + 1 < this.numDays && isHolidaySymbol(this.grid[s][d + 1].symbol)) {
                        // ★ 既に翌日が休日のスタッフを超大幅優遇（スワップ不要で翌日休が100%保証される）
                        score -= 50000;
                    }
                    if (swapDay >= 0) {
                        // スワップが必要な場合は優先度を下げ、さらにスワップによる実数合計の偏り影響を加味
                        const d1Load = this.getDailyEffectiveRealLoad(d + 1);
                        const swapLoad = this.getDailyEffectiveRealLoad(swapDay);
                        score += 500 + (swapLoad - d1Load) * 40;
                    }
                    if (this.staffList[s].canSched) {
                        score += 300; // スケ可スタッフは日勤（○）で温存するため特殊勤務への割当優先度を下げる
                    }
                    if (this.staffList[s].isSectionChief) {
                        score += 350; // 係長は土曜固定休のため金曜に特殊勤務が集中しすぎないよう日勤（○）温存優先度を上げる
                    }
                    const distFromLast = d - lastDay[s];
                    if (distFromLast < 3) {
                        score += 200; // 直近の特殊勤務を避ける
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

                    candidates.push({ staffIndex: s, score, swapDay, isNextWorkFallback: false });
                }

                // ★ 要件: 「その他役職者含む職員の特殊勤務（8時のぞく）の次の日は原則休みで組むが、避けられない状態ではマストでなくてもOKです。ただしエラーは発動して。」
                // 原則通り「翌日休み」にできる候補者だけでは必要数(needed)に満たない避けられない状態の場合、
                // 1勤（単発勤務）を除き、翌日が勤務のままでも配置可能な候補者をフォールバックとして追加する（チェック画面でエラー＆ブルー網掛けを発動）
                if (candidates.length < needed) {
                    const alreadyCandSet = new Set(candidates.map(c => c.staffIndex));
                    for (let s = 0; s < this.numStaff; s++) {
                        if (alreadyCandSet.has(s)) continue;
                        if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;
                        if (this.grid[s][d].isFixed || this.grid[s][d].symbol !== SYMBOLS.WORK) continue;
                        if (this.staffList[s][req.noFlag]) continue;
                        const maxLateFb = this.isSouth ? 2 : 1;
                        if (req.key === 'late' && counts.late[s] >= maxLateFb) continue;
                        const is8Staff = !!this.staffList[s].can8;
                        if (is8Staff && counts.total[s] >= 1) continue;
                        if (!is8Staff && counts.total[s] >= 5) continue;
                        if (req.key === 'early' && counts.early[s] >= 3) continue;
                        if (req.key === 'eve' && counts.eve[s] >= 2) continue;


                        // 南病棟のフロア指定チェック
                        if (req.targetFloor && getSubFloor(s) !== req.targetFloor) continue;

                        // 1年目スタッフの制約チェック
                        if (this.staffList[s].isFirstYear) {
                            if (this.isSouth) {
                                if (req.key === 'early') {
                                    let curEarlyFY = 0;
                                    for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                        if (this.staffList[otherS].isFirstYear && this.grid[otherS][d].symbol === SYMBOLS.EARLY) curEarlyFY++;
                                    }
                                    if (curEarlyFY >= 1) continue;
                                }
                                if (req.key === 'eve') {
                                    let curEveFY = 0;
                                    for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                        if (this.staffList[otherS].isFirstYear && this.grid[otherS][d].symbol === SYMBOLS.EVE) curEveFY++;
                                    }
                                    if (curEveFY >= 1) continue;
                                }
                                const subFl = getSubFloor(s);
                                if (req.key === 'late') {
                                    let floorEveFY = 0;
                                    for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                        if (getSubFloor(otherS) === subFl && this.staffList[otherS].isFirstYear && this.grid[otherS][d].symbol === SYMBOLS.EVE) floorEveFY++;
                                    }
                                    if (floorEveFY >= 1) continue;
                                }
                                if (req.key === 'eve') {
                                    let floorLateFY = 0;
                                    for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                        if (getSubFloor(otherS) === subFl && this.staffList[otherS].isFirstYear && this.grid[otherS][d].symbol === SYMBOLS.LATE) floorLateFY++;
                                    }
                                    if (floorLateFY >= 1) continue;
                                }
                            } else {
                                if (req.key === 'early') {
                                    let curEarlyFY = 0;
                                    for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                        if (this.staffList[otherS].isFirstYear && this.grid[otherS][d].symbol === SYMBOLS.EARLY) curEarlyFY++;
                                    }
                                    if (curEarlyFY >= 1) continue;
                                }
                                if (req.key === 'late' || req.key === 'eve') {
                                    let curLateEveFY = 0;
                                    for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                        if (this.staffList[otherS].isFirstYear && (this.grid[otherS][d].symbol === SYMBOLS.LATE || this.grid[otherS][d].symbol === SYMBOLS.EVE)) curLateEveFY++;
                                    }
                                    if (curLateEveFY >= 1) continue;
                                }
                            }
                        }

                        // スケ可保護
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

                        // ★ 1勤（前日も翌日も休日）には特殊勤務を自動で一切振らない
                        const prevSym = this.getSymbol(s, d - 1);
                        const nextSym = (d + 1 < this.numDays) ? this.getSymbol(s, d + 1) : '';
                        if (isHolidaySymbol(prevSym) && (d + 1 < this.numDays && isHolidaySymbol(nextSym))) continue;

                        const is8ClockStaff = !!this.staffList[s].can8;
                        if (is8ClockStaff && counts.total[s] >= 2) continue;
                        let totalCountPenalty = 0;
                        if (is8ClockStaff) {
                            if (counts.total[s] === 1) totalCountPenalty = 8000;
                            else totalCountPenalty = -1000;
                        } else {
                            if (counts.total[s] >= 6) totalCountPenalty = 150000 + (counts.total[s] - 6) * 60000;
                            else if (counts.total[s] === 5) totalCountPenalty = 15000;
                            else if (counts.total[s] === 4) totalCountPenalty = 2000;
                            else if (counts.total[s] === 3) totalCountPenalty = -2000;
                            else if (counts.total[s] === 2) totalCountPenalty = -5000;
                            else if (counts.total[s] === 1) totalCountPenalty = -8000;
                            else totalCountPenalty = -12000;
                        }
                        let dutyTypePenalty = 0;
                        if (req.key === 'late') {
                            dutyTypePenalty = counts.late[s] >= 1 ? 150000 : 0;
                        } else if (req.key === 'eve') {
                            dutyTypePenalty = counts.eve[s] >= 2 ? 80000 : (counts.eve[s] === 1 ? 5000 : -2500);
                        } else if (req.key === 'early') {
                            if (is8ClockStaff) dutyTypePenalty = counts.early[s] >= 2 ? 60000 : (counts.early[s] === 1 ? 2000 : -1000);
                            else dutyTypePenalty = counts.early[s] >= 3 ? 80000 : (counts.early[s] === 2 ? 12000 : (counts.early[s] === 1 ? 800 : -3500));
                        }
                        let score = 500000 + totalCountPenalty + dutyTypePenalty;
                        if (this.staffList[s].canSched) score += 300;
                        if (d - lastDay[s] < 3) score += 200;

                        candidates.push({ staffIndex: s, score, swapDay: -1, isNextWorkFallback: true });
                    }
                }

                // ★ ユーザー指示: 「特殊勤務後の公休の制約が破られる事が多い。どうしても難しいときはこれまで同様に制約をまもらずに配置し網掛けしてくれれば良い。」
                // 第1フォールバックでも候補者が不足する場合、回数上限・1勤制約等を最大限緩和した第2フォールバックで候補者を救済し、配置を完遂（青網掛け表示）
                if (candidates.length < needed) {
                    const alreadyCandSet2 = new Set(candidates.map(c => c.staffIndex));
                    for (let s = 0; s < this.numStaff; s++) {
                        if (alreadyCandSet2.has(s)) continue;
                        if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;
                        if (this.grid[s][d].isFixed || this.grid[s][d].symbol !== SYMBOLS.WORK) continue;
                        if (this.staffList[s][req.noFlag]) continue;
                        if (req.targetFloor && getSubFloor(s) !== req.targetFloor) continue;

                        let score = 900000 + counts.total[s] * 10000;
                        candidates.push({ staffIndex: s, score, swapDay: -1, isNextWorkFallback: true });
                    }
                }

                if (candidates.length < needed) {
                    if (!force) {
                        return {
                            success: false,
                            errors: [`【${this.formatDateLabel(d)}の特殊勤務割当】「${req.label}」の担当者が必要数（${req.count}名）に対し、配置可能なスタッフが不足しています（候補${candidates.length}名 / 不足${needed}名）。`]
                        };
                    }
                }

                candidates.sort((a, b) => a.score - b.score);
                let assignedCount = 0;
                for (let i = 0; i < candidates.length && assignedCount < needed; i++) {
                    const cand = candidates[i];
                    const chosen = cand.staffIndex;

                    // ★ リアルタイムスケ可日勤残存チェック（同日にスケ可スタッフが複数特殊勤務に選ばれ、日勤○が2名未満に激減するのを完全防止！）
                    if (this.staffList[chosen].canSched) {
                        let remSchedWorkNow = 0;
                        for (let otherS = 0; otherS < this.numStaff; otherS++) {
                            if (otherS === chosen || this.staffList[otherS].isUnused) continue;
                            if (this.staffList[otherS].canSched && this.grid[otherS][d].symbol === SYMBOLS.WORK) {
                                remSchedWorkNow++;
                            }
                        }
                        const totalSched = this.staffList.filter(s => !s.isUnused && s.canSched).length;
                        if (totalSched >= 2 && remSchedWorkNow < 2) continue;
                    }

                    // ★ リアルタイム1年目制約チェック（既に当日任命されたスタッフを反映した最新状態で厳格検査）
                    if (this.staffList[chosen].isFirstYear) {
                        if (this.isSouth) {
                            if (req.key === 'early') {
                                let curEarlyFY = 0;
                                for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                    if (this.staffList[otherS].isFirstYear && this.grid[otherS][d].symbol === SYMBOLS.EARLY) curEarlyFY++;
                                }
                                if (curEarlyFY >= 1) continue; // 既に当日早番に1年目がいる場合は絶対にスキップ！
                            }
                            if (req.key === 'eve') {
                                let curEveFY = 0;
                                for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                    if (this.staffList[otherS].isFirstYear && this.grid[otherS][d].symbol === SYMBOLS.EVE) curEveFY++;
                                }
                                if (curEveFY >= 1) continue; // 既に当日Eに1年目がいる場合は絶対にスキップ！
                            }
                            const subFl = getSubFloor(chosen);
                            if (req.key === 'late') {
                                let floorEveFY = 0;
                                for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                    if (getSubFloor(otherS) === subFl && this.staffList[otherS].isFirstYear && this.grid[otherS][d].symbol === SYMBOLS.EVE) floorEveFY++;
                                }
                                if (floorEveFY >= 1) continue;
                            }
                            if (req.key === 'eve') {
                                let floorLateFY = 0;
                                for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                    if (getSubFloor(otherS) === subFl && this.staffList[otherS].isFirstYear && this.grid[otherS][d].symbol === SYMBOLS.LATE) floorLateFY++;
                                }
                                if (floorLateFY >= 1) continue;
                            }
                        } else {
                            // 1階・2階・3階（通常病棟）
                            if (req.key === 'early') {
                                let curEarlyFY = 0;
                                for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                    if (this.staffList[otherS].isFirstYear && this.grid[otherS][d].symbol === SYMBOLS.EARLY) curEarlyFY++;
                                }
                                if (curEarlyFY >= 1) continue; // 当日早番に1年目は最大1名！2人目はスキップ！
                            }
                            if (req.key === 'late' || req.key === 'eve') {
                                let curLateEveFY = 0;
                                for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                    if (this.staffList[otherS].isFirstYear && (this.grid[otherS][d].symbol === SYMBOLS.LATE || this.grid[otherS][d].symbol === SYMBOLS.EVE)) curLateEveFY++;
                                }
                                if (curLateEveFY >= 1) continue; // 当日遅・Eに1年目は合計最大1名！2人目はスキップ！
                            }
                        }
                    }

                    this.setSymbol(chosen, d, req.type, false);

                    if (cand.isNextWorkFallback) {
                        // 避けられない状態で翌日休にできなかったケース（ソルバー内部スワップ維持用フラグを付与し、検証画面でエラーを発動させる）
                        this.grid[chosen][d].allowNextWorkFallback = true;
                    } else if (d + 1 < this.numDays) {
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
                    assignedCount++;
                }
            }
        }

        // ★ 特殊勤務（早・遅・E）の回数平準化スワップ（8時スタッフ合計3回上限 ＆ 早・遅・Eの均等平均化）
        this.balanceSpecialDuties();

        return { success: true };
    }

    /**
     * 特殊勤務（早・遅・E）の回数平準化スワップ
     * - 8時スタッフの早・遅・E合計が3回以下（3回程度）になるよう最優先調整
     * - 一般スタッフの合計を4回前後に平準化
     * - 遅番を最大1回、Eを最大2回、早番を2回前後に平準化
     */
    balanceSpecialDuties() {
        const is8 = (s) => !!this.staffList[s].can8;
        const reqTypes = [
            { type: SYMBOLS.LATE, key: 'late', noFlag: 'noLate', maxNormal: (this.isSouth ? 2 : 1), matchSyms: [SYMBOLS.LATE, SYMBOLS.NO_ALLOW_LATE] },
            { type: SYMBOLS.EVE, key: 'eve', noFlag: 'noEve', maxNormal: 2, matchSyms: [SYMBOLS.EVE, SYMBOLS.NO_ALLOW_EVE] },
            { type: SYMBOLS.EARLY, key: 'early', noFlag: 'noEarly', maxNormal: 2, matchSyms: [SYMBOLS.EARLY, SYMBOLS.NO_ALLOW_EARLY] }
        ];

        for (let iter = 0; iter < 120; iter++) {
            let improved = false;

            // 各スタッフの現在回数を集計（8時も含めて厳密に集計！）
            const counts = {
                early: new Array(this.numStaff).fill(0),
                late: new Array(this.numStaff).fill(0),
                eve: new Array(this.numStaff).fill(0),
                h8: new Array(this.numStaff).fill(0),
                total: new Array(this.numStaff).fill(0)
            };
            for (let s = 0; s < this.numStaff; s++) {
                if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;
                for (let d = 0; d < this.numDays; d++) {
                    const sym = this.grid[s][d].symbol;
                    if (sym === SYMBOLS.EARLY) { counts.early[s]++; counts.total[s]++; }
                    if (sym === SYMBOLS.LATE) { counts.late[s]++; counts.total[s]++; }
                    if (sym === SYMBOLS.EVE) { counts.eve[s]++; counts.total[s]++; }
                    if (sym === SYMBOLS.H8) { counts.h8[s]++; }
                }
            }

            // ★ ユーザー指示: 8時がある人は特殊勤務（早・遅・E・8時）を「2つに固定」！一般スタッフは4回均等！
            const overStaffList = [];
            for (let s = 0; s < this.numStaff; s++) {
                if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;
                const has8 = counts.h8[s] > 0 || is8(s);
                let overScore = 0;
                if (has8) {
                    // 8時担当スタッフは早・遅・Eの合計が2回を超えていたら最優先で減らす！
                    if (counts.total[s] > 2) overScore += (counts.total[s] - 2) * 300;
                } else {
                    // 一般スタッフは早・遅・E合計が4回を超えていたら減らす（目標4回）
                    if (counts.total[s] > 4) overScore += (counts.total[s] - 4) * 100;
                }
                if (counts.late[s] > 1) overScore += (counts.late[s] - 1) * 80;
                if (counts.eve[s] > 2) overScore += (counts.eve[s] - 2) * 50;

                if (overScore > 0) {
                    overStaffList.push({ staff: s, overScore, is8: has8 });
                }
            }
            overStaffList.sort((a, b) => b.overScore - a.overScore);

            outerLoop:
            for (const overObj of overStaffList) {
                const sHigh = overObj.staff;

                // sHigh が特殊勤務を担当している日 d を探す
                for (let d = 0; d < this.numDays; d++) {
                    if (this.grid[sHigh][d].isFixed) continue; // 事前希望固定は動かさない
                    const currentSym = this.grid[sHigh][d].symbol;
                    let currentReq = null;
                    if (currentSym === SYMBOLS.EARLY) currentReq = reqTypes[2];
                    else if (currentSym === SYMBOLS.LATE) currentReq = reqTypes[0];
                    else if (currentSym === SYMBOLS.EVE) currentReq = reqTypes[1];
                    if (!currentReq) continue;

                    // 交代候補 sLow を探す:
                    for (let sLow = 0; sLow < this.numStaff; sLow++) {
                        if (sLow === sHigh || this.staffList[sLow].isUnused || this.staffList[sLow].isSectionChief) continue;
                        if (this.staffList[sLow][currentReq.noFlag]) continue;

                        // ★ 南病棟の場合：同一フロア（南2同士、南3同士）でのみ交代を許可！（南2・南3の人数崩れを物理防止）
                        if (this.isSouth && this.getSubFloor(sLow) !== this.getSubFloor(sHigh)) continue;

                        // ★ 南病棟および通常POの1年目制約チェック
                        if (this.staffList[sLow].isFirstYear) {
                            if (this.isSouth) {
                                // 1. 早2人のうち1年目は1人まで
                                if (currentReq.key === 'early') {
                                    let curEarlyFY = 0;
                                    for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                        if (otherS !== sHigh && this.staffList[otherS].isFirstYear && this.grid[otherS][d].symbol === SYMBOLS.EARLY) curEarlyFY++;
                                    }
                                    if (curEarlyFY >= 1) continue;
                                }
                                // 2. E2人のうち1年目は1人まで
                                if (currentReq.key === 'eve') {
                                    let curEveFY = 0;
                                    for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                        if (otherS !== sHigh && this.staffList[otherS].isFirstYear && this.grid[otherS][d].symbol === SYMBOLS.EVE) curEveFY++;
                                    }
                                    if (curEveFY >= 1) continue;
                                }
                                // 3. 遅2人のうち1年目だけで2人OK（制限なし）
                                // 4. 同じフロアの遅とE2人のうち1年目は1人まで
                                const subFl = this.getSubFloor(sLow);
                                if (currentReq.key === 'late') {
                                    let floorEveFY = 0;
                                    for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                        if (otherS !== sHigh && this.getSubFloor(otherS) === subFl && this.staffList[otherS].isFirstYear && this.grid[otherS][d].symbol === SYMBOLS.EVE) floorEveFY++;
                                    }
                                    if (floorEveFY >= 1) continue;
                                }
                                if (currentReq.key === 'eve') {
                                    let floorLateFY = 0;
                                    for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                        if (otherS !== sHigh && this.getSubFloor(otherS) === subFl && this.staffList[otherS].isFirstYear && this.grid[otherS][d].symbol === SYMBOLS.LATE) floorLateFY++;
                                    }
                                    if (floorLateFY >= 1) continue;
                                }
                            } else {
                                if (currentReq.key === 'early') {
                                    let curEarlyFY = 0;
                                    for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                        if (otherS !== sHigh && this.staffList[otherS].isFirstYear && this.grid[otherS][d].symbol === SYMBOLS.EARLY) curEarlyFY++;
                                    }
                                    if (curEarlyFY >= 1) continue;
                                }
                                if (currentReq.key === 'late' || currentReq.key === 'eve') {
                                    let curLateEveFY = 0;
                                    for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                        if (otherS !== sHigh && this.staffList[otherS].isFirstYear && (this.grid[otherS][d].symbol === SYMBOLS.LATE || this.grid[otherS][d].symbol === SYMBOLS.EVE)) curLateEveFY++;
                                    }
                                    if (curLateEveFY >= 1) continue;
                                }
                            }
                        }

                        // ★ ユーザー指示: 8時担当スタッフは早・遅・Eの合計を最大2個に抑える！一般スタッフは最大4回！
                        const isLow8 = counts.h8[sLow] > 0 || is8(sLow);
                        if (isLow8 && counts.total[sLow] >= 2) continue;
                        if (!isLow8 && counts.total[sLow] >= 4) continue;
                        const maxDutyForLow = is8(sLow) ? (currentReq.key === 'early' ? 1 : currentReq.maxNormal) : currentReq.maxNormal;
                        if (counts[currentReq.key][sLow] >= maxDutyForLow) continue;

                        // sLow の日 d が ○（未固定勤務）であること
                        if (this.grid[sLow][d].isFixed || this.grid[sLow][d].symbol !== SYMBOLS.WORK) continue;

                        // スケ可保護：sLow を特殊勤務に変更しても、日 d のスケ可かつ○が2名以上残るか
                        if (this.staffList[sLow].canSched) {
                            let remSched = 0;
                            for (let oS = 0; oS < this.numStaff; oS++) {
                                if (oS === sLow || this.staffList[oS].isUnused) continue;
                                const oSym = (oS === sHigh) ? SYMBOLS.WORK : this.grid[oS][d].symbol;
                                if (this.staffList[oS].canSched && oSym === SYMBOLS.WORK) remSched++;
                            }
                            if (remSched < 2) continue;
                        }

                        // 単発勤務防止: sLowが日dに特殊勤務を入れると1勤にならないか
                        const prevSymLow = this.getSymbol(sLow, d - 1);
                        const nextSymLow = (d + 1 < this.numDays) ? this.getSymbol(sLow, d + 1) : '';
                        if (isHolidaySymbol(prevSymLow) && isHolidaySymbol(nextSymLow)) continue;

                        // パターンA: sLow の翌日 d+1 が元々休日（または最終日）の場合のみ安全に交代（公休日数を1ミリも崩さない）
                        if (d + 1 >= this.numDays || isHolidaySymbol(nextSymLow)) {
                            this.setSymbol(sHigh, d, SYMBOLS.WORK, false);
                            this.setSymbol(sLow, d, currentReq.type, false);

                            const validHigh = this.isStaffHardValid(sHigh);
                            const validLow = this.isStaffHardValid(sLow);
                            const validGlobal = this.isGlobalAttributesValid();

                            if (validHigh && validLow && validGlobal) {
                                improved = true;
                                break outerLoop;
                            } else {
                                // ロールバック
                                this.setSymbol(sHigh, d, currentReq.type, false);
                                this.setSymbol(sLow, d, SYMBOLS.WORK, false);
                            }
                        }
                    }
                }
            }

            if (!improved) break;
        }
    }

    /**
     * ステップ4: 各スタッフの公休枠（28日間で8.0日、3月は8.5日）を厳密に充足し、残りを「○（日勤）」で確定
     * （週単位の組合せバックトラッキング探索により、公休日数・週休2日・連勤5日以内・5連勤後2連休・属性保護を100%充足）
     */
    assignHolidaysAndGeneralDuties() {
        const stdHolidays = this.options.standardHolidays;

        // ★ 役職優先順（1.係長 -> 2.主任 -> 3.副主任 -> 4.一般スタッフ）でスケジュールを確定！
        // 同ランク内ではセクション間（PT A -> PT B -> OT A -> OT B）でラウンドロビン交互に並べることで、特定セクションに初期配置の歪みが偏るのを防止
        const solveOrder = [];
        for (let s = 0; s < this.numStaff; s++) {
            if (!this.staffList[s].isUnused) solveOrder.push(s);
        }
        const rankOf = (idx) => {
            const st = this.staffList[idx];
            if (st.isSectionChief) return 0;
            if (st.isChief) return 1;
            if (st.isSubChief) return 2;
            return 3;
        };
        const secSeqCounters = {};
        const withinSecOrder = {};
        for (const s of solveOrder) {
            const key = `${rankOf(s)}_${this.staffList[s].section || 'OTHER'}`;
            secSeqCounters[key] = (secSeqCounters[key] || 0);
            withinSecOrder[s] = secSeqCounters[key];
            secSeqCounters[key]++;
        }
        solveOrder.sort((a, b) => {
            const rA = rankOf(a), rB = rankOf(b);
            if (rA !== rB) return rA - rB;
            if (withinSecOrder[a] !== withinSecOrder[b]) return withinSecOrder[a] - withinSecOrder[b];
            return a - b;
        });

        for (const s of solveOrder) {
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

        // ★ 係長不在日の主任・副主任（Aチーム1名以上かつBチーム1名以上）出勤保証リペア
        this.ensureRoleCoverage();
    }

    /**
     * 係長不在日に「主任1名以上」または「副主任A（PT A/OT A）1名以上 かつ 副主任B（PT B/OT B）1名以上」が
     * 確実に出勤しているかを全日で点検し、不足日があれば主任または該当チームの副主任の非固定公休を他日とスワップして自動リペアする
     */
    ensureRoleCoverage() {
        const scIndices = [];
        const chIndices = [];
        const subAIndices = [];
        const subBIndices = [];
        for (let s = 0; s < this.numStaff; s++) {
            const st = this.staffList[s];
            if (st.isUnused) continue;
            if (st.isSectionChief) scIndices.push(s);
            if (st.isChief) chIndices.push(s);
            if (st.isSubChief) {
                const sec = st.section || '';
                if (sec === 'PT A' || sec === 'OT A' || sec.includes('A') || sec.includes('2')) subAIndices.push(s);
                else if (sec === 'PT B' || sec === 'OT B' || sec.includes('B') || sec.includes('3')) subBIndices.push(s);
            }
        }
        if (this.isST) return; // ST単独では役職者必須制約なし
        if (chIndices.length === 0 && subAIndices.length === 0 && subBIndices.length === 0) return;

        const isWorkingOnDay = (s, d) => {
            const sym = this.grid[s][d].symbol;
            return isWorkSymbol(sym) && sym !== SYMBOLS.TRIP && !isExcludeSymbol(sym);
        };

        const isRoleCoveredOnDay = (d) => {
            if (this.isST) return true;
            if (scIndices.some(s => isWorkingOnDay(s, d))) return true;
            if (chIndices.some(s => isWorkingOnDay(s, d))) return true;
            if (this.options && this.options.stChiefWorkingDays && this.options.stChiefWorkingDays.has(d)) return true;
            const hasSubA = subAIndices.some(s => isWorkingOnDay(s, d));
            const hasSubB = subBIndices.some(s => isWorkingOnDay(s, d));
            const hasStSub = this.options && this.options.stSubChiefWorkingDays && this.options.stSubChiefWorkingDays.has(d);
            if ((subAIndices.length === 0 || hasSubA) && (subBIndices.length === 0 || hasSubB) && (hasSubA || hasSubB)) {
                return true;
            }
            if (hasStSub && (hasSubA || hasSubB)) {
                return true;
            }
            return false;
        };

        const tryBringInStaffOnDay = (targetStaffIndices, d) => {
            for (const s of targetStaffIndices) {
                if (isWorkingOnDay(s, d)) return true;
                if (this.grid[s][d].isFixed || this.grid[s][d].isAfterPreSpecial || this.grid[s][d].symbol !== SYMBOLS.OFF) continue;

                // 他日の非固定「○」を「休」にスワップできる日を探索（同週優先、他日の役職カバレッジを壊さない日を優先）
                const dWeek = this.weekSpans.findIndex(span => span.includes(d));
                const candDays = [];
                for (let otherD = 0; otherD < this.numDays; otherD++) {
                    if (otherD === d) continue;
                    if (this.grid[s][otherD].isFixed || this.grid[s][otherD].symbol !== SYMBOLS.WORK) continue;
                    const oWeek = this.weekSpans.findIndex(span => span.includes(otherD));
                    candDays.push({
                        day: otherD,
                        sameWeek: (oWeek === dWeek) ? 1 : 0,
                        realLoad: this.getDailyEffectiveRealLoad(otherD)
                    });
                }
                candDays.sort((a, b) => {
                    if (a.sameWeek !== b.sameWeek) return b.sameWeek - a.sameWeek;
                    return b.realLoad - a.realLoad;
                });

                for (const cObj of candDays) {
                    const otherD = cObj.day;
                    this.setSymbol(s, d, SYMBOLS.WORK, false);
                    this.setSymbol(s, otherD, SYMBOLS.OFF, false);
                    const ok = this.isStaffHardValid(s) && isRoleCoveredOnDay(otherD) && this.isGlobalAttributesValid();
                    if (ok) {
                        return true;
                    }
                    this.setSymbol(s, d, SYMBOLS.OFF, false);
                    this.setSymbol(s, otherD, SYMBOLS.WORK, false);
                }
            }
            return false;
        };

        for (let d = 0; d < this.numDays; d++) {
            if (isRoleCoveredOnDay(d)) continue;
            // 1. まず主任を出勤させられるか試行
            if (tryBringInStaffOnDay(chIndices, d) && isRoleCoveredOnDay(d)) continue;
            // 2. 主任が無理なら、不足している副主任A・副主任Bを両方揃えるよう試行
            if (!subAIndices.some(s => isWorkingOnDay(s, d))) {
                tryBringInStaffOnDay(subAIndices, d);
            }
            if (!subBIndices.some(s => isWorkingOnDay(s, d))) {
                tryBringInStaffOnDay(subBIndices, d);
            }
        }
    }

    /**
     * スケ可スタッフ（canSched）が毎日日勤（○）で2名以上出勤しているかを全日で点検し、
     * 不足日があればスケ可スタッフの他日の非固定公休をスワップして自動充足する
     */
    ensureSchedCoverage() {
        if (this.isST || this.isLife) return;
        const schedIndices = [];
        for (let s = 0; s < this.numStaff; s++) {
            if (!this.staffList[s].isUnused && this.staffList[s].canSched) {
                schedIndices.push(s);
            }
        }
        if (schedIndices.length < 2) return;

        for (let d = 0; d < this.numDays; d++) {
            let curCount = 0;
            for (const s of schedIndices) {
                const sym = this.grid[s][d].symbol;
                if (sym === SYMBOLS.WORK || sym === '○') curCount++;
            }
            if (curCount < 2) {
                for (const s of schedIndices) {
                    if (curCount >= 2) break;
                    if (this.grid[s][d].isFixed || this.grid[s][d].isAfterPreSpecial || this.grid[s][d].symbol !== SYMBOLS.OFF) continue;

                    for (let otherD = 0; otherD < this.numDays; otherD++) {
                        if (otherD === d || this.grid[s][otherD].isFixed || this.grid[s][otherD].symbol !== SYMBOLS.WORK) continue;

                        let otherSchedCount = 0;
                        for (const os of schedIndices) {
                            const osSym = this.grid[os][otherD].symbol;
                            if (osSym === SYMBOLS.WORK || osSym === '○') otherSchedCount++;
                        }
                        if (otherSchedCount <= 2) continue;

                        this.setSymbol(s, d, SYMBOLS.WORK, false);
                        this.setSymbol(s, otherD, SYMBOLS.OFF, false);

                        if (this.isStaffHardValid(s) && this.isGlobalAttributesValid()) {
                            curCount++;
                            break;
                        } else {
                            this.setSymbol(s, d, SYMBOLS.OFF, false);
                            this.setSymbol(s, otherD, SYMBOLS.WORK, false);
                        }
                    }
                }
            }
        }
    }

    // ★ 専従スタッフ出勤保証リペア（専従PT・OT・ST合算で毎日3名以上の出勤を100%維持）
    ensureFullTimeCoverage() {
        if (this.isST || this.isLife) return;
        const ftIndices = [];
        for (let s = 0; s < this.numStaff; s++) {
            if (!this.staffList[s].isUnused && this.staffList[s].isFullTime) {
                ftIndices.push(s);
            }
        }
        if (ftIndices.length < 3) return;

        for (let d = 0; d < this.numDays; d++) {
            let curCount = 0;
            for (const s of ftIndices) {
                const sym = this.grid[s][d].symbol;
                if (isWorkSymbol(sym) && sym !== SYMBOLS.TRIP) curCount++;
            }
            if (curCount < 3) {
                for (const s of ftIndices) {
                    if (curCount >= 3) break;
                    if (this.grid[s][d].isFixed || this.grid[s][d].isAfterPreSpecial || this.grid[s][d].symbol !== SYMBOLS.OFF) continue;

                    for (let otherD = 0; otherD < this.numDays; otherD++) {
                        if (otherD === d || this.grid[s][otherD].isFixed || this.grid[s][otherD].symbol !== SYMBOLS.WORK) continue;

                        let otherFtCount = 0;
                        for (const os of ftIndices) {
                            const osSym = this.grid[os][otherD].symbol;
                            if (isWorkSymbol(osSym) && osSym !== SYMBOLS.TRIP) otherFtCount++;
                        }
                        if (otherFtCount <= 3) continue;

                        this.setSymbol(s, d, SYMBOLS.WORK, false);
                        this.setSymbol(s, otherD, SYMBOLS.OFF, false);

                        if (this.isStaffHardValid(s) && this.isGlobalAttributesValid()) {
                            curCount++;
                            break;
                        } else {
                            this.setSymbol(s, d, SYMBOLS.OFF, false);
                            this.setSymbol(s, otherD, SYMBOLS.WORK, false);
                        }
                    }
                }
            }
        }
    }

    /**
     * スタッフ s のスケジュールを「週単位の休日配置バックトラッキング」で完全充足生成
     */
    solveStaffScheduleWeekly(s, targetOff, maxConsec) {
        if (this.staffList[s] && this.staffList[s].isSectionChief) {
            const scRes = this.solveSectionChiefSchedule(s, targetOff, maxConsec);
            if (scRes) return scRes;
        }
        // strictLevel: 0 (属性厳格), 1 (属性緩和), 2 (個人ハード制約最優先) で多段階試行
        for (let strictLevel = 0; strictLevel <= 2; strictLevel++) {
            const res = this.solveStaffScheduleWeeklyInternal(s, targetOff, maxConsec, strictLevel);
            if (res) return res;
        }
        return null;
    }

    /**
     * ★ 係長（isSectionChief）専用の柔軟スケジュール生成エンジン
     * - 原則: 月曜日〜金曜日（祝日含む）は出勤「○」、土曜日・日曜日は公休「休」、自動特殊勤務なし
     * - 希望の特殊勤務（早・遅・E・8時等）はそのまま残し、早・遅・Eの翌日は「休」を確保
     * - 土日に希望の「○」（等）がある場合は、5連勤制限・週出勤5日制限・主任出勤状況を踏まえて柔軟に平日に「休」を配置
     */
    solveSectionChiefSchedule(s, targetOff, maxConsec) {
        const staff = this.staffList[s];
        const numDays = this.numDays;
        const baseSymbols = new Array(numDays);
        const unfixedWeekdays = [];

        let currentOff = 0;
        let weekendFixedWorkDays = [];

        for (let d = 0; d < numDays; d++) {
            const cell = this.grid[s][d];
            const isWkday = this.isWeekdayIndex(d);
            const isRefSym = SYMBOLS.REF_SUMMER.includes(cell.symbol) || SYMBOLS.REF_WINTER.includes(cell.symbol);
            if (cell.isFixed || cell.isAfterPreSpecial || isRefSym) {
                baseSymbols[d] = cell.symbol;
                if (cell.symbol === SYMBOLS.OFF) currentOff += 1.0;
                else if (cell.symbol === SYMBOLS.HALF_WORK_OFF || cell.symbol === SYMBOLS.HALF_OFF_WORK) currentOff += 0.5;
                if (!isWkday && isWorkSymbol(cell.symbol)) {
                    weekendFixedWorkDays.push(d);
                }
            } else if (!isWkday) {
                // 未固定の土日は原則「休」
                baseSymbols[d] = SYMBOLS.OFF;
                currentOff += 1.0;
            } else {
                // 未固定の平日は原則「○」
                baseSymbols[d] = SYMBOLS.WORK;
                unfixedWeekdays.push(d);
            }
        }

        // 前ターム末(prevDays)の構築:
        // 第1週の土曜(d=3)等に希望の「○」が入っている場合、前ターム月・火が空欄なら平日出勤していたものとみなして連勤チェックを行う
        const getPrevSeq = () => {
            const seq = [];
            const pLen = (staff.prevDays && staff.prevDays.length) ? staff.prevDays.length : 0;
            const firstSatFixedWork = weekendFixedWorkDays.some(wd => wd < 5);
            const firstDateObj = (this.dates && this.dates[0]) ? new Date(this.dates[0].dateStr + 'T00:00:00') : null;
            for (let p = 0; p < pLen; p++) {
                let pSym = (staff.prevDays && staff.prevDays[p]) ? staff.prevDays[p] : '';
                let isSatOrSun = false;
                let isMonOrTue = false;
                if (firstDateObj) {
                    const prevD = new Date(firstDateObj);
                    prevD.setDate(prevD.getDate() - (pLen - p));
                    const dow = prevD.getDay();
                    if (dow === 0 || dow === 6) isSatOrSun = true;
                    if (dow === 1 || dow === 2) isMonOrTue = true;
                } else {
                    if (pLen === 7) {
                        if (p === 3 || p === 4) isSatOrSun = true;
                        if (p === 5 || p === 6) isMonOrTue = true;
                    } else {
                        if (p === 1 || p === 2) isSatOrSun = true;
                        if (p === 3 || p === 4) isMonOrTue = true;
                    }
                }
                if (isSatOrSun) {
                    // 前タームの土日にダミーの○が入っていても、係長の通常サイクルを阻害しないよう休扱い
                    if (isWorkSymbol(pSym)) pSym = SYMBOLS.OFF;
                } else if (isMonOrTue && pSym === '' && firstSatFixedWork) {
                    pSym = SYMBOLS.WORK;
                }
                seq.push(pSym);
            }
            return seq;
        };

        const prevSeq = getPrevSeq();

        // スケジュール候補が連勤制限(maxConsec)と週5日勤務制限を満たすか検証する関数
        const isCandidateValid = (candSymbols, checkChief = true) => {
            // 最終週の日曜(d >= numDays - 4)に希望出勤がある場合、次ターム水・木・金の平日3連勤を見越して末尾連勤もチェック
            const lastSunWork = weekendFixedWorkDays.some(wd => wd >= numDays - 4);
            const nextSeq = lastSunWork ? [SYMBOLS.WORK, SYMBOLS.WORK, SYMBOLS.WORK] : [];
            const seq = prevSeq.concat(candSymbols).concat(nextSeq);
            // ※ 係長のみ特殊勤務の翌日は休みにしなくてよいため翌日休チェックは行わない
            // 2. 連勤制限 (maxConsec = 5 or 6)
            let consec = 0;
            for (let i = 0; i < seq.length; i++) {
                if (seq[i] === '') consec = 0;
                else if (!isPurePublicOffSymbol(seq[i])) {
                    consec++;
                    if (consec > maxConsec) return false;
                } else {
                    consec = 0;
                }
            }
            // 3. 週（日〜土）出勤制限（最大5日）
            if (!staff.allow6Consec) {
                for (const wSpan of this.weekSpans) {
                    let weekWork = 0;
                    for (const d of wSpan) {
                        const sym = candSymbols[d];
                        if (sym && isWorkSymbol(sym) && sym !== SYMBOLS.TRIP && !isHalfDuty(sym)) {
                            weekWork++;
                        }
                    }
                    if (weekWork > 5) return false;
                }
            }
            // 4. 平日に係長が休む日は、主任が1名以上出勤可能（主任が難しい場合は副主任A・B両方が出勤可能）であること
            if (checkChief) {
                const chList = this.staffList.filter(st => !st.isUnused && st.isChief);
                const subList = this.staffList.filter(st => !st.isUnused && st.isSubChief);
                for (let d = 0; d < numDays; d++) {
                    if (!this.isWeekdayIndex(d)) continue;
                    if (isHolidaySymbol(candSymbols[d]) || candSymbols[d] === SYMBOLS.TRIP) {
                        const anyChiefAvailable = chList.some(ch => {
                            const chIdx = this.staffList.indexOf(ch);
                            const chSym = this.grid[chIdx][d].symbol;
                            return !isHolidaySymbol(chSym) && chSym !== SYMBOLS.TRIP && !isExcludeSymbol(chSym);
                        });
                        if (!anyChiefAvailable) {
                            let subAAvail = false, subBAvail = false;
                            subList.forEach(sub => {
                                const subIdx = this.staffList.indexOf(sub);
                                const subSym = this.grid[subIdx][d].symbol;
                                if (!isHolidaySymbol(subSym) && subSym !== SYMBOLS.TRIP && !isExcludeSymbol(subSym)) {
                                    const sec = sub.section || '';
                                    if (sec === 'PT A' || sec === 'OT A' || sec.includes('A') || sec.includes('2')) subAAvail = true;
                                    else if (sec === 'PT B' || sec === 'OT B' || sec.includes('B') || sec.includes('3')) subBAvail = true;
                                }
                            });
                            if (!(subAAvail && subBAvail)) return false;
                        }
                    }
                }
            }
            return true;
        };

        // 候補のスコア評価（土日出勤の近くで代休を取り、連勤を短くし、全体の実数合計も平準化する）
        const scoreCandidate = (chosenWeekdays, candSymbols) => {
            let score = 0;
            for (const d of chosenWeekdays) {
                // 土日出勤日との距離が近い平日（同じ週または直前・直後の平日）を高く評価
                let minDist = 99;
                for (const wd of weekendFixedWorkDays) {
                    minDist = Math.min(minDist, Math.abs(d - wd));
                }
                if (minDist <= 5) score += (6 - minDist) * 80;

                // 主任が多く出勤できる日を優先
                let chAvail = 0;
                for (let otherS = 0; otherS < this.numStaff; otherS++) {
                    if (this.staffList[otherS].isUnused || !this.staffList[otherS].isChief) continue;
                    const sym = this.grid[otherS][d].symbol;
                    if (!isHolidaySymbol(sym) && sym !== SYMBOLS.TRIP) chAvail++;
                }
                score += chAvail * 50;

                // 日別の他スタッフ休日実数が少ない日（出勤に余裕がある日）を優先
                const offset = (this.dayOffsets && this.dayOffsets[d]) ? this.dayOffsets[d] : 0;
                let offReal = 0;
                for (let otherS = 0; otherS < this.numStaff; otherS++) {
                    if (otherS === s || this.staffList[otherS].isUnused) continue;
                    if (isHolidaySymbol(this.grid[otherS][d].symbol)) {
                        offReal += (this.staffList[otherS].isHalf ? 0.5 : 1.0);
                    }
                }
                score -= (offReal + offset) * 20;
            }

            // 最大連勤数が短いほど高評価（例: 3連勤・4連勤に分割できる位置を優遇）
            const seq = prevSeq.concat(candSymbols);
            let cur = 0, maxStr = 0, sumSq = 0;
            for (const sym of seq) {
                if (sym !== '' && !isFullOffSymbol(sym)) {
                    cur++;
                    if (cur > maxStr) maxStr = cur;
                } else {
                    sumSq += cur * cur;
                    cur = 0;
                }
            }
            sumSq += cur * cur;
            score -= sumSq * 5;
            return score;
        };

        // ★ 平日希望休・固定休によって土日休との合計が targetOff（8日）を超える場合、
        // 未固定の土日の中から超過分（currentOff - targetOff）を「○」に振り替え、全体の公休数を8日に保つ！
        if (currentOff > targetOff) {
            const excessOff = Math.round(currentOff - targetOff);
            const unfixedWeekendOffs = [];
            for (let d = 0; d < numDays; d++) {
                if (!this.isWeekdayIndex(d) && !this.grid[s][d].isFixed && !this.grid[s][d].isAfterPreSpecial && baseSymbols[d] === SYMBOLS.OFF) {
                    const wSpan = this.weekSpans.find(span => span.includes(d));
                    const hasWeekdayOffInWeek = wSpan ? wSpan.some(wd => this.isWeekdayIndex(wd) && isHolidaySymbol(baseSymbols[wd])) : false;
                    unfixedWeekendOffs.push({ d, hasWeekdayOffInWeek });
                }
            }
            // 平日休がある週の土日を優先して「○」に振替
            unfixedWeekendOffs.sort((a, b) => (b.hasWeekdayOffInWeek ? 1 : 0) - (a.hasWeekdayOffInWeek ? 1 : 0));
            let converted = 0;
            for (const item of unfixedWeekendOffs) {
                if (converted >= excessOff) break;
                baseSymbols[item.d] = SYMBOLS.WORK;
                converted++;
                currentOff -= 1.0;
            }
        }

        // 未固定の土日休だけでは足りない公休数、および土日希望出勤分の代休数を算出
        let weekendOffCount = 0;
        let weekdayFixedOffCount = 0;
        for (let d = 0; d < numDays; d++) {
            const isWkday = this.isWeekdayIndex(d);
            const cell = this.grid[s][d];
            if (!isWkday) {
                if (baseSymbols[d] === SYMBOLS.OFF) weekendOffCount += 1.0;
                else if (baseSymbols[d] === SYMBOLS.HALF_WORK_OFF || baseSymbols[d] === SYMBOLS.HALF_OFF_WORK) weekendOffCount += 0.5;
            } else if (cell.isFixed && cell.symbol === SYMBOLS.OFF) {
                weekdayFixedOffCount += 1.0;
            }
        }
        // 土日に希望出勤(○等)がある場合は、事前固定の平日公休を除き、その分だけ平日に代休を入れる（特殊勤務翌日休とは別枠でも柔軟に確保）
        const neededForWeekendWork = Math.max(0, weekendFixedWorkDays.length - weekdayFixedOffCount);
        const neededOffCount = Math.max(0, Math.round(targetOff - currentOff), neededForWeekendWork);

        // もし追加の平日休が0日でそのまま制約クリアなら即確定
        if (neededOffCount === 0 && isCandidateValid(baseSymbols, false)) {
            return baseSymbols;
        }

        // ★ ユーザー指示: 係長（スタッフ01）の公休日数が9日になるバグを根絶！
        // 平日代休等を追加しても、全タームの公休日数が厳格に targetOff（8日）ちょうどになるよう土日休を「○」に振替調整
        const finalizeChiefSchedule = (symbols) => {
            if (!symbols) return symbols;
            const res = [...symbols];
            let offCount = 0;
            for (let d = 0; d < numDays; d++) {
                if (res[d] === SYMBOLS.OFF) offCount += 1.0;
                else if (res[d] === SYMBOLS.HALF_WORK_OFF || res[d] === SYMBOLS.HALF_OFF_WORK) offCount += 0.5;
            }
            if (offCount > targetOff) {
                let toRemove = Math.round(offCount - targetOff);
                // まず未固定の土日休を優先して「○」に変更
                for (let d = numDays - 1; d >= 0 && toRemove > 0; d--) {
                    if (!this.isWeekdayIndex(d) && !this.grid[s][d].isFixed && !this.grid[s][d].isAfterPreSpecial && res[d] === SYMBOLS.OFF) {
                        res[d] = SYMBOLS.WORK;
                        toRemove--;
                    }
                }
                // それでも超過していれば未固定の平日休を「○」に変更
                for (let d = numDays - 1; d >= 0 && toRemove > 0; d--) {
                    if (this.isWeekdayIndex(d) && !this.grid[s][d].isFixed && !this.grid[s][d].isAfterPreSpecial && res[d] === SYMBOLS.OFF) {
                        res[d] = SYMBOLS.WORK;
                        toRemove--;
                    }
                }
            }
            return res;
        };

        // 必要公休数 neededOffCount（それで連勤が解消しない場合は +1〜+2 日まで柔軟に許容）の平日休組み合わせを探索
        for (const checkChief of [true, false]) {
            // ★ ユーザー指示: 公休が9日になるバグを根絶。追加平日公休数は neededOffCount（ちょうど8日になる数）に厳格固定！
        for (let k = neededOffCount; k <= neededOffCount; k++) {
                if (k === 0) {
                    if (isCandidateValid(baseSymbols, checkChief)) return baseSymbols;
                    continue;
                }

                let bestCand = null;
                let bestScore = -1e9;

                const searchComb = (startIdx, chosen) => {
                    if (chosen.length === k) {
                        const cand = [...baseSymbols];
                        for (const d of chosen) cand[d] = SYMBOLS.OFF;
                        if (isCandidateValid(cand, checkChief)) {
                            const sc = scoreCandidate(chosen, cand);
                            if (sc > bestScore) {
                                bestScore = sc;
                                bestCand = cand;
                            }
                        }
                        return;
                    }
                    for (let i = startIdx; i <= unfixedWeekdays.length - (k - chosen.length); i++) {
                        chosen.push(unfixedWeekdays[i]);
                        searchComb(i + 1, chosen);
                        chosen.pop();
                    }
                };

                searchComb(0, []);
                if (bestCand) return finalizeChiefSchedule(bestCand);
            }
        }

        return finalizeChiefSchedule(baseSymbols);
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
            if (this.grid[s][d].isFixed || this.grid[s][d].isAfterPreSpecial) {
                const sym = this.grid[s][d].symbol;
                if (sym === SYMBOLS.OFF) fixedPublicOff += 1.0;
                else if (sym === SYMBOLS.HALF_WORK_OFF || sym === SYMBOLS.HALF_OFF_WORK) fixedPublicOff += 0.5;
            }
        }
        const neededOff = targetOff - fixedPublicOff;
        if (neededOff < 0) return null;

        // 各日ですでに休日（固定または他のスタッフで確定）になっている「実数換算（0.5トグル・半休反映）」およびセクション・チーム別休日数を集計
        const dailyOffCounts = new Array(numDays).fill(0);
        const dailyH8OffCounts = new Array(numDays).fill(0);
        const dailySchedOffCounts = new Array(numDays).fill(0);
        const dailyRoleOffCounts = new Array(numDays).fill(0);
        const dailyFullTimeOffCounts = new Array(numDays).fill(0);
        const dailySameSecOffCounts = new Array(numDays).fill(0);
        const dailySameTeamOffCounts = new Array(numDays).fill(0);

        const selfSec = staff.section || '';
        const selfTeam = (selfSec === 'PT A' || selfSec === 'OT A') ? 'A' : ((selfSec === 'PT B' || selfSec === 'OT B') ? 'B' : '');
        let sameSecConfiguredCount = 0;
        let sameTeamConfiguredCount = 0;

        for (let otherS = 0; otherS < this.numStaff; otherS++) {
            if (otherS === s || this.staffList[otherS].isUnused) continue;
            const otherWeight = this.staffList[otherS].isHalf ? 0.5 : 1.0;
            const oSec = this.staffList[otherS].section || '';
            const oTeam = (oSec === 'PT A' || oSec === 'OT A') ? 'A' : ((oSec === 'PT B' || oSec === 'OT B') ? 'B' : '');
            const isSameSec = (selfSec !== '' && oSec === selfSec);
            const isSameTeam = (selfTeam !== '' && oTeam === selfTeam);

            let otherHasAnyAssigned = false;
            for (let d = 0; d < numDays; d++) {
                const sym = this.grid[otherS][d].symbol;
                if (sym !== '') otherHasAnyAssigned = true;
                if (isHolidaySymbol(sym)) {
                    dailyOffCounts[d] += otherWeight;
                    if (this.staffList[otherS].can8) dailyH8OffCounts[d]++;
                    if (this.staffList[otherS].canSched) dailySchedOffCounts[d]++;
                    if (this.staffList[otherS].isSectionChief || this.staffList[otherS].isChief) dailyRoleOffCounts[d]++;
                    if (this.staffList[otherS].isFullTime) dailyFullTimeOffCounts[d]++;
                    if (isSameSec) dailySameSecOffCounts[d] += 1.0;
                    if (isSameTeam) dailySameTeamOffCounts[d] += 1.0;
                } else if (isHalfDuty(sym)) {
                    dailyOffCounts[d] += 0.5 * otherWeight;
                    if (isSameSec) dailySameSecOffCounts[d] += 0.5;
                    if (isSameTeam) dailySameTeamOffCounts[d] += 0.5;
                }
            }
            if (otherHasAnyAssigned) {
                if (isSameSec) sameSecConfiguredCount++;
                if (isSameTeam) sameTeamConfiguredCount++;
            }
        }

        // 各週で週出勤5日以内に抑えるために最低限必要な公休日数を算出
        const maxWorkAllowed = staff.allow6Consec ? 6 : 5;
        const minNeededPerWeek = [];
        weekSpans.forEach(wSpan => {
            let fixedHolidayCount = 0;
            wSpan.forEach(d => {
                const sym = (self.grid[s][d].isFixed || self.grid[s][d].isAfterPreSpecial) ? self.grid[s][d].symbol : '';
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

        // ★ 各週の日数と既存の休日実数（dailyOffCounts + dayOffsets）およびセクション・チーム休日数から、全週でフラットになるよう週別配分をソート
        const staffRealW = staff.isHalf ? 0.5 : 1.0;
        const weekCurrentAvgOff = weekSpans.map(wSpan => {
            let sum = 0;
            wSpan.forEach(d => {
                const offset = (self.dayOffsets && self.dayOffsets[d]) ? self.dayOffsets[d] : 0;
                let selfFixedOff = 0;
                if (self.grid[s][d].isFixed) {
                    const sym = self.grid[s][d].symbol;
                    if (isHolidaySymbol(sym)) selfFixedOff = staffRealW;
                    else if (isHalfDuty(sym)) selfFixedOff = 0.5 * staffRealW;
                }
                // 出勤が-2(offset<0)の日は休日を+2名多く必要とするため、平日規模換算値は dailyOff + offset
                sum += dailyOffCounts[d] + selfFixedOff + offset;
            });
            return sum / wSpan.length;
        });
        const weekSecAvgOff = weekSpans.map(wSpan => {
            let sum = 0;
            wSpan.forEach(d => {
                let selfFixedOff = 0;
                if (self.grid[s][d].isFixed) {
                    const sym = self.grid[s][d].symbol;
                    if (isHolidaySymbol(sym)) selfFixedOff = 1.0;
                    else if (isHalfDuty(sym)) selfFixedOff = 0.5;
                }
                sum += dailySameSecOffCounts[d] + selfFixedOff;
            });
            return sum / wSpan.length;
        });
        const overallAvgOff = weekCurrentAvgOff.reduce((acc, v, i) => acc + v * weekSpans[i].length, 0) / numDays;
        const overallSecAvgOff = weekSecAvgOff.reduce((acc, v, i) => acc + v * weekSpans[i].length, 0) / numDays;

        distributionPatterns.sort((a, b) => {
            let costA = 0, costB = 0;
            for (let w = 0; w < totalWeeks; w++) {
                const wLen = weekSpans[w].length;
                const afterAvgA = weekCurrentAvgOff[w] + (a[w] * staffRealW) / wLen;
                const afterAvgB = weekCurrentAvgOff[w] + (b[w] * staffRealW) / wLen;
                const idealAfter = overallAvgOff + (neededOff * staffRealW) / numDays;
                costA += Math.pow(afterAvgA - idealAfter, 2) * wLen;
                costB += Math.pow(afterAvgB - idealAfter, 2) * wLen;

                if (selfSec !== '') {
                    const afterSecA = weekSecAvgOff[w] + a[w] / wLen;
                    const afterSecB = weekSecAvgOff[w] + b[w] / wLen;
                    const idealSecAfter = overallSecAvgOff + neededOff / numDays;
                    costA += Math.pow(afterSecA - idealSecAfter, 2) * wLen * 0.6;
                    costB += Math.pow(afterSecB - idealSecAfter, 2) * wLen * 0.6;
                }
            }
            return costA - costB;
        });

        // 選択された休日候補のスコア計算ヘルパー
        const expectedAvgEffectiveOffAfterSelf = overallAvgOff + (neededOff * staffRealW) / numDays;
        const expectedSecAvgOffAfterSelf = overallSecAvgOff + neededOff / numDays;
        const totalTeamOffSum = dailySameTeamOffCounts.reduce((acc, v) => acc + v, 0);
        const expectedTeamAvgOffAfterSelf = (totalTeamOffSum + neededOff) / numDays;

        function calcChoiceScore(days, isConsecutive = false) {
            let score = 0;
            if (isConsecutive) score += 80;

            for (const d of days) {
                const currentOff = dailyOffCounts[d];
                // ★ 全体の実数合計平準化（出勤が-2の日は休日を+2多く配置するため、平日換算実効休日数は currentOff + offset）
                const offset = (self.dayOffsets && self.dayOffsets[d]) ? self.dayOffsets[d] : 0;
                const effectiveOffAfter = currentOff + staffRealW + offset;
                const diffFromIdeal = effectiveOffAfter - expectedAvgEffectiveOffAfterSelf;
                score -= diffFromIdeal * 65;
                if (diffFromIdeal > 0) {
                    score -= Math.pow(diffFromIdeal, 2) * 45;
                }

                // ★ セクション単体（PT A, PT B, OT A, OT B）および A/Bチーム合算（PT A+OT A, PT B+OT B）の平準化:
                // 日別加減枠（offset !== 0）が発動している日は調整しやすい方で柔軟に調整できるよう重みを0.35倍に緩和
                const secTeamWeight = (offset !== 0) ? 0.35 : 1.0;
                if (selfSec !== '') {
                    const secOffAfter = dailySameSecOffCounts[d] + 1.0;
                    const secDiff = secOffAfter - expectedSecAvgOffAfterSelf;
                    score -= secDiff * 42 * secTeamWeight;
                    if (secDiff > 0) {
                        score -= Math.pow(secDiff, 2) * 38 * secTeamWeight;
                    }
                }
                if (selfTeam !== '') {
                    const teamOffAfter = dailySameTeamOffCounts[d] + 1.0;
                    const teamDiff = teamOffAfter - expectedTeamAvgOffAfterSelf;
                    score -= teamDiff * 28 * secTeamWeight;
                    if (teamDiff > 0) {
                        score -= Math.pow(teamDiff, 2) * 24 * secTeamWeight;
                    }
                }

                if (staff.can8) score -= dailyH8OffCounts[d] * 30;
                if (staff.canSched) score -= dailySchedOffCounts[d] * 35;
                if (staff.isSectionChief) {
                    // 係長は土日(非平日)を休みにするのを絶対優先
                    if (!self.isWeekdayIndex(d)) score += 500;
                    else score -= 2000;
                }
                if (staff.isChief) score -= dailyRoleOffCounts[d] * 45;
                if (staff.isSubChief) {
                    // 係長・主任が休みの日は副主任を多めに出勤させるため、その日の休日取得にペナルティ
                    score -= dailyRoleOffCounts[d] * 40;
                }
                if (staff.isFullTime) score -= dailyFullTimeOffCounts[d] * 25;

                const prev = (d === 0) ? ((staff.prevDays && staff.prevDays.length) ? staff.prevDays[staff.prevDays.length - 1] : '') : self.grid[s][d - 1].symbol;
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
            const blankDays = wSpan.filter(d => !self.grid[s][d].isFixed && !self.grid[s][d].isAfterPreSpecial && self.canPlaceHoliday(s, d, strictLevel));
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
                        if (self.grid[s][d].isFixed || self.grid[s][d].isAfterPreSpecial) {
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

        // ★ 係長の平日出勤・土日休の厳格検証:
        // 未固定の平日(月〜金)に「休」が入っており、その数が許容上限(通常0)を超えている場合は不可
        if (staff.isSectionChief) {
            const maxWeekdayOff = this.getMaxAllowedUnfixedWeekdayOffForSectionChief(s);
            let unfixedWeekdayOff = 0;
            for (let d = 0; d < this.numDays; d++) {
                if (!this.grid[s][d].isFixed && this.isWeekdayIndex(d) && isHolidaySymbol(gridSymbols[d])) {
                    unfixedWeekdayOff++;
                }
            }
            if (unfixedWeekdayOff > maxWeekdayOff) return false;
        }

        const sequence = [];
        const pDays = staff.prevDays || [];
        const pLen = pDays.length;
        const firstDateObj = (this.dates && this.dates[0]) ? new Date(this.dates[0].dateStr + 'T00:00:00') : null;
        for (let p = 0; p < pLen; p++) {
            let pSym = pDays[p] || '';
            let isSatOrSun = false;
            if (firstDateObj) {
                const prevD = new Date(firstDateObj);
                prevD.setDate(prevD.getDate() - (pLen - p));
                const dow = prevD.getDay();
                if (dow === 0 || dow === 6) isSatOrSun = true;
            } else {
                if (pLen === 7 && (p === 3 || p === 4)) isSatOrSun = true;
                if (pLen === 5 && (p === 1 || p === 2)) isSatOrSun = true;
            }
            if (staff.isSectionChief && isSatOrSun && isWorkSymbol(pSym)) {
                pSym = SYMBOLS.OFF;
            }
            sequence.push(pSym);
        }
        for (let d = 0; d < this.numDays; d++) sequence.push(gridSymbols[d]);

        // 1. 特殊勤務翌日休制約（※係長は翌日休不要、またその他職員も事前希望等で避けられない場合は許容）
        if (!staff.isSectionChief) {
            for (let i = 0; i < sequence.length - 1; i++) {
                if (isRestrictedSpecial(sequence[i]) && !isHolidaySymbol(sequence[i + 1])) {
                    const dCur = i - pLen;
                    const dNext = dCur + 1;
                    const isFixedConflict = (dCur >= 0 && dNext < this.numDays && this.grid[s][dCur].isFixed && this.grid[s][dNext].isFixed);
                    if (!isFixedConflict) return false;
                }
            }
        }

        // 2. 連勤制限（公休間隔カウント。有休やリフがあっても公休ではないためカウント継続！）
        let consec = 0;
        for (let i = 0; i < sequence.length; i++) {
            if (sequence[i] === '') {
                consec = 0;
            } else if (!isPurePublicOffSymbol(sequence[i])) {
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
        // ★ ユーザー指示: 全テーブルで共通でAチームとBチームの8時を完全均等（14回対14回）に配分！
        // かつ8時担当スタッフの8時回数は最大1〜2回（原則1回）に制限し、特殊勤務合計を2つに固定！
        const force = options && options.force === true;
        const counts = new Array(this.numStaff).fill(0);
        const lastAssignedDay = new Array(this.numStaff).fill(-10);

        // チーム判定ヘルパー (A or B)
        const getStaffTeam = (s) => {
            const st = this.staffList[s];
            if (!st) return 'A';
            if (this.isSouth) {
                const fl = st.subFloor || st.floor || '';
                return (fl === '南3' || fl.includes('南3')) ? 'B' : 'A';
            }
            const sec = st.section || '';
            if (sec.includes('B')) return 'B';
            if (sec.includes('A')) return 'A';
            return (s % 2 === 1) ? 'B' : 'A';
        };

        const team8Counts = { A: 0, B: 0 };

        for (let s = 0; s < this.numStaff; s++) {
            for (let d = 0; d < this.numDays; d++) {
                if (this.grid[s][d].symbol === SYMBOLS.H8) {
                    counts[s]++;
                    lastAssignedDay[s] = d;
                    team8Counts[getStaffTeam(s)]++;
                }
            }
        }

        // 各チームに can8 スタッフが何名いるか集計
        let can8CountTeamA = 0, can8CountTeamB = 0;
        for (let s = 0; s < this.numStaff; s++) {
            if (this.staffList[s].isUnused || this.staffList[s].isSectionChief || !this.staffList[s].can8) continue;
            if (getStaffTeam(s) === 'A') can8CountTeamA++;
            else can8CountTeamB++;
        }
        const canBalanceTeams = (can8CountTeamA > 0 && can8CountTeamB > 0);

        for (let d = 0; d < this.numDays; d++) {
            const dayNum = d + 1;
            let assigned = 0;
            for (let s = 0; s < this.numStaff; s++) {
                if (this.grid[s][d].symbol === SYMBOLS.H8) assigned++;
            }
            if (assigned >= 1) continue;

            const candidates = [];
            for (let s = 0; s < this.numStaff; s++) {
                if (this.staffList[s].isUnused) continue;
                // ★ 係長は特殊勤務(8時含む)なし（事前希望で入力されたもののみ残し、自動割当は行わない）
                if (this.staffList[s].isSectionChief) continue;
                // ★ can8 フラグがOFFのスタッフは100%除外（絶対に8時を割り当てない）
                if (!this.staffList[s].can8) continue;

                // 基本勤務表で「○」として組まれているスタッフ（未固定）
                if (this.grid[s][d].isFixed || this.grid[s][d].symbol !== SYMBOLS.WORK) continue;

                // ★ 要件: 1勤（前日も翌日も休日の単発勤務）には特殊勤務（8時含む）を自動で振らない
                const prevSym = this.getSymbol(s, d - 1);
                const nextSym = (d + 1 < this.numDays) ? this.getSymbol(s, d + 1) : '';
                if (isHolidaySymbol(prevSym) && (d + 1 < this.numDays && isHolidaySymbol(nextSym))) continue;

                // スケ可保護：このスタッフを8時に変更しても、当日のスケ可かつ日勤帯（○）が2名以上残るか
                if (this.staffList[s].canSched) {
                    let remainingSchedWork = 0;
                    for (let otherS = 0; otherS < this.numStaff; otherS++) {
                        if (otherS === s || this.staffList[otherS].isUnused) continue;
                        if (this.staffList[otherS].canSched && this.grid[otherS][d].symbol === SYMBOLS.WORK) {
                            remainingSchedWork++;
                        }
                    }
                    const totalFloorSched = this.staffList.filter(st => !st.isUnused && st.canSched).length;
                    if (totalFloorSched >= 2 && remainingSchedWork < 2) continue;
                }

                const team = getStaffTeam(s);
                let teamPenalty = 0;
                // 両チームに can8 スタッフがいる場合のみ、A/Bチーム均等化ペナルティを適用
                if (canBalanceTeams) {
                    const targetTeam = (team8Counts.A <= team8Counts.B) ? 'A' : 'B';
                    if (team !== targetTeam) {
                        const diff = Math.abs(team8Counts.A - team8Counts.B);
                        teamPenalty = (diff >= 1) ? 2000000 * diff : 100000;
                    }
                }

                // ★ ユーザー指示: 8時は特定スタッフに偏らせず全体に均等配分（1人3〜4回程度に抑制）！
                const totalCan8Count = this.staffList.filter(st => !st.isUnused && !st.isSectionChief && st.can8).length;
                const maxAllowed8h = Math.max(3, Math.min(5, Math.ceil(this.numDays / Math.max(1, totalCan8Count)) + 1));
                if (counts[s] >= maxAllowed8h && !force) continue; // 上限到達者は除外！

                // 回数ペナルティ: 指数関数的にペナルティを爆発させ、全員に完全均等（3〜4回）に分散！
                const countPenalty = Math.pow(counts[s], 3) * 150000;

                // ★ ユーザー指示: 8時を2日連続は可能な限り回避（努力義務）
                let consec8Penalty = 0;
                const prevSym8 = (d > 0) ? this.grid[s][d - 1].symbol : ((this.staffList[s].prevDays && this.staffList[s].prevDays.length) ? this.staffList[s].prevDays[this.staffList[s].prevDays.length - 1] : '');
                const nextSym8 = (d + 1 < this.numDays) ? this.grid[s][d + 1].symbol : '';
                if (prevSym8 === SYMBOLS.H8 || nextSym8 === SYMBOLS.H8 || lastAssignedDay[s] === d - 1) {
                    consec8Penalty = 500000; // 努力義務: 強いペナルティで他スタッフを優先
                }

                // スコア: 個人回数最優先均等化 + チーム均等（A対B 14回対14回） + 直近ローテーション間隔 + 2日連続回避
                let score = countPenalty + teamPenalty + consec8Penalty - (d - lastAssignedDay[s]);
                candidates.push({ staffIndex: s, score, team });
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
            const chosenTeam = candidates[0].team;
            this.setSymbol(chosen, d, SYMBOLS.H8, false);
            counts[chosen]++;
            team8Counts[chosenTeam]++;
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
            if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;
            for (let d = 0; d < this.numDays; d++) {
                if (this.grid[s][d].isFixed || this.grid[s][d].isAfterPreSpecial) continue;
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
        this.eliminateSingleDayWork();
    }

    /**
     * 当日 d の各セクション（PT A, PT B, OT A, OT B）および A/Bチーム（PT A+OT A, PT B+OT B）の出勤人数・実数を取得
     */
    getDailySectionWorkMap(d) {
        const map = { 'PT A': 0, 'PT B': 0, 'OT A': 0, 'OT B': 0, 'その他': 0, teamA: 0, teamB: 0, total: 0 };
        for (let s = 0; s < this.numStaff; s++) {
            if (this.staffList[s].isUnused) continue;
            const sym = this.grid[s][d].symbol;
            let amt = 0;
            if ([SYMBOLS.EARLY, SYMBOLS.LATE, SYMBOLS.EVE, SYMBOLS.H8, SYMBOLS.WORK, '〇', '◯', SYMBOLS.NO_ALLOW_EARLY, SYMBOLS.NO_ALLOW_LATE, SYMBOLS.NO_ALLOW_EVE].includes(sym) && sym !== '出' && sym !== '出張' && sym !== SYMBOLS.TRIP) {
                amt = 1.0;
            } else if (isHalfDuty(sym)) {
                amt = 0.5;
            }
            if (amt > 0) {
                const sec = this.staffList[s].section || 'その他';
                if (sec in map) {
                    map[sec] += amt;
                } else {
                    map['その他'] += amt;
                }
            }
        }
        map.teamA = map['PT A'] + map['OT A'];
        map.teamB = map['PT B'] + map['OT B'];
        map.total = map.teamA + map.teamB + map['その他'];
        return map;
    }

    /**
     * 指定されたスタッフグループ（セクション）内での出勤人数平準化スワップ
     * （全体の実数合計の最大-最小レンジを悪化させず、かつプラス・マイナスの調整矢印発動日は柔軟に調整を許容）
     */
    balanceGroupWorkforce(staffIndices) {
        if (!staffIndices || staffIndices.length <= 1) return;

        for (let iter = 0; iter < 250; iter++) {
            const daily = [];
            const globalLoads = [];
            for (let d = 0; d < this.numDays; d++) {
                const w = this.getDailyRealWorkBase(d, staffIndices);
                const g = this.getDailyEffectiveRealLoad(d);
                daily.push({ day: d, count: w, gLoad: g });
                globalLoads.push(g);
            }
            daily.sort((a, b) => b.count - a.count);
            const globalAvg = globalLoads.reduce((acc, v) => acc + v, 0) / this.numDays;

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
                        if (this.staffList[s].isSectionChief) continue;
                        if (this.grid[s][maxDay].isAfterPreSpecial || this.grid[s][minDay].isAfterPreSpecial) continue;
                        const staffWeight = this.staffList[s].isHalf ? 0.5 : 1.0;
                        // セクション内実数の差がスタッフの実数重みより大きい場合のみスワップ
                        if (curMaxCnt - curMinCnt <= staffWeight + 0.01) continue;

                        // ★ 全体の実数合計（getDailyEffectiveRealLoad）を悪化させない場合（または調整矢印がある日で許容範囲内の場合）スワップを許可
                        const globalMaxLoad = this.getDailyEffectiveRealLoad(maxDay);
                        const globalMinLoad = this.getDailyEffectiveRealLoad(minDay);
                        const hasOffset = ((this.dayOffsets && this.dayOffsets[maxDay]) || (this.dayOffsets && this.dayOffsets[minDay]));
                        const allowTolerance = (curMaxCnt - curMinCnt >= 2.5 && hasOffset) ? 0.51 : 0.01;
                        if (globalMaxLoad - globalMinLoad < staffWeight - allowTolerance) continue;
                        if (globalMaxLoad - staffWeight < globalAvg - 1.01 || globalMinLoad + staffWeight > globalAvg + 1.01) continue;

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
     * ★ セクション単体（PT A, PT B, OT A, OT B）および A/Bチーム合算（PT A+OT A, PT B+OT B）の
     * 28日間出勤人数ブレ最小化エンジン
     * - 2名同時クロススワップ（全体の実数合計を1ミリも変えずにセクション・チームの凹凸だけを同時解消）
     * - 調整矢印（dayOffsets）発動日の柔軟な単一・クロス調整
     * - 異なる週の間の中継日(midDay)を介したクロススワップ
     */
    balanceSectionAndTeamWorkforce() {
        const targetSecs = ['PT A', 'PT B', 'OT A', 'OT B'];
        const activeBySec = { 'PT A': 0, 'PT B': 0, 'OT A': 0, 'OT B': 0 };
        let totalActiveSecStaff = 0;
        for (let s = 0; s < this.numStaff; s++) {
            if (this.staffList[s].isUnused) continue;
            const sec = this.staffList[s].section || '';
            if (sec in activeBySec) {
                activeBySec[sec]++;
                totalActiveSecStaff++;
            }
        }
        if (totalActiveSecStaff === 0) return;

        // 28日間の各セクション・各チームの平均出勤数を計算
        const computeTargets = () => {
            const sumSec = { 'PT A': 0, 'PT B': 0, 'OT A': 0, 'OT B': 0, teamA: 0, teamB: 0, total: 0 };
            const sumNoOffsetSec = { 'PT A': 0, 'PT B': 0, 'OT A': 0, 'OT B': 0, teamA: 0, teamB: 0, total: 0 };
            let noOffsetDays = 0;
            for (let d = 0; d < this.numDays; d++) {
                const m = this.getDailySectionWorkMap(d);
                const off = (this.dayOffsets && this.dayOffsets[d]) ? this.dayOffsets[d] : 0;
                for (const k of targetSecs) sumSec[k] += m[k];
                sumSec.teamA += m.teamA;
                sumSec.teamB += m.teamB;
                sumSec.total += m.total;
                if (off === 0) {
                    for (const k of targetSecs) sumNoOffsetSec[k] += m[k];
                    sumNoOffsetSec.teamA += m.teamA;
                    sumNoOffsetSec.teamB += m.teamB;
                    sumNoOffsetSec.total += m.total;
                    noOffsetDays++;
                }
            }
            const avg = {};
            const denom = noOffsetDays >= 10 ? noOffsetDays : this.numDays;
            const src = noOffsetDays >= 10 ? sumNoOffsetSec : sumSec;
            for (const k of targetSecs) avg[k] = src[k] / denom;
            avg.teamA = src.teamA / denom;
            avg.teamB = src.teamB / denom;
            avg.total = Math.max(1, src.total / denom);
            // 28日全体の純粋平均も保持
            avg.allDays = {};
            for (const k of targetSecs) avg.allDays[k] = sumSec[k] / this.numDays;
            avg.allDays.teamA = sumSec.teamA / this.numDays;
            avg.allDays.teamB = sumSec.teamB / this.numDays;
            avg.allDays.total = Math.max(1, sumSec.total / this.numDays);
            return avg;
        };

        const calcPenaltyFn = (diff) => {
            const ad = Math.abs(diff);
            // 二乗誤差に加え、平均から ±1.0 を超えるブレに3乗・4乗相当の強い圧縮ペナルティをかけて最大-最小幅を最小化
            let p = ad * ad;
            if (ad > 0.85) p += Math.pow(ad - 0.85, 2) * 3.5;
            if (ad > 1.45) p += Math.pow(ad - 1.45, 2) * 9.0;
            if (ad > 2.10) p += Math.pow(ad - 2.10, 2) * 18.0;
            return p;
        };

        // 日 d のセクション単体（PT A, PT B, OT A, OT B）＋チーム合算（PT A+OT A, PT B+OT B）の不均衡コスト
        const calcDayImbalanceCost = (d, avgInfo, mapOverride = null) => {
            const m = mapOverride || this.getDailySectionWorkMap(d);
            const offset = (this.dayOffsets && this.dayOffsets[d]) ? this.dayOffsets[d] : 0;
            const scale = m.total / avgInfo.allDays.total;
            let cost = 0;

            if (offset === 0) {
                // 調整矢印が発動していない通常日：28日間のブレ（最大-最小幅）が最小になるよう固定平均と日別比例値の両方に強く引き寄せる
                for (const sec of targetSecs) {
                    const idealFixed = avgInfo.allDays[sec];
                    const idealProp = avgInfo.allDays[sec] * scale;
                    const target = 0.70 * idealFixed + 0.30 * idealProp;
                    cost += calcPenaltyFn(m[sec] - target) * 1.35;
                }
                const targetTeamA = 0.70 * avgInfo.allDays.teamA + 0.30 * (avgInfo.allDays.teamA * scale);
                const targetTeamB = 0.70 * avgInfo.allDays.teamB + 0.30 * (avgInfo.allDays.teamB * scale);
                cost += calcPenaltyFn(m.teamA - targetTeamA) * 1.15;
                cost += calcPenaltyFn(m.teamB - targetTeamB) * 1.15;
            } else {
                // ★ マイナスやプラスの調整矢印（dayOffsets）が発動している日：
                // 「調整矢印が発動している時は調整しやすい方で調整してくれてよい」に基づき、
                // その日の増減後全体人数に応じた比例ターゲットを基準としつつ、重みを緩和(0.45倍)して調整しやすいセクションで吸収可能にする
                for (const sec of targetSecs) {
                    const propTarget = avgInfo.allDays[sec] * scale;
                    const fixedTarget = avgInfo.allDays[sec];
                    const target = 0.75 * propTarget + 0.25 * fixedTarget;
                    cost += calcPenaltyFn(m[sec] - target) * 0.55;
                }
                const propTeamA = avgInfo.allDays.teamA * scale;
                const propTeamB = avgInfo.allDays.teamB * scale;
                cost += calcPenaltyFn(m.teamA - propTeamA) * 0.50;
                cost += calcPenaltyFn(m.teamB - propTeamB) * 0.50;
            }
            return cost;
        };

        const avgInfo = computeTargets();

        // =========================================================================
        // フェーズA: 2名同時クロススワップ（全体の実数合計を1ミリも変えずにセクション・A/Bチームのブレだけを解消！）
        // d1 で (s1: ○ -> 休, s2: 休 -> ○)、d2 で (s1: 休 -> ○, s2: ○ -> 休)
        // =========================================================================
        for (let iter = 0; iter < 350; iter++) {
            let bestGain = 0.02;
            let bestMove = null;

            // 不均衡コストが高い日を優先的に探索
            const dayCosts = [];
            for (let d = 0; d < this.numDays; d++) {
                const mp = this.getDailySectionWorkMap(d);
                dayCosts.push({ day: d, cost: calcDayImbalanceCost(d, avgInfo, mp), map: mp });
            }
            dayCosts.sort((a, b) => b.cost - a.cost);

            // 上位18日 × 全日のペアを探索
            const checkDays = dayCosts.slice(0, 18).map(x => x.day);

            for (const d1 of checkDays) {
                const w1 = this.weekSpans.findIndex(span => span.includes(d1));
                // 同週の日を先に、異週の日を後に並べる
                const d2Order = [];
                for (let d2 = 0; d2 < this.numDays; d2++) {
                    if (d2 !== d1) d2Order.push(d2);
                }
                d2Order.sort((a, b) => {
                    const sameWA = this.weekSpans.findIndex(span => span.includes(a)) === w1 ? 1 : 0;
                    const sameWB = this.weekSpans.findIndex(span => span.includes(b)) === w1 ? 1 : 0;
                    if (sameWA !== sameWB) return sameWB - sameWA;
                    return dayCosts.find(x => x.day === b).cost - dayCosts.find(x => x.day === a).cost;
                });

                const baseCostD1 = dayCosts.find(x => x.day === d1).cost;
                const mapD1 = dayCosts.find(x => x.day === d1).map;

                for (const d2 of d2Order) {
                    const baseCostD2 = dayCosts.find(x => x.day === d2).cost;
                    const mapD2 = dayCosts.find(x => x.day === d2).map;
                    const beforePairCost = baseCostD1 + baseCostD2;
                    if (beforePairCost <= bestGain) continue;

                    // d1(○)->d2(休) 候補のスタッフ群 と d1(休)->d2(○) 候補のスタッフ群を抽出
                    const cands1 = [];
                    const cands2 = [];
                    for (let s = 0; s < this.numStaff; s++) {
                        if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;
                        if (this.grid[s][d1].isFixed || this.grid[s][d2].isFixed) continue;
                        if (this.grid[s][d1].isAfterPreSpecial || this.grid[s][d2].isAfterPreSpecial) continue;
                        const sym1 = this.grid[s][d1].symbol;
                        const sym2 = this.grid[s][d2].symbol;
                        if (sym1 === SYMBOLS.WORK && sym2 === SYMBOLS.OFF) {
                            cands1.push(s);
                        } else if (sym1 === SYMBOLS.OFF && sym2 === SYMBOLS.WORK) {
                            cands2.push(s);
                        }
                    }
                    if (cands1.length === 0 || cands2.length === 0) continue;

                    // ★ O(1) セクションペア事前評価キャッシュ（同じ(sec1, sec2)ペアのコスト変化を即座に判定）
                    const secPairGainCache = {};
                    const evalSecPairGain = (sec1, sec2) => {
                        const key = `${sec1}|${sec2}`;
                        if (key in secPairGainCache) return secPairGainCache[key];
                        const m1 = Object.assign({}, mapD1);
                        const m2 = Object.assign({}, mapD2);
                        m1[sec1] = (m1[sec1] || 0) - 1;
                        m1[sec2] = (m1[sec2] || 0) + 1;
                        m1.teamA = m1['PT A'] + m1['OT A'];
                        m1.teamB = m1['PT B'] + m1['OT B'];
                        m2[sec1] = (m2[sec1] || 0) + 1;
                        m2[sec2] = (m2[sec2] || 0) - 1;
                        m2.teamA = m2['PT A'] + m2['OT A'];
                        m2.teamB = m2['PT B'] + m2['OT B'];
                        const afterC = calcDayImbalanceCost(d1, avgInfo, m1) + calcDayImbalanceCost(d2, avgInfo, m2);
                        const g = beforePairCost - afterC;
                        secPairGainCache[key] = g;
                        return g;
                    };

                    // セクション間の過不足が改善するペアのみを高速フィルタリングして検証
                    for (const s1 of cands1) {
                        const sec1 = this.staffList[s1].section || 'その他';
                        const half1 = !!this.staffList[s1].isHalf;
                        let s1Checked = false;
                        let s1Valid = false;

                        for (const s2 of cands2) {
                            if (!!this.staffList[s2].isHalf !== half1) continue;
                            const sec2 = this.staffList[s2].section || 'その他';
                            if (sec1 === sec2) continue;

                            const gain = evalSecPairGain(sec1, sec2);
                            if (gain <= bestGain) continue;

                            if (!s1Checked) {
                                this.setSymbol(s1, d1, SYMBOLS.OFF, false);
                                this.setSymbol(s1, d2, SYMBOLS.WORK, false);
                                s1Valid = this.isStaffHardValid(s1);
                                this.setSymbol(s1, d1, SYMBOLS.WORK, false);
                                this.setSymbol(s1, d2, SYMBOLS.OFF, false);
                                s1Checked = true;
                            }
                            if (!s1Valid) break;

                            this.setSymbol(s1, d1, SYMBOLS.OFF, false);
                            this.setSymbol(s1, d2, SYMBOLS.WORK, false);
                            this.setSymbol(s2, d1, SYMBOLS.WORK, false);
                            this.setSymbol(s2, d2, SYMBOLS.OFF, false);

                            if (this.isStaffHardValid(s2) && this.isGlobalAttributesValid()) {
                                bestGain = gain;
                                bestMove = { s1, s2, d1, d2 };
                            }

                            // ロールバック
                            this.setSymbol(s1, d1, SYMBOLS.WORK, false);
                            this.setSymbol(s1, d2, SYMBOLS.OFF, false);
                            this.setSymbol(s2, d1, SYMBOLS.OFF, false);
                            this.setSymbol(s2, d2, SYMBOLS.WORK, false);
                        }
                    }
                }
                if (bestMove && bestGain > 2.5) break; // 大きな改善が見つかれば即適用して次イテレーションへ
            }

            if (bestMove) {
                const { s1, s2, d1, d2 } = bestMove;
                this.setSymbol(s1, d1, SYMBOLS.OFF, false);
                this.setSymbol(s1, d2, SYMBOLS.WORK, false);
                this.setSymbol(s2, d1, SYMBOLS.WORK, false);
                this.setSymbol(s2, d2, SYMBOLS.OFF, false);
            } else {
                break;
            }
        }

        // =========================================================================
        // フェーズB: 異なる週の間の中継日(midDay)を介した2ステップ・クロススワップ
        // 週w1のd1と週w2のd2でセクション偏りがあるが、週休2日制約のため単一スタッフではw1<->w2を直接跨げない場合、
        // w1内の別日 d1_alt で (sA, sB) をクロススワップしつつ、w1<->w2 を跨げるスタッフ（有・リフ・出張・第1/第5端数週等）と連動させる
        // さらに、単一スタッフで全体実数の許容範囲内（または調整矢印発動日）でセクション・チーム不均衡を大きく減らすスワップも実行
        // =========================================================================
        for (let iter = 0; iter < 150; iter++) {
            let improved = false;
            const globalLoads = [];
            for (let d = 0; d < this.numDays; d++) globalLoads.push(this.getDailyEffectiveRealLoad(d));
            const globalMax = Math.max(...globalLoads);
            const globalMin = Math.min(...globalLoads);
            const globalAvg = globalLoads.reduce((a, b) => a + b, 0) / this.numDays;

            outerSingle:
            for (let d1 = 0; d1 < this.numDays; d1++) {
                for (let d2 = 0; d2 < this.numDays; d2++) {
                    if (d1 === d2) continue;
                    const load1 = globalLoads[d1];
                    const load2 = globalLoads[d2];
                    const off1 = (this.dayOffsets && this.dayOffsets[d1]) ? this.dayOffsets[d1] : 0;
                    const off2 = (this.dayOffsets && this.dayOffsets[d2]) ? this.dayOffsets[d2] : 0;

                    const baseImb = calcDayImbalanceCost(d1, avgInfo) + calcDayImbalanceCost(d2, avgInfo);

                    for (let s = 0; s < this.numStaff; s++) {
                        if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;
                        if (this.grid[s][d1].isFixed || this.grid[s][d2].isFixed) continue;
                        if (this.grid[s][d1].isAfterPreSpecial || this.grid[s][d2].isAfterPreSpecial) continue;
                        if (this.grid[s][d1].symbol !== SYMBOLS.WORK || this.grid[s][d2].symbol !== SYMBOLS.OFF) continue;

                        const w = this.staffList[s].isHalf ? 0.5 : 1.0;
                        const newLoad1 = load1 - w;
                        const newLoad2 = load2 + w;

                        // 全体実数合計のレンジを悪化させない（または調整矢印がある日で±1.0以内に収まりセクション不均衡が劇的に改善する）場合のみ許可
                        const oldGlobalSpread = Math.pow(load1 - globalAvg, 2) + Math.pow(load2 - globalAvg, 2);
                        const newGlobalSpread = Math.pow(newLoad1 - globalAvg, 2) + Math.pow(newLoad2 - globalAvg, 2);
                        const globalDelta = newGlobalSpread - oldGlobalSpread;

                        const maxAllowedGlobalDelta = (off1 !== 0 || off2 !== 0) ? 0.55 : 0.01;
                        if (globalDelta > maxAllowedGlobalDelta) continue;
                        if (newLoad1 < globalMin - ((off1 !== 0) ? 0.5 : 0.01) || newLoad2 > globalMax + ((off2 !== 0) ? 0.5 : 0.01)) continue;

                        this.setSymbol(s, d1, SYMBOLS.OFF, false);
                        this.setSymbol(s, d2, SYMBOLS.WORK, false);

                        const afterImb = calcDayImbalanceCost(d1, avgInfo) + calcDayImbalanceCost(d2, avgInfo);
                        const netGain = (baseImb - afterImb) - globalDelta * 6.0;

                        if (netGain > 1.2 && this.isStaffHardValid(s) && this.isGlobalAttributesValid()) {
                            improved = true;
                            break outerSingle;
                        } else {
                            this.setSymbol(s, d1, SYMBOLS.WORK, false);
                            this.setSymbol(s, d2, SYMBOLS.OFF, false);
                        }
                    }
                }
            }
            if (!improved) break;
        }
    }

    /**
     * ★ 実数合計（realWork）を基準とした全体出勤人数の平坦化エンジン
     * （出勤人数合計ではなく、0.5トグル・半休・日別加減枠を反映した「実数合計」の分散を最小化する）
     * ★ さらに候補スタッフ選択時にセクション＆A/Bチームのバランスが最も良くなるスタッフを優先選出！
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
                const maxSecMap = this.getDailySectionWorkMap(maxDay);

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
                    const minSecMap = this.getDailySectionWorkMap(minDay);

                    // gap === 1.0 のときは 0.5スタッフ(isHalf)を最優先、さらに maxDayで余っていてminDayで不足しているセクション・チームのスタッフを最優先！
                    const staffOrder = [];
                    for (let s = 0; s < this.numStaff; s++) {
                        if (!this.staffList[s].isUnused && !this.staffList[s].isSectionChief) staffOrder.push(s);
                    }
                    staffOrder.sort((a, b) => {
                        const wA = this.staffList[a].isHalf ? 0.5 : 1.0;
                        const wB = this.staffList[b].isHalf ? 0.5 : 1.0;
                        const remA = Math.abs(gap - 2 * wA);
                        const remB = Math.abs(gap - 2 * wB);
                        if (Math.abs(remA - remB) > 0.01) return remA - remB;

                        const secA = this.staffList[a].section || 'その他';
                        const secB = this.staffList[b].section || 'その他';
                        const teamA = (secA === 'PT A' || secA === 'OT A') ? 'teamA' : ((secA === 'PT B' || secA === 'OT B') ? 'teamB' : '');
                        const teamB = (secB === 'PT A' || secB === 'OT A') ? 'teamA' : ((secB === 'PT B' || secB === 'OT B') ? 'teamB' : '');
                        const diffSecA = (maxSecMap[secA] || 0) - (minSecMap[secA] || 0) + (teamA ? ((maxSecMap[teamA] - minSecMap[teamA]) * 0.5) : 0);
                        const diffSecB = (maxSecMap[secB] || 0) - (minSecMap[secB] || 0) + (teamB ? ((maxSecMap[teamB] - minSecMap[teamB]) * 0.5) : 0);
                        return diffSecB - diffSecA;
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
                if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;
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
     * 実数合計・セクション単体（PT A, PT B, OT A, OT B）・A/Bチーム合算（PT A+OT A, PT B+OT B）の多層平準化パス
     */
    /**
     * ★ 全テーブル共通: 「休 ○ 休」（単発1勤）の完全撲滅
     * ユーザー指示: 「休〇休」は1勤です。可能な限り作らない。公休をひとつずらせば済む話です。
     * 単発勤務（前日も翌日も休日）を検知し、前後の公休をずらすなどして2連勤または連休に変換！
     */
    eliminateSingleDayWork() {
        const dates = this.dates || [];
        for (let s = 0; s < this.numStaff; s++) {
            if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;

            for (let pass = 0; pass < 3; pass++) {
                let fixedAnyInPass = false;
                for (let d = 0; d < this.numDays; d++) {
                    const sym = this.grid[s][d].symbol;
                    if (sym !== SYMBOLS.WORK || this.grid[s][d].isFixed) continue;

                    const prevSym = this.getSymbol(s, d - 1);
                    const nextSym = (d + 1 < this.numDays) ? this.getSymbol(s, d + 1) : '';

                    // 休 ○ 休 の単発勤務か
                    if (isHolidaySymbol(prevSym) && (d + 1 < this.numDays && isHolidaySymbol(nextSym))) {
                        // パターン1: 翌々日(d+2)が○なら、公休(d+1)をd+2にずらす！
                        // [休, ○(d), 休(d+1), ○(d+2)] => [休, ○(d), ○(d+1), 休(d+2)]
                        if (d + 2 < this.numDays && !this.grid[s][d + 1].isFixed && this.grid[s][d + 1].symbol === SYMBOLS.OFF && !this.grid[s][d + 2].isFixed && this.grid[s][d + 2].symbol === SYMBOLS.WORK) {
                            this.setSymbol(s, d + 1, SYMBOLS.WORK, false);
                            this.setSymbol(s, d + 2, SYMBOLS.OFF, false);
                            if (this.isStaffHardValid(s) && this.isGlobalAttributesValid()) {
                                fixedAnyInPass = true;
                                continue;
                            } else {
                                // 連勤・週休・属性違反になるため安全にロールバック！
                                this.setSymbol(s, d + 1, SYMBOLS.OFF, false);
                                this.setSymbol(s, d + 2, SYMBOLS.WORK, false);
                            }
                        }

                        // パターン2: 前々日(d-2)が○なら、公休(d-1)をd-2にずらす！
                        // [○(d-2), 休(d-1), ○(d), 休] => [休(d-2), ○(d-1), ○(d), 休]
                        if (d - 2 >= 0 && !this.grid[s][d - 1].isFixed && this.grid[s][d - 1].symbol === SYMBOLS.OFF && !this.grid[s][d - 2].isFixed && this.grid[s][d - 2].symbol === SYMBOLS.WORK) {
                            this.setSymbol(s, d - 1, SYMBOLS.WORK, false);
                            this.setSymbol(s, d - 2, SYMBOLS.OFF, false);
                            if (this.isStaffHardValid(s) && this.isGlobalAttributesValid()) {
                                fixedAnyInPass = true;
                                continue;
                            } else {
                                // 連勤・週休・属性違反になるため安全にロールバック！
                                this.setSymbol(s, d - 1, SYMBOLS.OFF, false);
                                this.setSymbol(s, d - 2, SYMBOLS.WORK, false);
                            }
                        }

                        // パターン3: d+1(休)の次の日が休日で連休になっている場合、d(○)を休みにし、d+1(休)を○にする
                        // [休, ○(d), 休(d+1), 休(d+2)] => [休, 休(d), ○(d+1), 休(d+2)]
                        if (d + 1 < this.numDays && !this.grid[s][d + 1].isFixed && this.grid[s][d + 1].symbol === SYMBOLS.OFF) {
                            this.setSymbol(s, d, SYMBOLS.OFF, false);
                            this.setSymbol(s, d + 1, SYMBOLS.WORK, false);
                            if (this.isStaffHardValid(s) && this.isGlobalAttributesValid()) {
                                fixedAnyInPass = true;
                                continue;
                            } else {
                                // 連勤・週休・属性違反になるため安全にロールバック！
                                this.setSymbol(s, d, SYMBOLS.WORK, false);
                                this.setSymbol(s, d + 1, SYMBOLS.OFF, false);
                            }
                        }
                    }
                }
                if (!fixedAnyInPass) break;
            }
        }
    }


    /**
     * ★ 組んだ後のスマート自動微修正システム（ユーザー要望: 全テーブル共通自動リペア）
     * 1. 特殊勤務（早・遅・E）の翌日非休日を公休スワップで自動解消
     * 2. 翌日特殊勤務重複（Eの翌日に早など）を別スタッフとスワップして解消
     * 3. 8時勤務の過不足（平日0名）を出勤中can8スタッフへ自動充当して解消
     * 4. 週休2日不足（日〜土で6出勤・1公休）を前後の週との公休スワップで自動解消
     */
    repairScheduleViolations() {
        const dates = this.dates || [];

        // --- 1. 特殊勤務（早・遅・E）翌日休日違反の自動修復 ---
        for (let pass = 0; pass < 5; pass++) {
            let fixedAny = false;
            for (let s = 0; s < this.numStaff; s++) {
                if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;

                for (let d = 0; d < this.numDays - 1; d++) {
                    const sym = this.grid[s][d].symbol;
                    if (!isRestrictedSpecial(sym)) continue;

                    const nextSym = this.grid[s][d + 1].symbol;
                    // 翌日が休日でない場合（○ または 特殊勤務）
                    if (!isHolidaySymbol(nextSym)) {
                        // ケースA: 翌日が別の特殊勤務（例: 5/6 E ➔ 5/7 早）の場合、翌日の特殊勤務を別の○スタッフとスワップ
                        if (isRestrictedSpecial(nextSym) && !this.grid[s][d + 1].isFixed) {
                            for (let otherS = 0; otherS < this.numStaff; otherS++) {
                                if (otherS === s || this.staffList[otherS].isUnused || this.staffList[otherS].isSectionChief) continue;
                                if (this.isSouth && this.getSubFloor(otherS) !== this.getSubFloor(s)) continue;
                                if (this.grid[otherS][d + 1].symbol === SYMBOLS.WORK && !this.grid[otherS][d + 1].isFixed) {
                                    // otherS に翌日の特殊勤務を移し、sの翌日を○にしてから公休スワップへ
                                    this.setSymbol(otherS, d + 1, nextSym, false);
                                    this.setSymbol(s, d + 1, SYMBOLS.WORK, false);
                                    if (this.isStaffHardValid(otherS) && this.isGlobalAttributesValid()) {
                                        fixedAny = true;
                                        break;
                                    } else {
                                        this.setSymbol(otherS, d + 1, SYMBOLS.WORK, false);
                                        this.setSymbol(s, d + 1, nextSym, false);
                                    }
                                }
                            }
                        }

                        // ケースB: 翌日(d+1)が○の場合、同一スタッフの他日の非固定「休」とスワップして翌日を「休」にする！
                        if (this.grid[s][d + 1].symbol === SYMBOLS.WORK && !this.grid[s][d + 1].isFixed) {
                            // スワップ候補日（同じ週優先、前後の連勤枠）
                            const d1Week = this.weekSpans.findIndex(span => span.includes(d + 1));
                            let bestSwapD = -1;

                            for (let candD = 0; candD < this.numDays; candD++) {
                                if (candD === d || candD === d + 1) continue;
                                if (this.grid[s][candD].isFixed || this.grid[s][candD].symbol !== SYMBOLS.OFF) continue;
                                // candD の前日が特殊勤務なら candD を○にするとまた翌日違反になるため除外
                                if (candD > 0 && isRestrictedSpecial(this.grid[s][candD - 1].symbol)) continue;

                                // 一時スワップ検証
                                this.setSymbol(s, candD, SYMBOLS.WORK, false);
                                this.setSymbol(s, d + 1, SYMBOLS.OFF, false);
                                if (this.isStaffHardValid(s) && this.isGlobalAttributesValid()) {
                                    bestSwapD = candD;
                                    break;
                                }
                                // 戻す
                                this.setSymbol(s, candD, SYMBOLS.OFF, false);
                                this.setSymbol(s, d + 1, SYMBOLS.WORK, false);
                            }

                            if (bestSwapD >= 0) {
                                fixedAny = true;
                            }
                        }
                    }
                }
            }
            if (!fixedAny) break;
        }

        // --- 2. 8時勤務の平日完全充足リペア ---
        if (!this.isST) {
            for (let d = 0; d < this.numDays; d++) {
                const di = dates[d];
                const isWeekend = di ? (di.wIdx === 5 || di.wIdx === 6) : ((d % 7 === 5) || (d % 7 === 6));
                if (isWeekend) continue; // 土日は8時不要

                let curH8 = 0;
                for (let s = 0; s < this.numStaff; s++) {
                    if (this.grid[s][d].symbol === SYMBOLS.H8) curH8++;
                }

                if (curH8 === 0) {
                    // ★ ユーザー指示: 先頭スタッフに集中させず、当タームで8時割当回数が最少のcan8スタッフから公平に選出！
                    let bestS = -1;
                    let minH8Count = 999;
                    for (let s = 0; s < this.numStaff; s++) {
                        if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;
                        if (!this.staffList[s].can8) continue;
                        if (this.isSouth && this.getSubFloor(s) !== '南3' && this.getSubFloor(s) !== '南2') continue;
                        if (this.grid[s][d].symbol === SYMBOLS.WORK && !this.grid[s][d].isFixed) {
                            // ★ スケ可保護: このスタッフを8時に変更しても、当日のスケ可かつ日勤○が2名以上残るか
                            if (this.staffList[s].canSched) {
                                let remSchedWork = 0;
                                for (let os = 0; os < this.numStaff; os++) {
                                    if (os === s || this.staffList[os].isUnused) continue;
                                    if (this.staffList[os].canSched && this.grid[os][d].symbol === SYMBOLS.WORK) remSchedWork++;
                                }
                                const totalSchedStaff = this.staffList.filter(st => !st.isUnused && st.canSched).length;
                                if (totalSchedStaff >= 2 && remSchedWork < 2) continue;
                            }

                            let sH8 = 0;
                            for (let cd = 0; cd < this.numDays; cd++) {
                                if (this.grid[s][cd].symbol === SYMBOLS.H8) sH8++;
                            }
                            if (sH8 < minH8Count) {
                                minH8Count = sH8;
                                bestS = s;
                            }
                        }
                    }
                    if (bestS >= 0) {
                        this.setSymbol(bestS, d, SYMBOLS.H8, false);
                    }
                }
            }
        }

        // --- 3. 週休2日違反の自動修復（日〜土で6出勤・1公休を前後の週とスワップ） ---
        for (let pass = 0; pass < 3; pass++) {
            let fixedWeek = false;
            for (let s = 0; s < this.numStaff; s++) {
                if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;

                for (let w = 0; w < this.weekSpans.length; w++) {
                    const wSpan = this.weekSpans[w];
                    let weekOff = 0;
                    for (const d of wSpan) {
                        if (isHolidaySymbol(this.grid[s][d].symbol)) weekOff++;
                    }

                    // 週休が1日しかない（6出勤）
                    if (weekOff < 2) {
                        // 他の週で週休が3日以上ある週（または公休に余裕のある日）を探す
                        for (let otherW = 0; otherW < this.weekSpans.length; otherW++) {
                            if (otherW === w) continue;
                            const otherSpan = this.weekSpans[otherW];
                            let otherOff = 0;
                            for (const od of otherSpan) {
                                if (isHolidaySymbol(this.grid[s][od].symbol)) otherOff++;
                            }

                            if (otherOff >= 3) {
                                // otherSpan の非固定「休」を wSpan の非固定「○」とスワップ！
                                for (const od of otherSpan) {
                                    if (this.grid[s][od].symbol === SYMBOLS.OFF && !this.grid[s][od].isFixed) {
                                        // od の前日が特殊勤務なら除外
                                        if (od > 0 && isRestrictedSpecial(this.grid[s][od - 1].symbol)) continue;

                                        for (const wd of wSpan) {
                                            if (this.grid[s][wd].symbol === SYMBOLS.WORK && !this.grid[s][wd].isFixed) {
                                                // 一時スワップ
                                                this.setSymbol(s, od, SYMBOLS.WORK, false);
                                                this.setSymbol(s, wd, SYMBOLS.OFF, false);
                                                if (this.isStaffHardValid(s) && this.isGlobalAttributesValid()) {
                                                    fixedWeek = true;
                                                    break;
                                                }
                                                // 戻す
                                                this.setSymbol(s, od, SYMBOLS.OFF, false);
                                                this.setSymbol(s, wd, SYMBOLS.WORK, false);
                                            }
                                        }
                                        if (fixedWeek) break;
                                    }
                                }
                            }
                            if (fixedWeek) break;
                        }
                    }
                }
            }
            if (!fixedWeek) break;
        }

        // --- 4. 単発勤務「休 ○ 休」の再撲滅 ---
        this.eliminateSingleDayWork();

        // --- 5. 連勤違反（公休間隔上限超過・上限5連勤違反）のスマート自動リペア ---
        // ユーザー指示:「公休をひとつずらせば済む話です。組んだ後に微修正するシステムは組めないの？」
        for (let pass = 0; pass < 3; pass++) {
            let fixedConsec = false;
            for (let s = 0; s < this.numStaff; s++) {
                if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;
                if (!this.isStaffHardValid(s)) {
                    const sequence = [];
                    const pLen = (this.staffList[s].prevDays && this.staffList[s].prevDays.length) ? this.staffList[s].prevDays.length : 0;
                    for (let p = 0; p < pLen; p++) {
                        sequence.push((this.staffList[s].prevDays && this.staffList[s].prevDays[p]) || '');
                    }
                    for (let d = 0; d < this.numDays; d++) sequence.push(this.grid[s][d].symbol);

                    let streak = 0;
                    let vEndSeq = -1;
                    const maxAllowed = this.staffList[s].allow6Consec ? 6 : 5;
                    for (let idx = 0; idx < sequence.length; idx++) {
                        if (!isPurePublicOffSymbol(sequence[idx])) {
                            streak++;
                            if (streak > maxAllowed) {
                                vEndSeq = idx;
                                break;
                            }
                        } else {
                            streak = 0;
                        }
                    }

                    if (vEndSeq >= pLen) {
                        const vEndD = vEndSeq - pLen;
                        // 連勤期間内の非固定○スタッフを休にする候補日
                        for (let targetD = vEndD; targetD >= Math.max(0, vEndD - maxAllowed); targetD--) {
                            if (this.grid[s][targetD].isFixed || this.grid[s][targetD].symbol !== SYMBOLS.WORK) continue;

                            // 別の週や連勤でない日の非固定休を探してスワップ
                            for (let holD = 0; holD < this.numDays; holD++) {
                                if (holD === targetD || this.grid[s][holD].isFixed || this.grid[s][holD].symbol !== SYMBOLS.OFF) continue;
                                if (holD > 0 && isRestrictedSpecial(this.grid[s][holD - 1].symbol)) continue;

                                this.setSymbol(s, targetD, SYMBOLS.OFF, false);
                                this.setSymbol(s, holD, SYMBOLS.WORK, false);

                                if (this.isStaffHardValid(s) && this.isGlobalAttributesValid()) {
                                    fixedConsec = true;
                                    break;
                                } else {
                                    // ロールバック
                                    this.setSymbol(s, targetD, SYMBOLS.WORK, false);
                                    this.setSymbol(s, holD, SYMBOLS.OFF, false);
                                }
                            }
                            if (fixedConsec) break;
                        }
                    }
                }
            }
            if (!fixedConsec) break;
        }
    }

    balanceDailyWorkforce() {
        const sections = ['PT A', 'PT B', 'OT A', 'OT B', 'PT 2', 'PT 3', 'OT 2', 'OT 3', 'ST'];

        // 1. まず全体の実数合計（realWork）を徹底的に平坦化（セクションバランスも考慮してスタッフ選出）
        this.balanceGlobalWithOffsets();

        // 2. 各セクション単体およびA/Bチーム合算での1名スワップ平準化
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

        // Aチーム合算（PT A/2 + OT A/2）・Bチーム合算（PT B/3 + OT B/3）のグループ平準化
        const teamAStaff = [];
        const teamBStaff = [];
        for (let s = 0; s < this.numStaff; s++) {
            if (this.staffList[s].isUnused) continue;
            const sec = this.staffList[s].section || '';
            if (sec === 'PT A' || sec === 'OT A' || sec === 'PT 2' || sec === 'OT 2') teamAStaff.push(s);
            else if (sec === 'PT B' || sec === 'OT B' || sec === 'PT 3' || sec === 'OT 3') teamBStaff.push(s);
        }
        if (teamAStaff.length > 0) this.balanceGroupWorkforce(teamAStaff);
        if (teamBStaff.length > 0) this.balanceGroupWorkforce(teamBStaff);

        const unassignedStaff = [];
        for (let s = 0; s < this.numStaff; s++) {
            if (!this.staffList[s].isUnused && !this.staffList[s].section) {
                unassignedStaff.push(s);
            }
        }
        if (unassignedStaff.length > 0) {
            this.balanceGroupWorkforce(unassignedStaff);
        }

        // 3. ★ 2名同時クロススワップ＆加減枠連動によるセクション単体（PT A/PT B/OT A/OT B）＆チーム合算（PT A+OT A / PT B+OT B）平準化
        this.balanceSectionAndTeamWorkforce();

        // 4. 全体の実数合計（realWork）を仕上げ平坦化し、再度クロススワップでセクション・チーム内訳を整える
        this.balanceGlobalWithOffsets();
        this.balanceSectionAndTeamWorkforce();

        // 連勤違反の自動リペアパス（公休数を変えずに同スタッフ内の余剰休日とスワップ）
        for (let s = 0; s < this.numStaff; s++) {
            if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;
            if (!this.isStaffHardValid(s)) {
                const sequence = [];
                const pLen = (this.staffList[s].prevDays && this.staffList[s].prevDays.length) ? this.staffList[s].prevDays.length : 0;
                for (let i = 0; i < pLen; i++) sequence.push(this.staffList[s].prevDays[i] || '');
                for (let d = 0; d < this.numDays; d++) sequence.push(this.grid[s][d].symbol);

                let consec = 0;
                let violationEnd = -1;
                const maxAllowed = this.staffList[s].allow6Consec ? 6 : 5;
                for (let idx = 0; idx < sequence.length; idx++) {
                    if (!isPurePublicOffSymbol(sequence[idx])) {
                        consec++;
                        if (consec > maxAllowed) {
                            violationEnd = idx - pLen;
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

        // ★ 平日同士および土日祝同士の直接平準化（出勤実数ブレ幅を極小化）
        this.balanceWeekdaysDirectly();
        this.balanceWeekendsDirectly();
    }

    /**
     * 平日同士の出勤実数直接スワップによるブレ極小化
     */
    balanceWeekdaysDirectly() {
        const isWeekday = (d) => {
            if (this.dates && this.dates[d]) {
                const dt = this.dates[d];
                if (dt.isSun || dt.isSat || dt.isHoliday) return false;
            }
            if (this.dayOffsets && this.dayOffsets[d] !== 0) return false;
            return true;
        };

        const weekdays = [];
        for (let d = 0; d < this.numDays; d++) {
            if (isWeekday(d)) weekdays.push(d);
        }
        if (weekdays.length < 2) return;

        for (let iter = 0; iter < 100; iter++) {
            const daily = weekdays.map(d => ({
                day: d,
                load: this.getDailyEffectiveRealLoad(d)
            }));
            daily.sort((a, b) => b.load - a.load);

            const maxItem = daily[0];
            const minItem = daily[daily.length - 1];

            if (maxItem.load - minItem.load <= 1.01) break;

            let swapped = false;

            for (let hIdx = 0; hIdx < Math.min(5, daily.length); hIdx++) {
                const maxDay = daily[hIdx].day;
                const maxLoad = daily[hIdx].load;

                for (let lIdx = daily.length - 1; lIdx >= Math.max(0, daily.length - 5); lIdx--) {
                    const minDay = daily[lIdx].day;
                    const minLoad = daily[lIdx].load;
                    const gap = maxLoad - minLoad;
                    if (gap <= 1.01) continue;

                    for (let s = 0; s < this.numStaff; s++) {
                        const st = this.staffList[s];
                        if (st.isUnused || st.isSectionChief) continue;

                        const w = st.isHalf ? 0.5 : 1.0;
                        if (gap <= w) continue;

                        // minDay を WORK にする前の安全チェック（前日が特殊勤務なら WORK にできない）
                        const prevOfMin = (minDay > 0) ? this.grid[s][minDay - 1].symbol : ((st.prevDays && st.prevDays.length) ? st.prevDays[st.prevDays.length - 1] : '');
                        if (isRestrictedSpecial(prevOfMin)) continue;
                        if (this.grid[s][minDay].isAfterPreSpecial) continue;

                        if (!this.grid[s][maxDay].isFixed && this.grid[s][maxDay].symbol === SYMBOLS.WORK &&
                            !this.grid[s][minDay].isFixed && this.grid[s][minDay].symbol === SYMBOLS.OFF) {

                            this.setSymbol(s, maxDay, SYMBOLS.OFF, false);
                            this.setSymbol(s, minDay, SYMBOLS.WORK, false);

                            const valid = this.isStaffHardValid(s) && this.isGlobalAttributesValid();
                            // スワップ後に特殊勤務翌日休違反が一切生じていないこと（厳格チェック）
                            let specialValid = true;
                            for (let d = 0; d < this.numDays - 1; d++) {
                                if (isRestrictedSpecial(this.grid[s][d].symbol) && !isHolidaySymbol(this.grid[s][d + 1].symbol)) {
                                    specialValid = false;
                                    break;
                                }
                            }

                            if (valid && specialValid) {
                                swapped = true;
                                break;
                            } else {
                                this.setSymbol(s, maxDay, SYMBOLS.WORK, false);
                                this.setSymbol(s, minDay, SYMBOLS.OFF, false);
                            }
                        }
                    }
                    if (swapped) break;
                }
                if (swapped) break;
            }

            if (!swapped) break;
        }
    }

    /**
     * 土日祝日同士の出勤実数直接スワップによるブレ極小化（土日-2均等化）
     */
    balanceWeekendsDirectly() {
        const isWeekendOrHoliday = (d) => {
            if (this.dates && this.dates[d]) {
                const dt = this.dates[d];
                if (dt.isSun || dt.isSat || dt.isHoliday) return true;
            }
            return false;
        };

        const weekends = [];
        for (let d = 0; d < this.numDays; d++) {
            if (isWeekendOrHoliday(d)) weekends.push(d);
        }
        if (weekends.length < 2) return;

        for (let iter = 0; iter < 100; iter++) {
            const daily = weekends.map(d => ({
                day: d,
                load: this.getDailyEffectiveRealLoad(d)
            }));
            daily.sort((a, b) => b.load - a.load);

            const maxItem = daily[0];
            const minItem = daily[daily.length - 1];

            if (maxItem.load - minItem.load <= 1.01) break;

            let swapped = false;

            for (let hIdx = 0; hIdx < Math.min(5, daily.length); hIdx++) {
                const maxDay = daily[hIdx].day;
                const maxLoad = daily[hIdx].load;

                for (let lIdx = daily.length - 1; lIdx >= Math.max(0, daily.length - 5); lIdx--) {
                    const minDay = daily[lIdx].day;
                    const minLoad = daily[lIdx].load;
                    const gap = maxLoad - minLoad;
                    if (gap <= 1.01) continue;

                    for (let s = 0; s < this.numStaff; s++) {
                        const st = this.staffList[s];
                        if (st.isUnused || st.isSectionChief) continue;

                        const w = st.isHalf ? 0.5 : 1.0;
                        if (gap <= w) continue;

                        // minDay を WORK にする前の安全チェック（前日が特殊勤務なら WORK にできない）
                        const prevOfMin = (minDay > 0) ? this.grid[s][minDay - 1].symbol : ((st.prevDays && st.prevDays.length) ? st.prevDays[st.prevDays.length - 1] : '');
                        if (isRestrictedSpecial(prevOfMin)) continue;
                        if (this.grid[s][minDay].isAfterPreSpecial) continue;

                        if (!this.grid[s][maxDay].isFixed && this.grid[s][maxDay].symbol === SYMBOLS.WORK &&
                            !this.grid[s][minDay].isFixed && this.grid[s][minDay].symbol === SYMBOLS.OFF) {

                            this.setSymbol(s, maxDay, SYMBOLS.OFF, false);
                            this.setSymbol(s, minDay, SYMBOLS.WORK, false);

                            const valid = this.isStaffHardValid(s) && this.isGlobalAttributesValid();
                            let specialValid = true;
                            for (let d = 0; d < this.numDays - 1; d++) {
                                if (isRestrictedSpecial(this.grid[s][d].symbol) && !isHolidaySymbol(this.grid[s][d + 1].symbol)) {
                                    specialValid = false;
                                    break;
                                }
                            }

                            if (valid && specialValid) {
                                swapped = true;
                                break;
                            } else {
                                this.setSymbol(s, maxDay, SYMBOLS.WORK, false);
                                this.setSymbol(s, minDay, SYMBOLS.OFF, false);
                            }
                        }
                    }
                    if (swapped) break;
                }
                if (swapped) break;
            }

            if (!swapped) break;
        }
    }

    /**
     * 平日平均出勤実数と土日祝日平均出勤実数の差を厳格に「マイナス2名（各病棟-2名、マスター全体-8名）」に収束させる平準化
     */
    balanceWeekdayWeekendOffset() {
        if (this.isST || this.isLife) return;

        const isWeekendOrHoliday = (d) => {
            if (this.dates && this.dates[d]) {
                const dt = this.dates[d];
                if (dt.isSun || dt.isSat || dt.isHoliday) return true;
            }
            if (this.dayOffsets && this.dayOffsets[d] < 0) return true;
            return false;
        };

        const weekdays = [];
        const weekends = [];
        for (let d = 0; d < this.numDays; d++) {
            if (isWeekendOrHoliday(d)) weekends.push(d);
            else weekdays.push(d);
        }
        if (weekdays.length === 0 || weekends.length === 0) return;

        for (let iter = 0; iter < 60; iter++) {
            const wkdayLoads = weekdays.map(d => ({ day: d, real: this.getDailyRealWorkBase(d) }));
            const wkndLoads = weekends.map(d => ({ day: d, real: this.getDailyRealWorkBase(d) }));

            const avgWkday = wkdayLoads.reduce((a, b) => a + b.real, 0) / weekdays.length;
            const avgWknd = wkndLoads.reduce((a, b) => a + b.real, 0) / weekends.length;
            const diff = avgWknd - avgWkday; // 理想値は -2.00

            // 土日祝の出勤が多すぎる（平日比-1.75名未満しか減っていない）場合:
            // 土日祝（出勤多）から平日（出勤少）へ出勤を移動（＝土日祝を休みにし、平日を出勤にする）
            if (diff > -1.75) {
                wkndLoads.sort((a, b) => b.real - a.real); // 土日祝で出勤が多い順
                wkdayLoads.sort((a, b) => a.real - b.real); // 平日で出勤が少ない順

                let swapped = false;
                for (const wItem of wkndLoads) {
                    const wkndD = wItem.day;
                    for (const dItem of wkdayLoads) {
                        const wkdayD = dItem.day;

                        for (let s = 0; s < this.numStaff; s++) {
                            const staff = this.staffList[s];
                            if (staff.isUnused || staff.isSectionChief) continue;

                            // 土日祝dが通常出勤○（非固定）で、平日dが通常公休休（非固定）のスタッフ
                            if (this.grid[s][wkndD].symbol === SYMBOLS.WORK && !this.grid[s][wkndD].isFixed &&
                                this.grid[s][wkdayD].symbol === SYMBOLS.OFF && !this.grid[s][wkdayD].isFixed) {

                                // 前日特殊勤務翌日休の保護
                                if (wkdayD > 0 && isRestrictedSpecial(this.grid[s][wkdayD - 1].symbol)) continue;
                                if (wkndD > 0 && isRestrictedSpecial(this.grid[s][wkndD - 1].symbol)) continue;

                                this.setSymbol(s, wkndD, SYMBOLS.OFF, false);
                                this.setSymbol(s, wkdayD, SYMBOLS.WORK, false);

                                const valid = this.isStaffHardValid(s) && this.isGlobalAttributesValid();
                                let specialValid = true;
                                for (let cd = 0; cd < this.numDays - 1; cd++) {
                                    if (isRestrictedSpecial(this.grid[s][cd].symbol) && !isHolidaySymbol(this.grid[s][cd + 1].symbol)) {
                                        specialValid = false;
                                        break;
                                    }
                                }

                                if (valid && specialValid) {
                                    swapped = true;
                                    break;
                                } else {
                                    this.setSymbol(s, wkndD, SYMBOLS.WORK, false);
                                    this.setSymbol(s, wkdayD, SYMBOLS.OFF, false);
                                }
                            }
                        }
                        if (swapped) break;
                    }
                    if (swapped) break;
                }
                if (!swapped) break;
            }
            // 土日祝の出勤が少なすぎる（平日比-2.25名以上減りすぎている）場合:
            else if (diff < -2.25) {
                wkndLoads.sort((a, b) => a.real - b.real); // 土日祝で出勤が少ない順
                wkdayLoads.sort((a, b) => b.real - a.real); // 平日で出勤が多い順

                let swapped = false;
                for (const wItem of wkndLoads) {
                    const wkndD = wItem.day;
                    for (const dItem of wkdayLoads) {
                        const wkdayD = dItem.day;

                        for (let s = 0; s < this.numStaff; s++) {
                            const staff = this.staffList[s];
                            if (staff.isUnused || staff.isSectionChief) continue;

                            if (this.grid[s][wkndD].symbol === SYMBOLS.OFF && !this.grid[s][wkndD].isFixed &&
                                this.grid[s][wkdayD].symbol === SYMBOLS.WORK && !this.grid[s][wkdayD].isFixed) {

                                if (wkdayD > 0 && isRestrictedSpecial(this.grid[s][wkdayD - 1].symbol)) continue;
                                if (wkndD > 0 && isRestrictedSpecial(this.grid[s][wkndD - 1].symbol)) continue;

                                this.setSymbol(s, wkndD, SYMBOLS.WORK, false);
                                this.setSymbol(s, wkdayD, SYMBOLS.OFF, false);

                                const valid = this.isStaffHardValid(s) && this.isGlobalAttributesValid();
                                let specialValid = true;
                                for (let cd = 0; cd < this.numDays - 1; cd++) {
                                    if (isRestrictedSpecial(this.grid[s][cd].symbol) && !isHolidaySymbol(this.grid[s][cd + 1].symbol)) {
                                        specialValid = false;
                                        break;
                                    }
                                }

                                if (valid && specialValid) {
                                    swapped = true;
                                    break;
                                } else {
                                    this.setSymbol(s, wkndD, SYMBOLS.OFF, false);
                                    this.setSymbol(s, wkdayD, SYMBOLS.WORK, false);
                                }
                            }
                        }
                        if (swapped) break;
                    }
                    if (swapped) break;
                }
                if (!swapped) break;
            } else {
                // 目標のマイナス2名（-1.75〜-2.25）に綺麗に収束！
                break;
            }
        }
    }

    /**
     * ST早番等と合算して病棟テーブルの早番合計が4名（南は3名）に過多になる不一致を自動修復
     */
    autoFixOverallocatedEarlyDuties() {
        if (this.isST || this.isLife) return;
        const needEarlyTotal = this.isSouth ? 2 : 3;

        for (let d = 0; d < this.numDays; d++) {
            let poEarlyCount = 0;
            const poEarlyStaffIndices = [];
            for (let s = 0; s < this.numStaff; s++) {
                if (this.staffList[s].isUnused) continue;
                if (this.grid[s][d].symbol === SYMBOLS.EARLY) {
                    poEarlyCount++;
                    if (!this.grid[s][d].isFixed) poEarlyStaffIndices.push(s);
                }
            }

            const rawStEarly = (this.stDailyEarly && this.stDailyEarly[d]) ? this.stDailyEarly[d] : 0;
            const totalEarly = poEarlyCount + rawStEarly;

            // 超過している場合（例: PO早3名 + ST早1名 = 4名）
            if (totalEarly > needEarlyTotal && poEarlyStaffIndices.length > 0) {
                const excess = totalEarly - needEarlyTotal;
                for (let e = 0; e < excess && e < poEarlyStaffIndices.length; e++) {
                    const targetS = poEarlyStaffIndices[e];
                    // PO早番を通常日勤「○」に戻す
                    this.setSymbol(targetS, d, SYMBOLS.WORK, false);

                    // 翌日が特殊翌日休で自動配置された「休」であれば、必要に応じて週休や連勤を再修復
                    if (d + 1 < this.numDays && this.grid[targetS][d + 1].symbol === SYMBOLS.OFF && !this.grid[targetS][d + 1].isFixed) {
                        this.setSymbol(targetS, d + 1, SYMBOLS.WORK, false);
                        if (!this.isStaffHardValid(targetS) || !this.isGlobalAttributesValid()) {
                            this.setSymbol(targetS, d + 1, SYMBOLS.OFF, false);
                        }
                    }
                }
            }
        }
    }

    isStaffHardValid(s) {
        const staff = this.staffList[s];

        // ★ 係長は平日に未固定の「休」を入れることを禁止（スワップ平準化等で平日が休みに変わるのを完全防止！）
        if (staff.isSectionChief) {
            const maxWeekdayOff = this.getMaxAllowedUnfixedWeekdayOffForSectionChief(s);
            let unfixedWeekdayOff = 0;
            for (let d = 0; d < this.numDays; d++) {
                if (!this.grid[s][d].isFixed && !this.grid[s][d].isAfterPreSpecial && this.isWeekdayIndex(d) && isHolidaySymbol(this.grid[s][d].symbol)) {
                    unfixedWeekdayOff++;
                }
            }
            if (unfixedWeekdayOff > maxWeekdayOff) return false;
        }

        const sequence = [];
        const pDays = staff.prevDays || [];
        const pLen = pDays.length;
        const firstDateObj = (this.dates && this.dates[0]) ? new Date(this.dates[0].dateStr + 'T00:00:00') : null;
        for (let i = 0; i < pLen; i++) {
            let pSym = pDays[i] || '';
            let isSatOrSun = false;
            if (firstDateObj) {
                const prevD = new Date(firstDateObj);
                prevD.setDate(prevD.getDate() - (pLen - i));
                const dow = prevD.getDay();
                if (dow === 0 || dow === 6) isSatOrSun = true;
            } else {
                if (pLen === 7 && (i === 3 || i === 4)) isSatOrSun = true;
                if (pLen === 5 && (i === 1 || i === 2)) isSatOrSun = true;
            }
            if (staff.isSectionChief && isSatOrSun && isWorkSymbol(pSym)) {
                pSym = SYMBOLS.OFF;
            }
            sequence.push(pSym);
        }
        for (let d = 0; d < this.numDays; d++) sequence.push(this.grid[s][d].symbol);

        // 「早・遅・E・ハヤ・オソ・イブ」の翌日は原則休日（※係長は除外。その他職員も避けられないフォールバック・事前固定は維持）
        if (!staff.isSectionChief) {
            for (let idx = 0; idx < sequence.length - 1; idx++) {
                if (isRestrictedSpecial(sequence[idx])) {
                    if (!isHolidaySymbol(sequence[idx + 1])) {
                        const dCur = idx - pLen;
                        const dNext = dCur + 1;
                        const isAllowedFallback = (dCur >= 0 && dNext < this.numDays && (this.grid[s][dCur].allowNextWorkFallback || (this.grid[s][dCur].isFixed && this.grid[s][dNext].isFixed)));
                        if (!isAllowedFallback) return false;
                    }
                }
            }
        }

        // ★ 1勤（単発勤務: 休 - 勤務 - 休）に自動割当の特殊勤務（早・遅・E・8時）が入るスワップを禁止
        for (let d = 0; d < this.numDays; d++) {
            if (this.grid[s][d].isFixed) continue;
            const sym = this.grid[s][d].symbol;
            if (isRestrictedSpecial(sym) || sym === SYMBOLS.H8) {
                const prevSym = this.getSymbol(s, d - 1);
                const nextSym = (d + 1 < this.numDays) ? this.getSymbol(s, d + 1) : '';
                if (isHolidaySymbol(prevSym) && (d + 1 < this.numDays && isHolidaySymbol(nextSym))) {
                    return false;
                }
            }
        }

        // 連勤制限 (公休から公休の間のカウント。通常最大5日、allow6Consecなら最大6日)
        const maxConsec = staff.allow6Consec ? 6 : 5;
        let consec = 0;
        for (let idx = 0; idx < sequence.length; idx++) {
            if (sequence[idx] === '') {
                consec = 0;
            } else if (!isPurePublicOffSymbol(sequence[idx])) {
                consec++;
                if (consec > maxConsec) return false;
            } else {
                consec = 0;
            }
        }

        // 5連勤後の2連休ルール（allow6Consecがfalseのスタッフ。係長は土日希望出勤による単休＋平日代休を柔軟許容）
        if (!staff.allow6Consec && !staff.isSectionChief) {
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
     * 全日において属性要件（スケ可日勤○2名以上、係長平日出勤＆不在時主任1名以上、係長・主任不在時の副主任A/B各1名以上、専従3名以上、8時可1名以上）が充足されているか検証
     */
    isGlobalAttributesValid() {
        const scIndices = [];
        const chIndices = [];
        const subTeamAIndices = [];
        const subTeamBIndices = [];

        for (let s = 0; s < this.numStaff; s++) {
            const st = this.staffList[s];
            if (st.isUnused) continue;
            if (st.isSectionChief) scIndices.push(s);
            if (st.isChief) chIndices.push(s);
            if (st.isSubChief) {
                const sec = st.section || '';
                if (sec === 'PT A' || sec === 'OT A' || sec.includes('A') || sec.includes('2')) subTeamAIndices.push(s);
                else if (sec === 'PT B' || sec === 'OT B' || sec.includes('B') || sec.includes('3')) subTeamBIndices.push(s);
            }
        }

        for (let d = 0; d < this.numDays; d++) {
            let schedWork = 0;
            let ftWork = 0;
            let totalH8Cand = 0;
            let pureH8Cand = 0;
            for (let s = 0; s < this.numStaff; s++) {
                if (this.staffList[s].isUnused) continue;
                const sym = this.grid[s][d].symbol;
                if (this.staffList[s].canSched && sym === SYMBOLS.WORK) schedWork++;
                if (this.staffList[s].isFullTime && isWorkSymbol(sym) && sym !== SYMBOLS.TRIP) ftWork++;
                if ((this.staffList[s].can8 && !this.staffList[s].isSectionChief && isWorkSymbol(sym)) || sym === SYMBOLS.H8) {
                    totalH8Cand++;
                    if (!this.staffList[s].canSched || sym === SYMBOLS.H8) pureH8Cand++;
                }
            }
            const totalSched = this.staffList.filter(s => !s.isUnused && s.canSched).length;
            if (totalSched >= 2 && schedWork < 2) return false;

            // ★ 専従スタッフ（isFullTime）毎日3名以上出勤保護
            const totalFT = this.staffList.filter(s => !s.isUnused && s.isFullTime).length;
            if (totalFT >= 3 && ftWork < 3) return false;

            // ★ 係長・主任・副主任（Aチーム・Bチーム両方）のグローバル検証
            let scWork = false;
            let chWork = false;

            for (const scIdx of scIndices) {
                const sym = this.grid[scIdx][d].symbol;
                if (isWorkSymbol(sym) && sym !== SYMBOLS.TRIP) scWork = true;
            }
            for (const chIdx of chIndices) {
                const sym = this.grid[chIdx][d].symbol;
                if (isWorkSymbol(sym) && sym !== SYMBOLS.TRIP) chWork = true;
            }

            // 係長不在時（または係長未配置時）の主任 ➔ 副主任A+B階層チェック
            if (!scWork) {
                if (!chWork) {
                    const subAWork = subTeamAIndices.some(idx => isWorkSymbol(this.grid[idx][d].symbol) && this.grid[idx][d].symbol !== SYMBOLS.TRIP);
                    const subBWork = subTeamBIndices.some(idx => isWorkSymbol(this.grid[idx][d].symbol) && this.grid[idx][d].symbol !== SYMBOLS.TRIP);
                    if (subTeamAIndices.length > 0 && !subAWork) return false;
                    if (subTeamBIndices.length > 0 && !subBWork) return false;
                    if (subTeamAIndices.length === 0 && subTeamBIndices.length === 0 && chIndices.length > 0) return false;
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
                        errors.push(`【スタッフ No.${this.staffList[s].id} ${this.staffList[s].name}】${this.formatDateLabel(d)}の希望勤務「${original}」が変更されています（現在:「${this.grid[s][d].symbol}」）。`);
                    }
                }
            }
        }

        // 2. 特殊勤務の翌日休チェック（※係長は翌日休不要のため除外。またその他職員の避けられないフォールバック配置時は生成を通し、チェック画面のvalidateScheduleGridでエラーを発動させる）
        for (let s = 0; s < this.numStaff; s++) {
            const staff = this.staffList[s];
            if (staff.isUnused || staff.isSectionChief) continue;
            for (let d = 0; d < this.numDays - 1; d++) {
                const sym = this.grid[s][d].symbol;
                if (isRestrictedSpecial(sym)) {
                    const nextSym = this.grid[s][d + 1].symbol;
                    if (!isHolidaySymbol(nextSym) && !this.grid[s][d].allowNextWorkFallback) {
                        errors.push(`【スタッフ No.${staff.id} ${staff.name}】${this.formatDateLabel(d)}の特殊勤務「${sym}」の翌日（${this.formatDateLabel(d + 1)}）が休日ではありません（現在:「${nextSym}」）。`);
                    }
                }
            }
        }

        // 3. 公休間隔・連勤チェック（公休から公休の間は最大6日以内。有休やリフがあってもNG！）
        for (let s = 0; s < this.numStaff; s++) {
            const staff = this.staffList[s];
            if (staff.isUnused) continue;
            const maxAllowed = staff.allow6Consec ? 6 : 5;
            const sequence = [];
            const pDays = staff.prevDays || [];
            const pLen = pDays.length;
            const firstDateObj = (this.dates && this.dates[0]) ? new Date(this.dates[0].dateStr + 'T00:00:00') : null;
            for (let p = 0; p < pLen; p++) {
                let pSym = pDays[p] || '';
                let isSatOrSun = false;
                if (firstDateObj) {
                    const prevD = new Date(firstDateObj);
                    prevD.setDate(prevD.getDate() - (pLen - p));
                    const dow = prevD.getDay();
                    if (dow === 0 || dow === 6) isSatOrSun = true;
                } else {
                    if (pLen === 7 && (p === 3 || p === 4)) isSatOrSun = true;
                    if (pLen === 5 && (p === 1 || p === 2)) isSatOrSun = true;
                }
                if (staff.isSectionChief && isSatOrSun && isWorkSymbol(pSym)) pSym = SYMBOLS.OFF;
                sequence.push(pSym);
            }
            for (let d = 0; d < this.numDays; d++) sequence.push(this.grid[s][d].symbol);

            let streak = 0;
            let startIdx = 0;
            for (let idx = 0; idx < sequence.length; idx++) {
                if (sequence[idx] === '') {
                    streak = 0;
                } else if (!isPurePublicOffSymbol(sequence[idx])) {
                    if (streak === 0) startIdx = idx;
                    streak++;
                    if (streak > 6) {
                        const sLabel = startIdx < pLen ? `前${pLen - startIdx}日` : this.formatDateLabel(startIdx - pLen);
                        const eLabel = idx < pLen ? `前${pLen - idx}日` : this.formatDateLabel(idx - pLen);
                        errors.push(`【スタッフ No.${staff.id} ${staff.name}】${sLabel}〜${eLabel}で公休（休）のない連続期間が${streak}日連続（労基法・全スタッフ共通ハード制約: 公休から公休の間は最大6日以内です。有休やリフは公休にあたりません）です。`);
                        break;
                    } else if (streak > maxAllowed && isWorkSymbol(sequence[idx])) {
                        const sLabel = startIdx < pLen ? `前${pLen - startIdx}日` : this.formatDateLabel(startIdx - pLen);
                        const eLabel = idx < pLen ? `前${pLen - idx}日` : this.formatDateLabel(idx - pLen);
                        errors.push(`【スタッフ No.${staff.id} ${staff.name}】${sLabel}〜${eLabel}で上限${maxAllowed}連勤違反（${streak}日連続勤務）です。`);
                        break;
                    }
                } else {
                    streak = 0;
                }
            }
        }

        // 4. 5連勤後の2連休チェック（allow6Consecがfalseのスタッフ。係長が土日希望出勤により単休＋平日代休となる場合は柔軟許容）
        for (let s = 0; s < this.numStaff; s++) {
            const staff = this.staffList[s];
            if (staff.isUnused || staff.allow6Consec || staff.isSectionChief) continue;

            const seq = [];
            const pDays = staff.prevDays || [];
            const pLen = pDays.length;
            const firstDateObj = (this.dates && this.dates[0]) ? new Date(this.dates[0].dateStr + 'T00:00:00') : null;
            for (let p = 0; p < pLen; p++) {
                let pSym = pDays[p] || '';
                let isSatOrSun = false;
                if (firstDateObj) {
                    const prevD = new Date(firstDateObj);
                    prevD.setDate(prevD.getDate() - (pLen - p));
                    const dow = prevD.getDay();
                    if (dow === 0 || dow === 6) isSatOrSun = true;
                } else {
                    if (pLen === 7 && (p === 3 || p === 4)) isSatOrSun = true;
                    if (pLen === 5 && (p === 1 || p === 2)) isSatOrSun = true;
                }
                if (staff.isSectionChief && isSatOrSun && isWorkSymbol(pSym)) pSym = SYMBOLS.OFF;
                seq.push(pSym);
            }
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
                                    const targetD = checkIdx - pLen;
                                    const targetLabel = (targetD >= 0 && targetD < this.numDays) ? this.formatDateLabel(targetD) : `${targetD + 1}日目`;
                                    errors.push(`【スタッフ No.${staff.id} ${staff.name}】5連勤直後の${targetLabel}は2連休（休・有・リフ）が必要です（現在:「${sym}」）。`);
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
                    const sDay = this.formatDateLabel(wSpan[0]);
                    const eDay = this.formatDateLabel(wSpan[wSpan.length - 1]);
                    errors.push(`【スタッフ No.${staff.id} ${staff.name}】第${wIdx + 1}週（${sDay}〜${eDay}の日〜土）に出勤が${weekWorkCount}日あります（週休2日が必要です。出張・半休を除く）。`);
                }
            });
        }

        // 6. 属性充足チェック（スケ可○ >= 2, 役職 >= 2 出張除く, 専従 >= 3 出張除く）
        for (let d = 0; d < this.numDays; d++) {
            const dateLabel = this.formatDateLabel(d);
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
            if (!this.isLife && totalSched >= 2 && schedWorkCount < 2) {
                errors.push(`【${dateLabel}】「スケ可」スタッフの日勤（○）が${schedWorkCount}名しかいません（要件: 2名以上）。`);
            }
            // 係長不在時における主任出勤 ➔ 副主任（AとB両方）出勤チェック
            const scStaff = this.staffList.filter(s => !s.isUnused && s.isSectionChief);
            const chStaff = this.staffList.filter(s => !s.isUnused && s.isChief);
            const subChStaff = this.staffList.filter(s => !s.isUnused && s.isSubChief);

            if (!this.isLife && scStaff.length > 0) {
                let scWorking = false;
                scStaff.forEach(sc => {
                    const scSIdx = this.staffList.indexOf(sc);
                    const sym = this.grid[scSIdx][d].symbol;
                    if (!isHolidaySymbol(sym) && sym !== SYMBOLS.TRIP && !isExcludeSymbol(sym)) scWorking = true;
                });

                if (!scWorking) {
                    let chWorking = false;
                    chStaff.forEach(ch => {
                        const chSIdx = this.staffList.indexOf(ch);
                        const sym = this.grid[chSIdx][d].symbol;
                        if (!isHolidaySymbol(sym) && sym !== SYMBOLS.TRIP && !isExcludeSymbol(sym)) chWorking = true;
                    });
                    if (!chWorking) {
                        let subAWorking = false, subBWorking = false;
                        subChStaff.forEach(sub => {
                            const subSIdx = this.staffList.indexOf(sub);
                            const sym = this.grid[subSIdx][d].symbol;
                            if (!isHolidaySymbol(sym) && sym !== SYMBOLS.TRIP && !isExcludeSymbol(sym)) {
                                const sec = sub.section || '';
                                if (sec === 'PT A' || sec === 'OT A' || sec.includes('A') || sec.includes('2')) subAWorking = true;
                                else if (sec === 'PT B' || sec === 'OT B' || sec.includes('B') || sec.includes('3')) subBWorking = true;
                            }
                        });
                        if (!(subAWorking && subBWorking)) {
                            errors.push(`【${dateLabel}】係長・主任ともに不在ですが、副主任（Aチーム・Bチーム両方）が出勤していません（主任1名以上、または副主任をA・B両方配置してください）。`);
                        }
                    }
                }
            }
            // ★ PT・OT・STの専従はその階で3人以上出勤する制約
            if (!this.isST && !this.isLife) {
                const stFtCount = (this.stDailyFtWork && this.stDailyFtWork[d]) ? this.stDailyFtWork[d] : 0;
                const totalFtWork = fullTimeWorkCount + stFtCount;
                const totalFloorFT = this.staffList.filter(s => !s.isUnused && s.isFullTime).length + (this.stFloorFtCount || 0);
                const reqFT = totalFloorFT >= 3 ? 3 : totalFloorFT;
                if (reqFT > 0 && totalFtWork < reqFT) {
                    errors.push(`【${dateLabel}】「専従（PT・OT・ST合計）」スタッフの出勤が${totalFtWork}名しかいません（要件: ${reqFT}名以上、出張除く）。`);
                }
            } else if (this.isST) {
                const totalFullTime = this.staffList.filter(s => !s.isUnused && s.isFullTime).length;
                if (totalFullTime >= 2 && fullTimeWorkCount < 2) {
                    errors.push(`【${dateLabel}】ST「専従」スタッフの出勤が${fullTimeWorkCount}名しかいません（要件: 2名以上、出張除く）。`);
                }
            }

            // ★ 1年目制約（通常PO ＆ 南病棟特殊ルール）
            if (!this.isST && !this.isLife) {
                if (this.isSouth) {
                    // 南病棟の特殊ルール
                    const s2Staff = [], s3Staff = [];
                    for (let s = 0; s < this.numStaff; s++) {
                        const st = this.staffList[s];
                        if (st.isUnused) continue;
                        const sec = st.section || '';
                        if (sec.includes('2')) s2Staff.push(s);
                        else if (sec.includes('3')) s3Staff.push(s);
                    }
                    const s2Early = s2Staff.filter(s => this.grid[s][d].symbol === SYMBOLS.EARLY);
                    const s3Early = s3Staff.filter(s => this.grid[s][d].symbol === SYMBOLS.EARLY);
                    const s2Late = s2Staff.filter(s => this.grid[s][d].symbol === SYMBOLS.LATE);
                    const s3Late = s3Staff.filter(s => this.grid[s][d].symbol === SYMBOLS.LATE);
                    const s2Eve = s2Staff.filter(s => this.grid[s][d].symbol === SYMBOLS.EVE);
                    const s3Eve = s3Staff.filter(s => this.grid[s][d].symbol === SYMBOLS.EVE);

                    // 早2人のうち1年目は1人まで
                    const allEarlyFY = [...s2Early, ...s3Early].filter(s => this.staffList[s].isFirstYear);
                    if (allEarlyFY.length > 1) {
                        errors.push(`【${dateLabel}】南病棟の早番のうち「1年目」が${allEarlyFY.length}名います（要件: 1名以下）。`);
                    }
                    // E2人のうち1年目は1人まで
                    const allEveFY = [...s2Eve, ...s3Eve].filter(s => this.staffList[s].isFirstYear);
                    if (allEveFY.length > 1) {
                        errors.push(`【${dateLabel}】南病棟のE番のうち「1年目」が${allEveFY.length}名います（要件: 1名以下）。`);
                    }
                    // 同じフロアの遅とE2人のうち1年目は1人まで
                    const s2LateEveFY = [...s2Late, ...s2Eve].filter(s => this.staffList[s].isFirstYear);
                    if (s2LateEveFY.length > 1) {
                        errors.push(`【${dateLabel}】南2の遅番・E番（計${s2Late.length + s2Eve.length}名）のうち「1年目」が${s2LateEveFY.length}名います（要件: 1名以下）。`);
                    }
                    const s3LateEveFY = [...s3Late, ...s3Eve].filter(s => this.staffList[s].isFirstYear);
                    if (s3LateEveFY.length > 1) {
                        errors.push(`【${dateLabel}】南3の遅番・E番（計${s3Late.length + s3Eve.length}名）のうち「1年目」が${s3LateEveFY.length}名います（要件: 1名以下）。`);
                    }
                } else {
                    // 通常PO
                    const earlyStaff = [];
                    const lateEveStaff = [];
                    for (let s = 0; s < this.numStaff; s++) {
                        if (this.staffList[s].isUnused) continue;
                        const sym = this.grid[s][d].symbol;
                        if (sym === SYMBOLS.EARLY) earlyStaff.push(s);
                        if (sym === SYMBOLS.LATE || sym === SYMBOLS.EVE) lateEveStaff.push(s);
                    }
                    // 早3名中1年目は最大1名
                    const earlyFY = earlyStaff.filter(s => this.staffList[s].isFirstYear);
                    if (earlyFY.length >= 2) {
                        errors.push(`【${dateLabel}】早番（早）スタッフのうち「1年目」が${earlyFY.length}名います（要件: 1名以下）。`);
                    }
                    // 遅＋E 3名中1年目は最大1名
                    const lateEveFY = lateEveStaff.filter(s => this.staffList[s].isFirstYear);
                    if (lateEveFY.length >= 2) {
                        errors.push(`【${dateLabel}】遅番・E番（遅・E）のうち「1年目」が${lateEveFY.length}名います（要件: 1名以下）。`);
                    }
                }
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

        // 8. 特殊勤務の定数配置 ※POテーブルのみ！STテーブルおよび生活期テーブルは単体で満たせないためスキップ
        if (!this.isST && !this.isLife) {
            for (let d = 0; d < this.numDays; d++) {
                const dateLabel = this.formatDateLabel(d);
                if (this.isSouth) {
                    // 南病棟の特殊勤務定数配置（早: 南2に1名・南3に1名、遅: 南2に1名・南3に1名、E: 南2に1名・南3に1名、8時は不要）
                    const s2Staff = [], s3Staff = [];
                    for (let s = 0; s < this.numStaff; s++) {
                        if (this.staffList[s].isUnused) continue;
                        if (this.getSubFloor(s) === '南2') s2Staff.push(s);
                        else s3Staff.push(s);
                    }
                    const s2Early = s2Staff.filter(s => this.grid[s][d].symbol === SYMBOLS.EARLY).length;
                    const s3Early = s3Staff.filter(s => this.grid[s][d].symbol === SYMBOLS.EARLY).length;
                    const s2Late  = s2Staff.filter(s => this.grid[s][d].symbol === SYMBOLS.LATE).length;
                    const s3Late  = s3Staff.filter(s => this.grid[s][d].symbol === SYMBOLS.LATE).length;
                    const s2Eve   = s2Staff.filter(s => this.grid[s][d].symbol === SYMBOLS.EVE).length;
                    const s3Eve   = s3Staff.filter(s => this.grid[s][d].symbol === SYMBOLS.EVE).length;

                    let stEarlyCount = 0;
                    if (this.stDailyEarly && this.stDailyEarly[d]) {
                        stEarlyCount = this.stDailyEarly[d];
                    }
                    const effectiveStEarly = Math.min(1, stEarlyCount);

                    let earlyValid = false;
                    if (effectiveStEarly === 0) {
                        earlyValid = (s2Early === 1 && s3Early === 1);
                    } else {
                        // ST早番が1名以上の場合: STをどちらかに充当し、もう一方にPO早番1名
                        earlyValid = (s2Early === 1 && s3Early === 0) || (s2Early === 0 && s3Early === 1);
                    }
                    if (!earlyValid) {
                        errors.push(`【${dateLabel}】南病棟早番要件を満たしていません（南2に1名、南3に1名。ST早番含めて計2名。現況: 南2=${s2Early}名, 南3=${s3Early}名, ST=${stEarlyCount}名）。`);
                    }
                    if (s2Late !== 1 || s3Late !== 1) {
                        errors.push(`【${dateLabel}】南病棟遅番要件を満たしていません（南2に1名、南3に1名。現況: 南2=${s2Late}名, 南3=${s3Late}名）。`);
                    }
                    if (s2Eve !== 1 || s3Eve !== 1) {
                        errors.push(`【${dateLabel}】南病棟E番要件を満たしていません（南2に1名、南3に1名。現況: 南2=${s2Eve}名, 南3=${s3Eve}名）。`);
                    }
                } else {
                    // 通常PO（早3, 遅1, E2, 8時1）★ 1階〜3階: PT+OT+ST合算で早3, 遅1, E2
                    let early = 0, late = 0, eve = 0, h8 = 0;
                    for (let s = 0; s < this.numStaff; s++) {
                        if (this.staffList[s].isUnused) continue;
                        const sym = this.grid[s][d].symbol;
                        // ★ ハヤ・オソ・イブは早・遅・Eとしてカウントしない！
                        if (sym === SYMBOLS.EARLY) early++;
                        if (sym === SYMBOLS.LATE) late++;
                        if (sym === SYMBOLS.EVE) eve++;
                        if (sym === SYMBOLS.H8) h8++;
                    }
                    const stEarly = (this.stDailyEarly && this.stDailyEarly[d]) ? this.stDailyEarly[d] : 0;
                    const stLate = (this.stDailyLate && this.stDailyLate[d]) ? this.stDailyLate[d] : 0;
                    const stEve = (this.stDailyEve && this.stDailyEve[d]) ? this.stDailyEve[d] : 0;
                    const totalEarly = early + stEarly;
                    const totalLate = late + stLate;
                    const totalEve = eve + stEve;

                    if (totalEarly !== 3) errors.push(`【${dateLabel}】早番（早）の人数が${totalEarly}名です（要件: 3名。PO:${early}名, ST:${stEarly}名）。`);
                    if (totalLate !== 1) errors.push(`【${dateLabel}】遅番（遅）の人数が${totalLate}名です（要件: 1名。PO:${late}名, ST:${stLate}名）。`);
                    if (totalEve !== 2) errors.push(`【${dateLabel}】イブニング（E）の人数が${totalEve}名です（要件: 2名。PO:${eve}名, ST:${stEve}名）。`);
                    if (h8 !== 1) errors.push(`【${dateLabel}】8時開始の人数が${h8}名です（要件: 1名）。`);
                }
            }
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
            const sectionWork = {
                'PT A': 0, 'PT B': 0, 'OT A': 0, 'OT B': 0,
                'PT 2': 0, 'PT 3': 0, 'OT 2': 0, 'OT 3': 0,
                'ST': 0, '訪問': 0, '通所': 0, 'Cl1': 0, 'Cl2': 0, '管理': 0,
                'ハ1': 0, 'ハ2': 0, 'ハ3': 0, 'ハ南': 0, 'その他': 0
            };
            for (let s = 0; s < this.numStaff; s++) {
                if (this.staffList[s].isUnused) continue;
                const staff = this.staffList[s];
                const sym = this.grid[s][d].symbol;
                const isExcludedFromWork = (staff.lifeSection === '管理' || staff.lifeSection === 'Cl1');
                const sec = staff.lifeSection ? (staff.lifeSection === 'Cl2' ? '通所' : staff.lifeSection) : (staff.section || 'その他');
                let staffWorkAmt = 0;

                // ★ ハヤ・オソ・イブは特殊時間と同じ時間で出勤する勤務だが、早・遅・Eとしてのカウントはせず、〇としてカウント！
                if (sym === SYMBOLS.EARLY) { early++; if (!isExcludedFromWork) totalWork += 1.0; staffWorkAmt = 1.0; }
                else if (sym === SYMBOLS.LATE) { late++; if (!isExcludedFromWork) totalWork += 1.0; staffWorkAmt = 1.0; }
                else if (sym === SYMBOLS.EVE) { eve++; if (!isExcludedFromWork) totalWork += 1.0; staffWorkAmt = 1.0; }
                else if (sym === SYMBOLS.H8) { h8++; if (!isExcludedFromWork) totalWork += 1.0; staffWorkAmt = 1.0; }
                else if (sym === SYMBOLS.TRIP || sym === '出' || sym === '出張') {
                    // ★ ユーザー指示: 「出張」の人は実数に換算しない（0カウント）
                    normal++; // 勤務記号としては保持するが、出勤実数には加算しない
                    staffWorkAmt = 0;
                }
                else if (sym === SYMBOLS.WORK || sym === '〇' || sym === '◯' || sym === SYMBOLS.NO_ALLOW_EARLY || sym === SYMBOLS.NO_ALLOW_LATE || sym === SYMBOLS.NO_ALLOW_EVE) {
                    normal++; if (!isExcludedFromWork) totalWork += 1.0; staffWorkAmt = 1.0;
                }
                else if (sym === SYMBOLS.OFF) { off += 1.0; }
                else if (sym === SYMBOLS.PAID) { paid += 1.0; }
                else if (SYMBOLS.REF_SUMMER.includes(sym) || SYMBOLS.REF_WINTER.includes(sym)) { ref += 1.0; }
                else if (sym === SYMBOLS.HALF_WORK_OFF || sym === SYMBOLS.HALF_OFF_WORK) {
                    const headAmt = staff.isHalf ? 0.25 : 0.5;
                    if (!isExcludedFromWork) totalWork += headAmt;
                    off += 0.5;
                    staffWorkAmt = 0.5;
                }
                else if (sym === SYMBOLS.HALF_WORK_PAID || sym === SYMBOLS.HALF_PAID_WORK) {
                    const headAmt = staff.isHalf ? 0.25 : 0.5;
                    if (!isExcludedFromWork) totalWork += headAmt;
                    paid += 0.5;
                    staffWorkAmt = 0.5;
                }

                // ★ セクション別出勤実数の集計（時短0.5スタッフや0カウントを正確に反映）
                let staffRealAmt = 0;
                if (!staff.isZeroCount && !isExcludedFromWork) {
                    const isHaDuty = !!(staff.haSection && ['ハ1', 'ハ2', 'ハ3', 'ハ4', 'ハ南'].includes(staff.haSection));
                    const factor = (staff.isHalf || isHaDuty) ? 0.5 : 1.0;
                    staffRealAmt = staffWorkAmt * factor;
                }

                if (staffRealAmt > 0) {
                    if (sec in sectionWork) {
                        sectionWork[sec] += staffRealAmt;
                    } else {
                        sectionWork['その他'] += staffRealAmt;
                    }
                }
            }

            // ★ ST出勤実数と出勤人数の反映
            const stWorkAmt = (this.stDailyWork && this.stDailyWork[d]) ? this.stDailyWork[d] : 0;
            const stHeadAmt = (this.stDailyHeadCount && this.stDailyHeadCount[d]) ? this.stDailyHeadCount[d] : (this.stDailyWork ? (this.stDailyWork[d] >= 0.5 ? Math.ceil(this.stDailyWork[d]) : 0) : 0);
            sectionWork['ST'] = stWorkAmt;
            totalWork += stHeadAmt;

            // ★ 病棟テーブル（1F〜3F、南）において所属STスタッフの早・遅・Eを合算
            if (!this.isST && !this.isLife) {
                if (this.stDailyEarly && this.stDailyEarly[d]) {
                    early += this.stDailyEarly[d];
                }
                if (this.stDailyLate && this.stDailyLate[d]) {
                    late += this.stDailyLate[d];
                }
                if (this.stDailyEve && this.stDailyEve[d]) {
                    eve += this.stDailyEve[d];
                }
            }

            // 実数合計の計算 (案B: 出勤実働 - 増員分。マイナス/減員時は実数変更なし)
            let realWorkBase = stWorkAmt;
            if (this.lifeDailyWork && this.lifeDailyWork[d]) {
                realWorkBase += this.lifeDailyWork[d];
            }
            for (let s = 0; s < this.numStaff; s++) {
                if (this.staffList[s].isUnused) continue;
                const staff = this.staffList[s];
                if (staff.isZeroCount || staff.lifeSection === '管理' || staff.lifeSection === 'Cl1') continue;
                const sym = this.grid[s][d].symbol;
                let amt = 0;
                if ([SYMBOLS.EARLY, SYMBOLS.LATE, SYMBOLS.EVE, SYMBOLS.H8, SYMBOLS.WORK, '〇', '◯', SYMBOLS.NO_ALLOW_EARLY, SYMBOLS.NO_ALLOW_LATE, SYMBOLS.NO_ALLOW_EVE].includes(sym) && sym !== '出' && sym !== '出張' && sym !== SYMBOLS.TRIP) {
                    amt = 1.0;
                } else if (isHalfDuty(sym)) {
                    amt = 0.5;
                }
                if (amt > 0) {
                    const isHaDuty = !!(staff.haSection && ['ハ1', 'ハ2', 'ハ3', 'ハ4', 'ハ南'].includes(staff.haSection));
                    const factor = (staff.isHalf || isHaDuty) ? 0.5 : 1.0;
                    realWorkBase += amt * factor;
                }
            }
            const offset = (this.dayOffsets && this.dayOffsets[d]) ? this.dayOffsets[d] : 0;
            const realWorkRaw = (offset > 0) ? Math.max(0, realWorkBase - offset) : realWorkBase;
            const realWork = Number(realWorkRaw.toFixed(2));
            totalWork = Number(totalWork.toFixed(2));
            daily.push({ day: d + 1, totalWork, realWork, early, late, eve, h8, normal, off, paid, ref, sectionWork, offset });
        }

        const staffStats = [];
        const refBreakdownMap = {};
        const allRefSyms = [...SYMBOLS.REF_SUMMER, ...SYMBOLS.REF_WINTER];
        allRefSyms.forEach(sym => { refBreakdownMap[sym] = { symbol: sym, days: 0, staffSet: new Set() }; });

        for (let s = 0; s < this.numStaff; s++) {
            let workDays = 0, offDays = 0, paidDays = 0, refDays = 0;
            let early = 0, late = 0, eve = 0, h8 = 0;
            const staffRefSyms = [];
            for (let d = 0; d < this.numDays; d++) {
                const sym = this.grid[s][d].symbol;
                // ★ ハヤ・オソ・イブは特殊勤務としてカウントしない（workDaysのみ加算）
                if (sym === SYMBOLS.EARLY) { early++; workDays += 1.0; }
                else if (sym === SYMBOLS.LATE) { late++; workDays += 1.0; }
                else if (sym === SYMBOLS.EVE) { eve++; workDays += 1.0; }
                else if (sym === SYMBOLS.H8) { h8++; workDays += 1.0; }
                else if (sym === SYMBOLS.WORK || sym === '〇' || sym === '◯' || sym === SYMBOLS.TRIP || sym === SYMBOLS.NO_ALLOW_EARLY || sym === SYMBOLS.NO_ALLOW_LATE || sym === SYMBOLS.NO_ALLOW_EVE) { workDays += 1.0; }
                else if (sym === SYMBOLS.OFF) { offDays += 1.0; }
                else if (sym === SYMBOLS.PAID) { paidDays += 1.0; }
                else if (SYMBOLS.REF_SUMMER.includes(sym) || SYMBOLS.REF_WINTER.includes(sym)) {
                    refDays += 1.0;
                    staffRefSyms.push(sym);
                    if (!this.staffList[s].isUnused && refBreakdownMap[sym]) {
                        refBreakdownMap[sym].days += 1;
                        refBreakdownMap[sym].staffSet.add(s);
                    }
                }
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
                refSyms: staffRefSyms,
                early,
                late,
                eve,
                h8
            });
        }

        const refBreakdown = allRefSyms.map(sym => ({
            symbol: sym,
            days: refBreakdownMap[sym].days,
            staffCount: refBreakdownMap[sym].staffSet.size
        })).filter(item => item.days > 0);

        return { daily, staffStats, refBreakdown };
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
    const isST = !!options.isST;
    const isSouth = !!options.isSouth;
    const isLife = !!options.isLife;
    const weekSpans = getSunToSatWeekSpans(dates, numDays);

    const formatDateLabel = (d) => {
        if (dates && dates[d]) {
            const item = dates[d];
            if (typeof item === 'object') {
                if (item.label) return item.label;
                if (item.m && item.day) return `${item.m}/${item.day}`;
                if (item.month && item.day) return `${item.month}/${item.day}`;
            } else if (typeof item === 'string') {
                const parts = item.split('-');
                if (parts.length === 3) return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
                return item;
            } else if (item instanceof Date) {
                return `${item.getMonth() + 1}/${item.getDate()}`;
            }
        }
        return `${d + 1}日目`;
    };

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

    const getSouthSubFloor = (st, sIdx) => {
        if (!st) return (sIdx % 2 === 0) ? '南2' : '南3';
        const sec = st.section || '';
        if (sec.includes('2') || sec === 'PT A' || sec === 'OT A') return '南2';
        if (sec.includes('3') || sec === 'PT B' || sec === 'OT B') return '南3';
        return (sIdx % 2 === 0) ? '南2' : '南3';
    };

    // 1. 各スタッフ単位の制約検証
    for (let s = 0; s < numStaff; s++) {
        const staff = staffList[s];
        if (staff.isUnused) continue;
        const maxAllowed = staff.allow6Consec ? 6 : 5;

        // A. 個別不可フラグチェック（係長に希望入力された特殊勤務はトグルに関わらず許可・保持）
        for (let d = 0; d < numDays; d++) {
            if (staff.isSectionChief) break;
            const sym = getSym(s, d);
            const dateLabel = formatDateLabel(d);
            if (sym === SYMBOLS.H8 && !staff.can8) {
                errors.push(`【スタッフ No.${staff.id} ${staff.name}】${dateLabel}に「8時」が入っていますが、「8時可」ではありません。`);
                addConflict(s, d, `${dateLabel}: 8時可フラグがOFFです`);
            }
            if ((sym === SYMBOLS.EARLY || sym === SYMBOLS.NO_ALLOW_EARLY) && staff.noEarly) {
                errors.push(`【スタッフ No.${staff.id} ${staff.name}】${dateLabel}に「${sym}」が入っていますが、「早番不可」です。`);
                addConflict(s, d, `${dateLabel}: 早番不可です`);
            }
            if ((sym === SYMBOLS.LATE || sym === SYMBOLS.NO_ALLOW_LATE) && staff.noLate) {
                errors.push(`【スタッフ No.${staff.id} ${staff.name}】${dateLabel}に「${sym}」が入っていますが、「遅番不可」です。`);
                addConflict(s, d, `${dateLabel}: 遅番不可です`);
            }
            if ((sym === SYMBOLS.EVE || sym === SYMBOLS.NO_ALLOW_EVE) && staff.noEve) {
                errors.push(`【スタッフ No.${staff.id} ${staff.name}】${dateLabel}に「${sym}」が入っていますが、「E不可」です。`);
                addConflict(s, d, `${dateLabel}: E不可です`);
            }
        }

        // B. 特殊勤務（早・遅・E・ハヤ・オソ・イブ）翌日休日チェック（※係長のみ翌日休不要、その他役職者含む職員は翌日休でない場合エラー＆網掛け発動）
        if (!staff.isSectionChief) {
            for (let d = 0; d < numDays - 1; d++) {
                const sym = getSym(s, d);
                if (isRestrictedSpecial(sym)) {
                    const nextSym = getSym(s, d + 1);
                    if (!isHolidaySymbol(nextSym)) {
                        const curDateLabel = formatDateLabel(d);
                        const nextDateLabel = formatDateLabel(d + 1);
                        errors.push(`【スタッフ No.${staff.id} ${staff.name}】${curDateLabel}の特殊勤務「${sym}」の翌日（${nextDateLabel}）が休日ではありません（現在:「${nextSym}」）。`);
                        addConflict(s, d, `${curDateLabel}: 特殊勤務「${sym}」の翌日は原則休日が必要です`);
                        addConflict(s, d + 1, `${nextDateLabel}: 前日が「${sym}」のため原則休日にする必要があります`);
                    }
                }
            }
        }

        // C. 連勤チェック（公休なし連続期間、allow6Consecなら6、通常5）
        const sequence = [];
        const pDays = staff.prevDays || [];
        const pLen = pDays.length;
        const firstDateObj = (dates && dates[0]) ? new Date(dates[0].dateStr + 'T00:00:00') : null;
        for (let p = 0; p < pLen; p++) {
            let pSym = pDays[p] || '';
            let isSatOrSun = false;
            if (firstDateObj) {
                const prevD = new Date(firstDateObj);
                prevD.setDate(prevD.getDate() - (pLen - p));
                const dow = prevD.getDay();
                if (dow === 0 || dow === 6) isSatOrSun = true;
            } else {
                if (pLen === 7 && (p === 3 || p === 4)) isSatOrSun = true;
                if (pLen === 5 && (p === 1 || p === 2)) isSatOrSun = true;
            }
            if (staff.isSectionChief && isSatOrSun && isWorkSymbol(pSym)) pSym = SYMBOLS.OFF;
            sequence.push(pSym);
        }
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
                    const sLabel = sIdxSeq < pLen ? `前${pLen - sIdxSeq}日` : formatDateLabel(sIdxSeq - pLen);
                    const eLabel = eIdxSeq < pLen ? `前${pLen - eIdxSeq}日` : formatDateLabel(eIdxSeq - pLen);
                    const ruleMsg = staff.allow6Consec ? '6連勤許可（7日以上連続は不可）' : '最大5連勤（6日以上連続は不可）';
                    errors.push(`【スタッフ No.${staff.id} ${staff.name}】${sLabel}〜${eLabel}で公休なし${nonOffStreak.length}日連続となっています（要件: ${ruleMsg}）。`);
                    nonOffStreak.forEach(seqDay => {
                        if (seqDay >= pLen) {
                            addConflict(s, seqDay - pLen, `公休間隔が上限(${maxAllowed}日)を超えています`);
                        }
                    });
                }
            } else {
                nonOffStreak = [];
            }
        }

        // D. 5連勤後の2連休チェック（allow6Consecがfalseのスタッフ。係長が土日希望出勤により単休＋平日代休となる場合は柔軟許容）
        if (!staff.allow6Consec && !staff.isSectionChief) {
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
                                    const targetD = checkIdx - pLen;
                                    const targetLabel = (targetD >= 0 && targetD < numDays) ? formatDateLabel(targetD) : `${targetD + 1}日目`;
                                    errors.push(`【スタッフ No.${staff.id} ${staff.name}】5連勤直後の${targetLabel}は2連休（休・有・リフ）が必要です（現在:「${sym}」）。`);
                                    if (targetD >= 0 && targetD < numDays) {
                                        addConflict(s, targetD, `5連勤の直後は2連休が必要です`);
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
                    const sDay = formatDateLabel(wSpan[0]);
                    const eDay = formatDateLabel(wSpan[wSpan.length - 1]);
                    errors.push(`【スタッフ No.${staff.id} ${staff.name}】第${wIdx + 1}週（${sDay}〜${eDay}の日〜土）に出勤が${weekWorkCount}日あります（週休2日が必要です。出張・半休を除く）。`);
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
        const dateLabel = formatDateLabel(d);
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

            // ★ ハヤ・オソ・イブは特殊勤務としてカウントしない（〇として扱う）
            if (sym === SYMBOLS.EARLY) earlyCount++;
            if (sym === SYMBOLS.LATE) lateCount++;
            if (sym === SYMBOLS.EVE) eveCount++;
            if (sym === SYMBOLS.H8) h8Count++;
        }

        // スケ可: 日勤（○）が2名以上（生活期は不要）
        const totalSched = staffList.filter(s => !s.isUnused && s.canSched).length;
        if (!isLife && totalSched >= 2 && schedWorkCount < 2) {
            errors.push(`【${dateLabel}】「スケ可」スタッフの日勤（○）が${schedWorkCount}名しかいません（要件: 2名以上）。`);
            for (let s = 0; s < numStaff; s++) {
                if (!staffList[s].isUnused && staffList[s].canSched && getSym(s, d) !== SYMBOLS.WORK) {
                    addConflict(s, d, `${dateLabel}: スケ可の日勤(○)が不足しています（現在:「${getSym(s, d) || '未設定'}」）`);
                }
            }
        }

        // 係長不在時における主任出勤 ➔ 副主任（Aチーム・Bチーム両方）出勤チェック（※ST・生活期テーブルは対象外）
        const scStaffFinal = staffList.filter(s => !s.isUnused && s.isSectionChief);
        const chStaffFinal = staffList.filter(s => !s.isUnused && s.isChief);
        const subChStaffFinal = staffList.filter(s => !s.isUnused && s.isSubChief);

        if (!isST && !isLife && scStaffFinal.length > 0) {
            let scWorking = false;
            scStaffFinal.forEach(sc => {
                const sym = getSym(staffList.indexOf(sc), d);
                if (!isHolidaySymbol(sym) && sym !== SYMBOLS.TRIP && !isExcludeSymbol(sym)) scWorking = true;
            });
            if (!scWorking) {
                let chWorking = false;
                chStaffFinal.forEach(ch => {
                    const sym = getSym(staffList.indexOf(ch), d);
                    if (!isHolidaySymbol(sym) && sym !== SYMBOLS.TRIP && !isExcludeSymbol(sym)) chWorking = true;
                });

                // ★ ST役職者の出勤補完判定:
                let stChiefWorking = false;
                let stSubChiefWorking = false;
                if (this.options && this.options.linkedStStaffData && Array.isArray(this.options.linkedStStaffData.staffList)) {
                    this.options.linkedStStaffData.staffList.forEach((st, stIdx) => {
                        const stRow = this.options.linkedStStaffData.grid ? this.options.linkedStStaffData.grid[stIdx] : null;
                        const stSym = (stRow && stRow[d]) ? (stRow[d].symbol || stRow[d]) : '';
                        if (isWorkSymbol(stSym) && stSym !== SYMBOLS.TRIP) {
                            if (st.isChief) stChiefWorking = true;
                            if (st.isSubChief) stSubChiefWorking = true;
                        }
                    });
                }
                if (!chWorking && stChiefWorking) {
                    chWorking = true; // ST主任の出勤によりクリア！
                }

                if (!chWorking) {
                    let subAWorking = false, subBWorking = false;
                    subChStaffFinal.forEach(sub => {
                        const sym = getSym(staffList.indexOf(sub), d);
                        if (!isHolidaySymbol(sym) && sym !== SYMBOLS.TRIP && !isExcludeSymbol(sym)) {
                            const sec = sub.section || '';
                            if (sec === 'PT A' || sec === 'OT A' || sec.includes('A') || sec.includes('2')) subAWorking = true;
                            else if (sec === 'PT B' || sec === 'OT B' || sec.includes('B') || sec.includes('3')) subBWorking = true;
                        }
                    });

                    if (stSubChiefWorking && (subAWorking || subBWorking)) {
                        subAWorking = true;
                        subBWorking = true;
                    }

                    if (!(subAWorking && subBWorking)) {
                        errors.push(`【${dateLabel}】係長・主任ともに不在ですが、副主任（Aチーム・Bチーム両方）が出勤していません（主任を1名以上、または副主任をA・B両方配置してください。同階ST役職者含む）。`);
                        scStaffFinal.forEach(sc => {
                            const scIdx = staffList.indexOf(sc);
                            if (scIdx >= 0) {
                                addConflict(scIdx, d, `⚠️ 役職不在エラー: ${dateLabel}は係長・主任が不在で、副主任(A・B両方)も不足しています（主任1名以上または副主任A・B両方を出勤させてください）`);
                            }
                        });
                    }
                }
            }
        }

        // 専従: PT・OT・STの専従はその階で3人以上出勤する制約
        if (!isST && !isLife) {
            let stFtWork = 0;
            if (options.stStaffData && options.stStaffData.staffList) {
                options.stStaffData.staffList.forEach((st, stIdx) => {
                    if (!st.isUnused && st.isFullTime) {
                        const stRow = (options.stStaffData.grid && options.stStaffData.grid[stIdx]) ? options.stStaffData.grid[stIdx] : (st.days || []);
                        const c = stRow[d] || { symbol: '' };
                        const sSym = (c && typeof c === 'object') ? c.symbol : (c || '');
                        if (isWorkSymbol(sSym) && sSym !== SYMBOLS.TRIP) stFtWork++;
                    }
                });
            }
            const totalFtWork = fullTimeWorkCount + stFtWork;
            const totalFloorFT = staffList.filter(s => !s.isUnused && s.isFullTime).length + (options.stFloorFtCount || (stFtWork > 0 ? 1 : 0));
            const reqFT = totalFloorFT >= 3 ? 3 : totalFloorFT;
            if (reqFT > 0 && totalFtWork < reqFT) {
                const reason = `${dateLabel}の専従合計出勤が${totalFtWork}名です（要件: ${reqFT}名以上）`;
                errors.push(`【${dateLabel}】「専従（PT・OT・ST合計）」スタッフの出勤が${totalFtWork}名しかいません（要件: ${reqFT}名以上、出張除く）。`);
                staffList.forEach((st, sIdx) => {
                    if (!st.isUnused && st.isFullTime) {
                        addConflict(sIdx, d, reason);
                    }
                });
            }

            // ★ 1年目制約（通常PO ＆ 南病棟特殊ルール）
            if (isSouth) {
                const s2Staff = [], s3Staff = [];
                staffList.forEach((st, sIdx) => {
                    if (st.isUnused) return;
                    if (getSouthSubFloor(st, sIdx) === '南2') s2Staff.push(sIdx);
                    else s3Staff.push(sIdx);
                });
                const s2Early = s2Staff.filter(s => getSym(s, d) === SYMBOLS.EARLY);
                const s3Early = s3Staff.filter(s => getSym(s, d) === SYMBOLS.EARLY);
                const s2Late  = s2Staff.filter(s => getSym(s, d) === SYMBOLS.LATE);
                const s3Late  = s3Staff.filter(s => getSym(s, d) === SYMBOLS.LATE);
                const s2Eve   = s2Staff.filter(s => getSym(s, d) === SYMBOLS.EVE);
                const s3Eve   = s3Staff.filter(s => getSym(s, d) === SYMBOLS.EVE);

                // 1. 早2人のうち1年目は1人まで
                const allEarlyFY = [...s2Early, ...s3Early].filter(s => staffList[s].isFirstYear);
                if (allEarlyFY.length > 1) {
                    errors.push(`【${dateLabel}】南病棟の早番のうち「1年目」が${allEarlyFY.length}名います（要件: 1名以下）。`);
                    allEarlyFY.forEach(s => addConflict(s, d, `${dateLabel}: 南病棟の早番で1年目が重複しています（上限1名）`));
                }
                // 2. 遅2人のうち1年目だけで2人OK（※エラー判定なし）
                // 3. E2人のうち1年目は1人まで
                const allEveFY = [...s2Eve, ...s3Eve].filter(s => staffList[s].isFirstYear);
                if (allEveFY.length > 1) {
                    errors.push(`【${dateLabel}】南病棟のE番のうち「1年目」が${allEveFY.length}名います（要件: 1名以下）。`);
                    allEveFY.forEach(s => addConflict(s, d, `${dateLabel}: 南病棟のE番で1年目が重複しています（上限1名）`));
                }
                // 4. 同じフロアの遅とE2人のうち1年目は1人まで
                const s2LateEveFY = [...s2Late, ...s2Eve].filter(s => staffList[s].isFirstYear);
                if (s2LateEveFY.length > 1) {
                    errors.push(`【${dateLabel}】南2の遅番・E番（計${s2Late.length + s2Eve.length}名）のうち「1年目」が${s2LateEveFY.length}名います（要件: 1名以下）。`);
                    s2LateEveFY.forEach(s => addConflict(s, d, `${dateLabel}: 南2の遅番・E番で1年目が重複しています（上限1名）`));
                }
                const s3LateEveFY = [...s3Late, ...s3Eve].filter(s => staffList[s].isFirstYear);
                if (s3LateEveFY.length > 1) {
                    errors.push(`【${dateLabel}】南3の遅番・E番（計${s3Late.length + s3Eve.length}名）のうち「1年目」が${s3LateEveFY.length}名います（要件: 1名以下）。`);
                    s3LateEveFY.forEach(s => addConflict(s, d, `${dateLabel}: 南3の遅番・E番で1年目が重複しています（上限1名）`));
                }
            } else {
                // 通常PO（特殊勤務カウントにハヤ・オソ・イブは含めない）
                const earlyStaff = [];
                const lateEveStaff = [];
                staffList.forEach((st, sIdx) => {
                    if (st.isUnused) return;
                    const sym = getSym(sIdx, d);
                    if (sym === SYMBOLS.EARLY) earlyStaff.push(sIdx);
                    if (sym === SYMBOLS.LATE || sym === SYMBOLS.EVE) lateEveStaff.push(sIdx);
                });
                const earlyFY = earlyStaff.filter(s => staffList[s].isFirstYear);
                if (earlyFY.length >= 2) {
                    errors.push(`【${dateLabel}】早番（早）スタッフのうち「1年目」が${earlyFY.length}名います（要件: 1名以下）。`);
                    earlyFY.forEach(s => addConflict(s, d, `${dateLabel}: 早番で1年目が重複しています（上限1名）`));
                }
                const lateEveFY = lateEveStaff.filter(s => staffList[s].isFirstYear);
                if (lateEveFY.length >= 2) {
                    errors.push(`【${dateLabel}】遅番・E番（遅・E）のうち「1年目」が${lateEveFY.length}名います（要件: 1名以下）。`);
                    lateEveFY.forEach(s => addConflict(s, d, `${dateLabel}: 遅番・E番で1年目が重複しています（上限1名）`));
                }
            }
        }

        // 特殊勤務人数チェック（早番3名, 遅番1名, E2名, 8時1名）
        if (isLife) {
            // ★ 生活期テーブル専用チェック: 平日は訪問8時が必ず1名（土日は0名）
            const di = dates && dates[d];
            const isWeekend = di ? (di.wIdx === 5 || di.wIdx === 6) : ((d % 7 === 5) || (d % 7 === 6));
            let h8Count = 0;
            staffList.forEach((st, sIdx) => {
                if (st.isUnused) return;
                const sym = getSym(sIdx, d);
                if (sym === SYMBOLS.H8) h8Count++;
            });
            if (isWeekend) {
                if (h8Count > 0) {
                    const reason = `${dateLabel}（土日）に訪問8時が${h8Count}名入っています（土日は不要）`;
                    errors.push(`【${dateLabel}】${reason}。`);
                    conflictCells.push({ dayIndex: d, footerStat: 'h8', reason });
                }
            } else {
                if (h8Count !== 1) {
                    const reason = `${dateLabel}の訪問8時が${h8Count}名です（要件: 1名）`;
                    errors.push(`【${dateLabel}】${reason}。`);
                    conflictCells.push({ dayIndex: d, footerStat: 'h8', reason });
                }
            }
        } else if (!isST) {
            if (isSouth) {
                // 南病棟の特殊勤務人数チェック: 早=南2に1名・南3に1名、遅=南2に1名・南3に1名、E=南2に1名・南3に1名
                const s2Staff = [], s3Staff = [];
                staffList.forEach((st, sIdx) => {
                    if (st.isUnused) return;
                    if (getSouthSubFloor(st, sIdx) === '南2') s2Staff.push(sIdx);
                    else s3Staff.push(sIdx);
                });
                const s2Early = s2Staff.filter(s => getSym(s, d) === SYMBOLS.EARLY).length;
                const s3Early = s3Staff.filter(s => getSym(s, d) === SYMBOLS.EARLY).length;
                const s2Late  = s2Staff.filter(s => getSym(s, d) === SYMBOLS.LATE).length;
                const s3Late  = s3Staff.filter(s => getSym(s, d) === SYMBOLS.LATE).length;
                const s2Eve   = s2Staff.filter(s => getSym(s, d) === SYMBOLS.EVE).length;
                const s3Eve   = s3Staff.filter(s => getSym(s, d) === SYMBOLS.EVE).length;

                let stEarlyCount = 0;
                const effectiveStData = options.stStaffData || options.linkedStStaffData;
                if (effectiveStData && effectiveStData.staffList) {
                    effectiveStData.staffList.forEach((st, stIdx) => {
                        if (!st.isUnused) {
                            const stRow = (effectiveStData.grid && effectiveStData.grid[stIdx]) ? effectiveStData.grid[stIdx] : (st.days || []);
                            const c = stRow[d] || { symbol: '' };
                            const sSym = (c && typeof c === 'object') ? c.symbol : (c || '');
                            if (sSym === SYMBOLS.EARLY) stEarlyCount++;
                        }
                    });
                }
                if (stEarlyCount > 1) {
                    const reason = `${dateLabel}の南病棟所属ST早番が${stEarlyCount}名です（同日2名は希望以外NG）`;
                    errors.push(`【${dateLabel}】${reason}。`);
                    conflictCells.push({ dayIndex: d, footerStat: 'early', reason: reason });
                }

                if (isFinal) {
                    // 早番チェック（南2に1名、南3に1名。ST早番は南2または南3どちらにカウントしてもOK。充当は最大1名で、もう一方はPOから必ず1名出す）
                    let earlyValid = false;
                    if (stEarlyCount === 0) {
                        earlyValid = (s2Early === 1 && s3Early === 1);
                    } else {
                        // ST早番が1名以上の場合: STをどちらかに充当し、もう一方にPOが1名
                        earlyValid = (s2Early === 1 && s3Early === 0) || (s2Early === 0 && s3Early === 1);
                    }
                    if (!earlyValid) {
                        const reason = `${dateLabel}の南病棟早番要件を満たしていません（南2に1名、南3に1名。ST早番含めて計2名。現況: 南2=${s2Early}名, 南3=${s3Early}名, ST=${stEarlyCount}名）`;
                        errors.push(`【${dateLabel}】${reason}。`);
                        conflictCells.push({ dayIndex: d, footerStat: 'early', reason: reason });
                    }
                    if (s2Late !== 1 || s3Late !== 1) {
                        const reason = `${dateLabel}の南病棟遅番要件を満たしていません（南2に1名、南3に1名。現況: 南2=${s2Late}名, 南3=${s3Late}名）`;
                        errors.push(`【${dateLabel}】${reason}。`);
                        conflictCells.push({ dayIndex: d, footerStat: 'late', reason: reason });
                    }
                    if (s2Eve !== 1 || s3Eve !== 1) {
                        const reason = `${dateLabel}の南病棟E番要件を満たしていません（南2に1名、南3に1名。現況: 南2=${s2Eve}名, 南3=${s3Eve}名）`;
                        errors.push(`【${dateLabel}】${reason}。`);
                        conflictCells.push({ dayIndex: d, footerStat: 'eve', reason: reason });
                    }
                } else {
                    // 修正作業エリア: これから特殊勤務を入れる段階なので、人数不足エラーは一切出さない（超過のみ検知）
                    if (s2Early > 1) {
                        const reason = `${dateLabel}の南2早番が${s2Early}名で定員超過です（上限: 1名）`;
                        errors.push(`【${dateLabel}】${reason}。`);
                        conflictCells.push({ dayIndex: d, footerStat: 'early', reason: reason });
                    }
                    if (s3Early > 1) {
                        const reason = `${dateLabel}の南3早番が${s3Early}名で定員超過です（上限: 1名）`;
                        errors.push(`【${dateLabel}】${reason}。`);
                        conflictCells.push({ dayIndex: d, footerStat: 'early', reason: reason });
                    }
                    if (s2Late > 1) {
                        const reason = `${dateLabel}の南2遅番が${s2Late}名で定員超過です（上限: 1名）`;
                        errors.push(`【${dateLabel}】${reason}。`);
                        conflictCells.push({ dayIndex: d, footerStat: 'late', reason: reason });
                    }
                    if (s3Late > 1) {
                        const reason = `${dateLabel}の南3遅番が${s3Late}名で定員超過です（上限: 1名）`;
                        errors.push(`【${dateLabel}】${reason}。`);
                        conflictCells.push({ dayIndex: d, footerStat: 'late', reason: reason });
                    }
                    if (s2Eve > 1) {
                        const reason = `${dateLabel}の南2E番が${s2Eve}名で定員超過です（上限: 1名）`;
                        errors.push(`【${dateLabel}】${reason}。`);
                        conflictCells.push({ dayIndex: d, footerStat: 'eve', reason: reason });
                    }
                    if (s3Eve > 1) {
                        const reason = `${dateLabel}の南3E番が${s3Eve}名で定員超過です（上限: 1名）`;
                        errors.push(`【${dateLabel}】${reason}。`);
                        conflictCells.push({ dayIndex: d, footerStat: 'eve', reason: reason });
                    }
                }
            } else {
                // 1階〜3階: PT+OT+ST合算で早3, 遅1, E2, 8時1
                let stEarlyCount = 0, stLateCount = 0, stEveCount = 0, stH8Count = 0;
                const effectiveStData = options.stStaffData || options.linkedStStaffData;
                if (effectiveStData && effectiveStData.staffList) {
                    effectiveStData.staffList.forEach((st, stIdx) => {
                        if (!st.isUnused) {
                            const stRow = (effectiveStData.grid && effectiveStData.grid[stIdx]) ? effectiveStData.grid[stIdx] : (st.days || []);
                            const c = stRow[d] || { symbol: '' };
                            const sSym = (c && typeof c === 'object') ? c.symbol : (c || '');
                            if (sSym === SYMBOLS.EARLY) stEarlyCount++;
                            if (sSym === SYMBOLS.LATE) stLateCount++;
                            if (sSym === SYMBOLS.EVE) stEveCount++;
                            if (sSym === SYMBOLS.H8) stH8Count++;
                        }
                    });
                }
                const totalEarly = earlyCount + stEarlyCount;
                const totalLate = lateCount + stLateCount;
                const totalEve = eveCount + stEveCount;
                const totalH8 = h8Count + stH8Count;

                if (isFinal) {
                    // 最終チェック＆完成: 完全充足を厳格チェック（ハヤ・オソ・イブはカウントしない）
                    if (totalEarly !== 3) {
                        const reason = `${dateLabel}の早番（早）が${totalEarly}名です（要件: 3名。PO:${earlyCount}名, ST:${stEarlyCount}名）`;
                        errors.push(`【${dateLabel}】${reason}。`);
                        conflictCells.push({ dayIndex: d, footerStat: 'early', reason: reason });
                    }
                    if (totalLate !== 1) {
                        const reason = `${dateLabel}の遅番（遅）が${totalLate}名です（要件: 1名。PO:${lateCount}名, ST:${stLateCount}名）`;
                        errors.push(`【${dateLabel}】${reason}。`);
                        conflictCells.push({ dayIndex: d, footerStat: 'late', reason: reason });
                    }
                    if (totalEve !== 2) {
                        const reason = `${dateLabel}のイブニング（E）が${totalEve}名です（要件: 2名。PO:${eveCount}名, ST:${stEveCount}名）`;
                        errors.push(`【${dateLabel}】${reason}。`);
                        conflictCells.push({ dayIndex: d, footerStat: 'eve', reason: reason });
                    }
                    if (totalH8 !== 1) {
                        const reason = `${dateLabel}の8時開始が${totalH8}名です（要件: 1名）`;
                        errors.push(`【${dateLabel}】${reason}。`);
                        conflictCells.push({ dayIndex: d, footerStat: 'h8', reason: reason });
                    }
                } else {
                    // 修正作業エリア: これから特殊勤務を入れる段階なので、人数不足エラーは一切出さない（超過のみ検知）
                    if (totalEarly > 3) {
                        const reason = `${dateLabel}の早番（早）が${totalEarly}名で定員超過です（要件: 3名。PO:${earlyCount}名, ST:${stEarlyCount}名）`;
                        errors.push(`【${dateLabel}】${reason}。`);
                        conflictCells.push({ dayIndex: d, footerStat: 'early', reason: reason });
                    }
                    if (totalLate > 1) {
                        const reason = `${dateLabel}の遅番（遅）が${totalLate}名で定員超過です（要件: 1名。PO:${lateCount}名, ST:${stLateCount}名）`;
                        errors.push(`【${dateLabel}】${reason}。`);
                        conflictCells.push({ dayIndex: d, footerStat: 'late', reason: reason });
                    }
                    if (totalEve > 2) {
                        const reason = `${dateLabel}のイブニング（E）が${totalEve}名で定員超過です（要件: 2名。PO:${eveCount}名, ST:${stEveCount}名）`;
                        errors.push(`【${dateLabel}】${reason}。`);
                        conflictCells.push({ dayIndex: d, footerStat: 'eve', reason: reason });
                    }
                    if (totalH8 > 1) {
                        const reason = `${dateLabel}の8時開始が${totalH8}名で定員超過です（要件: 1名）`;
                        errors.push(`【${dateLabel}】${reason}。`);
                        conflictCells.push({ dayIndex: d, footerStat: 'h8', reason: reason });
                    }
                }
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

    const obtainedHistory = options.obtainedHistory || {}; // staffId -> Set of symbols or Array (当タームより過去のターム取得履歴)
    const futureHistory = options.futureHistory || {};     // staffId -> Set of symbols or Array (当タームより未来のターム取得履歴)
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

        // 過去タームで既にこのグループの記号を取得済みの有効スタッフ数をカウント
        let alreadyObtainedInPast = 0;
        for (const sIdx of activeStaffIndices) {
            const st = staffList[sIdx];
            const history = obtainedHistory[st.id] || obtainedHistory[sIdx];
            const hasObtained = (history instanceof Set) ? history.has(grp.symbol) : (Array.isArray(history) && history.includes(grp.symbol));
            if (hasObtained) alreadyObtainedInPast++;
        }
        const remainingUnobtained = Math.max(0, activeStaffCount - alreadyObtainedInPast);

        // このタームに当該月の最終日（月末日）が含まれているか（＝その月のリフを消化する最終タームか）
        const isLastTermOfMonth = grp.dayIndices.some(dIdx => dates[dIdx] && dates[dIdx].day === grp.totalMonthDays);

        // ★ 目標人数の計算:
        // 1. 月末日を含まない前半ターム（例: 第3タームの6月分 上1、第4タームの7月分 上2、第9タームの12月分 下1）は日割り人数
        // 2. 月末日を含む後半ターム（例: 第4タームの6月分 上1、第5タームの7月分 上2、第10タームの12月分 下1）:
        //    - 前タームで既に一部が配分済み（alreadyObtainedInPast > 0）なら「残り全員（remainingUnobtained）」で前ターム＋当ターム＝45名を100%完全一致させる
        //    - 前タームが未作成・白紙（alreadyObtainedInPast === 0）のまま先に後半タームを開いた場合も、
        //      全45名を後半だけに詰め込まず「全45名 - 前ターム予定日割り人数」を目標値にすることで、
        //      同ターム内の別月リフ（例: 第4タームの 上1 と 上2）が両方確実に適正人数で付与されるようにする！
        const proportionalTarget = Math.min(
            remainingUnobtained,
            Math.round(activeStaffCount * (daysInTerm / grp.totalMonthDays))
        );
        const prevDaysInMonth = Math.max(0, grp.totalMonthDays - daysInTerm);
        const expectedPrevAssigned = Math.round(activeStaffCount * (prevDaysInMonth / grp.totalMonthDays));
        const fallbackLastTermTarget = Math.min(remainingUnobtained, Math.max(0, activeStaffCount - expectedPrevAssigned));

        const targetCount = isLastTermOfMonth
            ? ((alreadyObtainedInPast > 0 || daysInTerm >= grp.totalMonthDays) ? remainingUnobtained : fallbackLastTermTarget)
            : proportionalTarget;

        // 今タームで既に手動入力等でこのグループの記号を持っている人数
        let alreadyInTermForThisGroup = 0;
        const staffWithThisGroupInTerm = new Set();
        staffList.forEach((st, sIdx) => {
            if (st.isUnused) return;
            for (const d of grp.dayIndices) {
                if (st.days[d] === grp.symbol) {
                    alreadyInTermForThisGroup++;
                    staffWithThisGroupInTerm.add(sIdx);
                    break;
                }
            }
        });

        const needToAssign = Math.max(0, targetCount - alreadyInTermForThisGroup);

        // 候補スタッフの抽出
        const candidates = [];
        for (const sIdx of activeStaffIndices) {
            // 既に当タームでこの記号を持っているスタッフは除外
            if (staffWithThisGroupInTerm.has(sIdx)) continue;

            const st = staffList[sIdx];
            // 過去にこの記号を取得済みなら除外（二重取得防止！）
            const history = obtainedHistory[st.id] || obtainedHistory[sIdx];
            const hasObtained = (history instanceof Set) ? history.has(grp.symbol) : (Array.isArray(history) && history.includes(grp.symbol));
            if (hasObtained) continue;

            // 未来タームで既にこの記号が割り当てられているかチェック（ソートで未取得者を最優先にするため）
            const futHist = futureHistory[st.id] || futureHistory[sIdx];
            const hasInFuture = (futHist instanceof Set) ? futHist.has(grp.symbol) : (Array.isArray(futHist) && futHist.includes(grp.symbol));

            // 対象期間内に空欄セルがあるか（係長は土日休を確保するため平日の空欄セルを優先抽出）
            let freeDays = grp.dayIndices.filter(d => st.days[d] === '');
            // ★ 係長および土日固定休（生活期PatternA・土日休トグル等）は、土日の公休8日を侵食せず公休8日＋リフ1日を満額確保するため平日を優先抽出！
            const isSatSunOffStaff = st.isSectionChief || !!st.isSatSunOff || (st.lifeSection === '訪問' || st.lifeSection === '管理' || st.lifeSection === 'Cl1' || st.haSection === 'ハ1' || st.haSection === 'ハ2');
            if (isSatSunOffStaff) {
                const weekdayFreeDays = freeDays.filter(d => dates[d] && !dates[d].isSat && !dates[d].isSun);
                if (weekdayFreeDays.length > 0) {
                    freeDays = weekdayFreeDays;
                }
            }
            if (freeDays.length === 0) continue;

            candidates.push({
                sIdx,
                staff: st,
                freeDays,
                hasInFuture: hasInFuture ? 1 : 0
            });
        }

        // 候補者を並び替え:
        // 1. 未来タームでこの記号をまだ持っていない人を最優先（逆順でタームを開いた場合も重複を防止）
        // 2. 当ターム内で他のリフをまだ持っていない人を優先（1人1ターム1リフの原則を維持しつつ、2グループあるタームでも目標人数を100%確実に達成）
        // 3. 役職・専従・スケジュール管理属性の均等分散
        candidates.sort((a, b) => {
            if (a.hasInFuture !== b.hasInFuture) return a.hasInFuture - b.hasInFuture;
            const hasOtherRefA = staffWithRefInCurrentTerm.has(a.sIdx) ? 1 : 0;
            const hasOtherRefB = staffWithRefInCurrentTerm.has(b.sIdx) ? 1 : 0;
            if (hasOtherRefA !== hasOtherRefB) return hasOtherRefA - hasOtherRefB;
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

            // 当ターム内で既に別リフが入っている日があれば取得（近接配置を避けるため）
            const existingRefDays = [];
            for (let ed = 0; ed < dates.length; ed++) {
                const esym = st.days[ed];
                if (SYMBOLS.REF_SUMMER.includes(esym) || SYMBOLS.REF_WINTER.includes(esym)) {
                    existingRefDays.push(ed);
                }
            }

            // 最適日のスコアリング
            let bestDay = -1;
            let bestScore = -999999;

            for (const d of cand.freeDays) {
                let score = 100;

                // 1. 日別負荷平準化: すでにリフが入っている人数が多い日は減点
                score -= dailyRefCount[d] * 25;

                // 1.5 同ターム内で既に別リフがある場合は別週（7日以上離す）を強く優遇
                for (const erd of existingRefDays) {
                    if (Math.abs(d - erd) < 7) {
                        score -= 120;
                    }
                }

                // 2. 連休ボーナス: 前後が休日なら加点
                if (d - 1 >= 0 && isHolidaySymbol(st.days[d - 1])) score += 30;
                if (d + 1 < dates.length && isHolidaySymbol(st.days[d + 1])) score += 30;
                if (d - 2 >= 0 && isHolidaySymbol(st.days[d - 2]) && isHolidaySymbol(st.days[d - 1])) score += 15;
                if (d + 2 < dates.length && isHolidaySymbol(st.days[d + 1]) && isHolidaySymbol(st.days[d + 2])) score += 15;

                // 3. 土日祝日の適正分散（係長・土日固定休スタッフは土日公休と連休になる金曜・月曜等の平日を高評価）
                const dObj = dates[d];
                const isSatSunStaff = st.isSectionChief || !!st.isSatSunOff || (st.lifeSection === '訪問' || st.lifeSection === '管理' || st.lifeSection === 'Cl1' || st.haSection === 'ハ1' || st.haSection === 'ハ2');
                if (isSatSunStaff) {
                    if (!dObj.isSun && !dObj.isSat) score += 50;
                    if (dObj.wIdx === 0 || dObj.wIdx === 4) score += 35; // 月曜・金曜は土日と3連休になるため超優遇
                    if (dObj.isSun || dObj.isSat) score -= 200; // 土日は公休枠のためリフ配置を避ける
                } else if (dObj.isSun || dObj.isSat || dObj.isHol) {
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

