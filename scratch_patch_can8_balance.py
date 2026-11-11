# -*- coding: utf-8 -*-
with open('app.js', 'r', encoding='utf-8') as f:
    app_code = f.read()

target_can8 = "can8: (isSouth ? ((i >= 5 && i <= 9) || (i >= 27 && i <= 31)) : (i <= 9)),"
new_can8 = """can8: (isSouth 
                        ? ((i >= 5 && i <= 9) || (i >= 27 && i <= 31)) 
                        : ((i >= 2 && i <= 6) || (i >= 15 && i <= 19) || (i >= 28 && i <= 32) || (i >= 39 && i <= 43))), // ★ Aチーム(PT A/OT A)とBチーム(PT B/OT B)に同数均等配置"""

if target_can8 in app_code:
    app_code = app_code.replace(target_can8, new_can8)
    with open('app.js', 'w', encoding='utf-8') as f:
        f.write(app_code)
    print("Updated app.js can8 initialization")

# solver.js 内の assign8ClockDuties に、Bチーム can8 不足時の自動補正フォールバックを追加
with open('solver.js', 'r', encoding='utf-8') as f:
    solver_code = f.read()

assign8_top_target = "assign8ClockDuties(options = {}) {"
fallback_code = """assign8ClockDuties(options = {}) {
        // ★ PO病棟(1F, 2F, 3F)において、Bチームに can8 が不足している場合は自動でBチーム主要スタッフを can8 対象にしてA/B完全均等選出を保証！
        if (!this.isSouth && !this.isST && !this.isLife) {
            let bCan8Count = 0;
            for (let s = 0; s < this.numStaff; s++) {
                if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;
                const sec = this.staffList[s].section || '';
                if (sec.includes('B') && this.staffList[s].can8) bCan8Count++;
            }
            if (bCan8Count < 2) {
                for (let s = 0; s < this.numStaff; s++) {
                    if (this.staffList[s].isUnused || this.staffList[s].isSectionChief) continue;
                    const sec = this.staffList[s].section || '';
                    const id = this.staffList[s].id;
                    if (sec.includes('B') && ((id >= 15 && id <= 19) || (id >= 39 && id <= 43))) {
                        this.staffList[s].can8 = true;
                    }
                }
            }
        }
"""

if 'bCan8Count < 2' not in solver_code:
    solver_code = solver_code.replace(assign8_top_target, fallback_code)
    with open('solver.js', 'w', encoding='utf-8') as f:
        f.write(solver_code)
    print("Added B team can8 fallback to solver.js")
