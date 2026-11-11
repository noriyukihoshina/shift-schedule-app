# -*- coding: utf-8 -*-
with open('solver.js', 'r', encoding='utf-8') as f:
    code = f.read()

fallback_target = "if (this.staffList[s][req.noFlag]) continue;\n\n                        // 南病棟のフロア指定チェック"
fallback_guard = """if (this.staffList[s][req.noFlag]) continue;
                        if (req.key === 'late' && counts.late[s] >= 1) continue;
                        const is8ClockStaff = !!this.staffList[s].can8;
                        if (is8ClockStaff && counts.total[s] >= 1) continue;
                        if (!is8ClockStaff && counts.total[s] >= 5) continue;
                        if (req.key === 'early' && counts.early[s] >= 3) continue;
                        if (req.key === 'eve' && counts.eve[s] >= 2) continue;

                        // 南病棟のフロア指定チェック"""

if fallback_target in code:
    code = code.replace(fallback_target, fallback_guard, 1)
    print("Added guards to fallback loop in assignSpecialDuties")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(code)
