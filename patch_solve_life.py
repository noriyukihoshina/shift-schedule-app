# -*- coding: utf-8 -*-
import sys

new_solve_life = '''    solveLife(options = {}) {
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

'''

with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

start_marker = '    solveLife(options = {}) {'
end_marker = '    /**\n     * 生活期（通所・訪問）の出勤実数厳格平準化\n     */'

start_idx = text.find(start_marker)
end_idx = text.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print('Error: markers not found!')
    sys.exit(1)

new_text = text[:start_idx] + new_solve_life + text[end_idx:]

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(new_text)

print('Successfully patched solveLife in solver.js!')
