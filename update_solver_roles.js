// update_solver_roles.js
const fs = require('fs');
const path = require('path');

const solverPath = path.join(__dirname, 'solver.js');
let code = fs.readFileSync(solverPath, 'utf8');

// CRLF正規化対応の置換ヘルパー
function replaceRegex(str, pattern, replacement) {
    if (!pattern.test(str)) {
        console.error('ERROR: Pattern not found:', pattern);
        process.exit(1);
    }
    return str.replace(pattern, replacement);
}

// 1. checkDailyAttributeSufficiency 内の役職チェック
const p1 = /const totalRole = staffList\.filter\(s => !s\.isUnused && s\.isRole\)\.length;\r?\n\s+if \(totalRole >= 2 && roleAvailable < 2\) \{\r?\n\s+errors\.push\(`【\$\{dayNum\}日目】「役職」スタッフの出勤可能人数が\$\{roleAvailable\}名しかおらず、必要数（2名以上）を満たせません（役職スタッフの希望休重複をご確認ください）。`\);\r?\n\s+\}/;

const r1 = `// 係長・主任・副主任の充足チェック
        const sectionChiefs = staffList.filter(s => !s.isUnused && s.isSectionChief);
        const chiefs = staffList.filter(s => !s.isUnused && s.isChief);
        const subChiefs = staffList.filter(s => !s.isUnused && s.isSubChief);

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
                        errors.push(\`【\${dayNum}日目】係長不在日ですが、主任の出勤可能者が0名です（主任を1名以上配置してください）。\`);
                        // ユーザー指示: 「係長の休みにのみお願い。カーソルを合わせたらエラーの内容を確認できる様に。」
                        sectionChiefs.forEach(sc => {
                            const scIdx = staffList.indexOf(sc);
                            if (scIdx >= 0) {
                                conflictCells.push({
                                    staffIndex: scIdx,
                                    dayIndex: d,
                                    reason: \`⚠️ 主任不在エラー: この日は係長が不在ですが、主任が出勤していません（主任を1名以上配置してください）\`
                                });
                            }
                        });
                    }
                }
            }
        }`;

code = replaceRegex(code, p1, r1);

// 2. canAssignBaseOff 内の保護
const p2 = /\/\/ 2\. 役職保護：当日dに出勤できる「役職」スタッフ（出張除く）を維持\r?\n\s+if \(staff\.isRole\) \{\r?\n[\s\S]*?if \(available < minKeep\) return false;\r?\n\s+\}/;

const r2 = `// 2. 係長・主任・副主任保護
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
        }`;

code = replaceRegex(code, p2, r2);

// 3. calculateStats 内の実数計算改修
const p3 = /const offset = \(this\.dayOffsets && this\.dayOffsets\[d\]\) \? this\.dayOffsets\[d\] : 0;\r?\n\s+const realWork = totalWork - offset;/;

const r3 = `// 実数合計の計算 (案B: 出勤実働 - 増員分。マイナス/減員時は実数変更なし)
            let realWorkBase = 0;
            for (let s = 0; s < this.numStaff; s++) {
                if (this.staffList[s].isUnused) continue;
                const sym = this.grid[s][d].symbol;
                let amt = 0;
                if (sym === SYMBOLS.EARLY || sym === SYMBOLS.LATE || sym === SYMBOLS.EVE || sym === SYMBOLS.H8 || sym === SYMBOLS.WORK || sym === SYMBOLS.TRIP) {
                    amt = 1.0;
                } else if (sym === SYMBOLS.HALF_WORK_OFF || sym === SYMBOLS.HALF_OFF_WORK || sym === SYMBOLS.HALF_WORK_PAID || sym === SYMBOLS.HALF_PAID_WORK) {
                    amt = 0.5;
                }
                if (amt > 0) {
                    const factor = this.staffList[s].isHalf ? 0.5 : 1.0;
                    realWorkBase += amt * factor;
                }
            }
            const offset = (this.dayOffsets && this.dayOffsets[d]) ? this.dayOffsets[d] : 0;
            const realWork = (offset > 0) ? Math.max(0, realWorkBase - offset) : realWorkBase;`;

code = replaceRegex(code, p3, r3);

// 4. verifyBaseScheduleFull および 最終制約チェックにおける係長・主任・副主任の判定
const p4 = /const totalRole = this\.staffList\.filter\(s => !s\.isUnused && s\.isRole\)\.length;\r?\n\s+if \(totalRole >= 2 && roleWorkCount < 2\) \{\r?\n\s+errors\.push\(`【\$\{dayNum\}日目】「役職」スタッフの出勤が\$\{roleWorkCount\}名しかいません（要件: 2名以上、出張除く）。`\);\r?\n\s+\}/;

const r4 = `// 係長平日出勤＆不在時主任出勤チェック
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
                        errors.push(\`【\${dayNum}日目】係長不在日ですが主任が出勤していません（主任を1名以上配置してください）。\`);
                    }
                }
            }`;

if (p4.test(code)) {
    code = code.replace(p4, r4);
}

// 5. checkFinalConstraints 内の役職チェック
const p5 = /\/\/ 役職: 2名以上（出張除く）\r?\n\s+const totalRole = staffList\.filter\(s => !s\.isUnused && s\.isRole\)\.length;\r?\n\s+if \(totalRole >= 2 && roleWorkCount < 2\) \{\r?\n\s+errors\.push\(`【\$\{dayNum\}日目】「役職」スタッフの出勤が\$\{roleWorkCount\}名しかいません（要件: 2名以上、出張除く）。`\);\r?\n\s+\}/;

const r5 = `// 係長平日出勤＆不在時主任出勤チェック
        const scStaffFinal = staffList.filter(s => !s.isUnused && s.isSectionChief);
        const chStaffFinal = staffList.filter(s => !s.isUnused && s.isChief);
        const curDFinal = (dates && dates[d]) ? dates[d] : null;
        const isWeekdayFinal = curDFinal ? (curDFinal.wIdx >= 0 && curDFinal.wIdx <= 4) : ((d % 7) >= 0 && (d % 7) <= 4);

        if (scStaffFinal.length > 0 && isWeekdayFinal) {
            let scWorking = false;
            scStaffFinal.forEach(sc => {
                const sym = grid[staffList.indexOf(sc)][d].symbol;
                if (!isHolidaySymbol(sym) && sym !== SYMBOLS.TRIP) scWorking = true;
            });
            if (!scWorking) {
                let chWorking = false;
                chStaffFinal.forEach(ch => {
                    const sym = grid[staffList.indexOf(ch)][d].symbol;
                    if (!isHolidaySymbol(sym) && sym !== SYMBOLS.TRIP) chWorking = true;
                });
                if (chStaffFinal.length > 0 && !chWorking) {
                    errors.push(\`【\${dayNum}日目】係長不在日ですが主任が出勤していません（主任を1名以上配置してください）。\`);
                }
            }
        }`;

if (p5.test(code)) {
    code = code.replace(p5, r5);
}

fs.writeFileSync(solverPath, code, 'utf8');
console.log('SUCCESS: solver.js has been updated successfully!');
