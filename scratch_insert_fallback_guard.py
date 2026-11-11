# -*- coding: utf-8 -*-
with open('solver.js', 'r', encoding='utf-8') as f:
    code = f.read()

idx = code.find('if (candidates.length < needed)')
idx2 = code.find('if (this.staffList[s][req.noFlag]) continue;', idx)

insert_pos = idx2 + len('if (this.staffList[s][req.noFlag]) continue;')
guard_code = """
                        if (req.key === 'late' && counts.late[s] >= 1) continue;
                        const is8ClockStaff = !!this.staffList[s].can8;
                        if (is8ClockStaff && counts.total[s] >= 1) continue;
                        if (!is8ClockStaff && counts.total[s] >= 5) continue;
                        if (req.key === 'early' && counts.early[s] >= 3) continue;
                        if (req.key === 'eve' && counts.eve[s] >= 2) continue;"""

code = code[:insert_pos] + guard_code + code[insert_pos:]

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Inserted fallback guard successfully.")
