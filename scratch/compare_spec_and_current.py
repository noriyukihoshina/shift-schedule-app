import sys, re
sys.stdout.reconfigure(encoding='utf-8')

# 現在の solver.js と app.js を確認
with open('solver.js', 'r', encoding='utf-8') as f:
    solver_code = f.read()

with open('app.js', 'r', encoding='utf-8') as f:
    app_code = f.read()

print("=== 1. ST 関連 ===")
print("has solveST:", 'solveST' in solver_code)
print("has assignEarlyDutiesForST:", 'assignEarlyDutiesForST' in solver_code)
print("has assignHolidaysForST:", 'assignHolidaysForST' in solver_code)
print("has solveBaseSchedule assignSpecial: false check:", 'assignSpecial: false' in solver_code or 'options.assignSpecial' in solver_code)

print("\n=== 2. 南病棟 関連 ===")
m_south8 = re.findall(r'isSouth.*?8時', solver_code)
print("south 8h snippets:", len(m_south8))
print("has poNeedEarlyTotal:", 'poNeedEarlyTotal' in solver_code)

print("\n=== 3. マスターテーブル 関連 ===")
print("master.html tabs in app.js:", 'checkTab' in app_code, 'statsTab' in app_code, 'inputTab' in app_code)

print("\n=== 4. 生活期 関連 ===")
print("has BUILTIN_PRESET_MASTERS:", 'BUILTIN_PRESET_MASTERS' in app_code)
print("has isDefaultLifeManage:", 'isDefaultLifeManage' in app_code)
