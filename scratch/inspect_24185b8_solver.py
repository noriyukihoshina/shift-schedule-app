import sys, re
sys.stdout.reconfigure(encoding='utf-8')

with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. solveST の中身
m = re.search(r'solveST\(options = \{\}\)\s*\{.*?return \{', text, re.DOTALL)
if m:
    print("=== solveST in 24185b8 ===")
    print(m.group(0))

# 2. assignEarlyDutiesForST の中身
m2 = re.search(r'assignEarlyDutiesForST\(.*?\)\s*\{.*?^\s*\}', text, re.DOTALL | re.MULTILINE)
if m2:
    print("=== assignEarlyDutiesForST in 24185b8 ===")
    print(m2.group(0)[:1000])

# 3. 南病棟の特殊勤務 (assignSpecialDuties または assignSpecialDutiesToGrid)
m3 = re.search(r'assignSpecialDutiesToGrid\(.*?\)\s*\{.*?^\s*\}', text, re.DOTALL | re.MULTILINE)
if m3:
    print("=== assignSpecialDutiesToGrid in 24185b8 ===")
    print(m3.group(0)[:1000])
