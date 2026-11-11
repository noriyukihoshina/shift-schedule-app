# -*- coding: utf-8 -*-
with open('solver.js', 'r', encoding='utf-8') as f:
    code = f.read()

idx = code.find('if (candidates.length < needed)')
code_after = code[idx:]
code_after = code_after.replace("if (!is8ClockStaff && counts.total[s] >= 5) continue;", "if (!is8Staff && counts.total[s] >= 5) continue;")
code = code[:idx] + code_after

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Fixed fallback is8Staff.")
