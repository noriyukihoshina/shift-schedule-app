with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

target_old = """        if (isLife) {
            // ★ 生活期テーブル専用チェック: 平日は訪問8時が必ず1名（土日は0名）
            const isWeekend = di ? (di.wIdx === 5 || di.wIdx === 6) : ((d % 7 === 5) || (d % 7 === 6));"""

target_new = """        if (isLife) {
            // ★ 生活期テーブル専用チェック: 平日は訪問8時が必ず1名（土日は0名）
            const di = dates && dates[d];
            const isWeekend = di ? (di.wIdx === 5 || di.wIdx === 6) : ((d % 7 === 5) || (d % 7 === 6));"""

if target_old in content:
    content = content.replace(target_old, target_new)
    print("Fixed di in validateScheduleGrid")
else:
    print("target not found!")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated solver.js")
