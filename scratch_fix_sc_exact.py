import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('solver.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print("Line 5105:", lines[5104])
print("Line 5576:", lines[5575])

lines[5104] = "            const isStandardPass = (Math.abs(offDays - this.options.standardHolidays) < 0.01);\n"
lines[5575] = "            const isStandardPass = (Math.abs(offDays - standardHolidays) < 0.01);\n"

with open('solver.js', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("SUCCESS: Exact replacement done for section chief holiday exemption in solver.js")
