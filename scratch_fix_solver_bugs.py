import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. 南病棟での assign8ClockDuties 呼び出しガード解除
old_call_guard = """        // ステップ1: 8時勤務（1名/日）を優先配置！（8時可フラグのある貴重なスタッフから均等に選出。南病棟は8時不要）
        if (!this.isSouth) {
            const h8Result = this.assign8ClockDuties(options);
            if (!h8Result.success && !force) {
                return h8Result;
            }
        }"""

new_call_guard = """        // ステップ1: 8時勤務（1名/日）を優先配置！（南病棟でも南2・南3から毎日1名均等に自動選出）
        if (!this.isST) {
            const h8Result = this.assign8ClockDuties(options);
            if (!h8Result.success && !force) {
                return h8Result;
            }
        }"""

if old_call_guard in text:
    text = text.replace(old_call_guard, new_call_guard)
    print("SUCCESS: Enabled assign8ClockDuties call for South table")
else:
    print("WARNING: old_call_guard not found directly, checking regex")
    import re
    text = re.sub(r'if\s*\(\s*!this\.isSouth\s*\)\s*\{\s*const h8Result = this\.assign8ClockDuties',
                  'if (!this.isST) {\n            const h8Result = this.assign8ClockDuties', text)

# 2. 係長免除（staff.isSectionChief && offDays >= 8.0）の完全撤廃
# Line 5104 付近: verifyAllHardConstraints
old_sc_pass1 = "const isStandardPass = (Math.abs(offDays - this.options.standardHolidays) < 0.01) || (staff.isSectionChief && offDays >= 8.0);"
new_sc_pass1 = "// ★ 係長も公休数は標準8日（standardHolidays）と完全一致が必須！\n            const isStandardPass = (Math.abs(offDays - this.options.standardHolidays) < 0.01);"

if old_sc_pass1 in text:
    text = text.replace(old_sc_pass1, new_sc_pass1)
    print("SUCCESS: Removed section chief holiday pass in verifyAllHardConstraints")

# Line 5575 付近: validateScheduleConstraints
old_sc_pass2 = "const isStandardPass = (Math.abs(offDays - standardHolidays) < 0.01) || (staff.isSectionChief && offDays >= 8.0);"
new_sc_pass2 = "// ★ 係長も公休数は標準8日（standardHolidays）と完全一致が必須！\n            const isStandardPass = (Math.abs(offDays - standardHolidays) < 0.01);"

if old_sc_pass2 in text:
    text = text.replace(old_sc_pass2, new_sc_pass2)
    print("SUCCESS: Removed section chief holiday pass in validateScheduleConstraints")

# 3. solveSectionChiefSchedule で公休日数が targetOff（8日）を絶対に超えないよう保証
old_sc_k_loop = "for (let k = neededOffCount; k <= Math.min(unfixedWeekdays.length, Math.max(neededOffCount + 2, weekendFixedWorkDays.length + 1)); k++) {"
new_sc_k_loop = """// ★ ユーザー指示: 公休が9日になるバグを根絶。追加平日公休数は neededOffCount（ちょうど8日になる数）に厳格固定！
        for (let k = neededOffCount; k <= neededOffCount; k++) {"""

if old_sc_k_loop in text:
    text = text.replace(old_sc_k_loop, new_sc_k_loop)
    print("SUCCESS: Restricted sc loop k to strictly neededOffCount to prevent 9 holidays")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("solver.js update complete.")
