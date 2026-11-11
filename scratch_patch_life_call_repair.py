with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

target_old = """        // 6. 「休 ○ 休」（単発1勤）の撲滅リペア
        this.eliminateSingleDayWork();

        // 7. ★ 訪問8時の平日完全充足リペア（平日で8時が0名の日を100%根絶！）"""

target_new = """        // 6. 「休 ○ 休」（単発1勤）の撲滅リペア
        this.eliminateSingleDayWork();

        // ★ 生活期向けスマート自動リペア（連勤超過・週休不足・単発勤務の自動解消）
        this.repairScheduleViolations();

        // 7. ★ 訪問8時の平日完全充足リペア（平日で8時が0名の日を100%根絶！）"""

if target_old in content:
    content = content.replace(target_old, target_new)
    print("Added repairScheduleViolations to solveLife")
else:
    print("target NOT found!")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated solver.js")
