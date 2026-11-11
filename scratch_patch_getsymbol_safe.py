# -*- coding: utf-8 -*-
with open('solver.js', 'r', encoding='utf-8') as f:
    code = f.read()

target = "return this.staffList[s].prevDays[pIdx] || '';"
replacement = "return (this.staffList[s].prevDays && this.staffList[s].prevDays[pIdx]) ? this.staffList[s].prevDays[pIdx] : '';"

if target in code:
    code = code.replace(target, replacement)
    print("Safeguarded getSymbol for prevDays")
    with open('solver.js', 'w', encoding='utf-8') as f:
        f.write(code)
