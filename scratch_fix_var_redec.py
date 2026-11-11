# -*- coding: utf-8 -*-
with open('solver.js', 'r', encoding='utf-8') as f:
    code = f.read()

target = "const is8ClockStaff = !!this.staffList[s].can8;\n                        if (is8ClockStaff && counts.total[s] >= 1) continue;"
replacement = "const is8Staff = !!this.staffList[s].can8;\n                        if (is8Staff && counts.total[s] >= 1) continue;"

code = code.replace(target, replacement)

# その下の is8ClockStaff の再宣言も is8Staff に統一するか確認
code = code.replace("if (!is8ClockStaff && counts.total[s] >= 5) continue;", "if (!is8Staff && counts.total[s] >= 5) continue;")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Fixed variable re-declaration.")
