with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

target_old_span_fill = """                // 週休2日（日曜日休＋平日休1日）を満たす
                if (weekOffCount < 2) {"""

target_new_span_fill = """                // 週休2日（日曜日休＋平日休1日）を満たす。第1週で前タームから連勤が続く場合は水〜土に必ず平日公休を1日配置！
                let needOffInWeek = 2;
                if (w === 0 && staff.prevDays) {
                    let prevC = 0;
                    for (let p = 4; p >= 0; p--) {
                        if (isWorkSymbol(staff.prevDays[p])) prevC++;
                        else break;
                    }
                    // 前ターム末から2連勤以上ある場合、第1週の日曜休に加えて水〜土に公休が必須
                    if (prevC >= 2) {
                        let hasMidOff = false;
                        for (const d of wSpan) {
                            const di = dates[d];
                            if (di && di.wIdx !== 6 && isHolidaySymbol(this.grid[s][d].symbol)) hasMidOff = true;
                        }
                        if (!hasMidOff) needOffInWeek = 3; // 日曜休＋平日休を確実に選出
                    }
                }
                if (weekOffCount < needOffInWeek) {"""

if target_old_span_fill in content:
    content = content.replace(target_old_span_fill, target_new_span_fill)
    print("Replaced weekOffCount condition")
else:
    print("target NOT found!")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated solver.js")
