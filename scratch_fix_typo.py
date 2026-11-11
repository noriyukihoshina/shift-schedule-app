# -*- coding: utf-8 -*-
with open('solver.js', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace("if (!is8Staff && counts.total[s] >= 5) continue;", "if (!is8ClockStaff && counts.total[s] >= 5) continue;")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Fixed is8Staff typo.")
