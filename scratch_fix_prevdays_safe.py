with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

target_old = "let pSym = staff.prevDays[p] || '';"
target_new = "let pSym = (staff.prevDays && staff.prevDays[p]) || '';"

content = content.replace(target_old, target_new)
with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated solver.js prevDays safe")
