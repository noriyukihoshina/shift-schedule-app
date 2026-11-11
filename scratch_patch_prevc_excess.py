with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

target_old_excess_filter = """                        this.grid[s][d].symbol = SYMBOLS.WORK;
                        const valid = this.isStaffHardValid(s);
                        this.grid[s][d].symbol = SYMBOLS.OFF;
                        if (valid) {
                            cands.push({ d, offCount: dailyPatBOff[d] });
                        }"""

target_new_excess_filter = """                        // ★ 前ターム末からの連勤がある場合、前半（d <= 3）の公休を削ると6連勤になるため絶対除外！
                        let prevC = 0;
                        if (staff.prevDays) {
                            for (let p = 4; p >= 0; p--) {
                                if (isWorkSymbol(staff.prevDays[p])) prevC++;
                                else break;
                            }
                        }
                        if (prevC >= 2 && d <= 3) continue;

                        this.grid[s][d].symbol = SYMBOLS.WORK;
                        const valid = this.isStaffHardValid(s);
                        this.grid[s][d].symbol = SYMBOLS.OFF;
                        if (valid) {
                            cands.push({ d, offCount: dailyPatBOff[d] });
                        }"""

if target_old_excess_filter in content:
    content = content.replace(target_old_excess_filter, target_new_excess_filter)
    print("Added prevDays protection in excess holiday removal")
else:
    print("target NOT found!")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated solver.js")
