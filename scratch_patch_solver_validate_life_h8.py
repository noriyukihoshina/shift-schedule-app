with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

target_old_special_skip = """        // 特殊勤務人数チェック（早番3名, 遅番1名, E2名, 8時1名）※POテーブルのみ！STテーブルおよび生活期はスキップ
        if (!isST && !isLife) {"""

target_new_special_skip = """        // 特殊勤務人数チェック（早番3名, 遅番1名, E2名, 8時1名）
        if (isLife) {
            // ★ 生活期テーブル専用チェック: 平日は訪問8時が必ず1名（土日は0名）
            const isWeekend = di ? (di.wIdx === 5 || di.wIdx === 6) : ((d % 7 === 5) || (d % 7 === 6));
            let h8Count = 0;
            staffList.forEach((st, sIdx) => {
                if (st.isUnused) return;
                const sym = getSym(sIdx, d);
                if (sym === SYMBOLS.H8) h8Count++;
            });
            if (isWeekend) {
                if (h8Count > 0) {
                    const reason = `${dateLabel}（土日）に訪問8時が${h8Count}名入っています（土日は不要）`;
                    errors.push(`【${dateLabel}】${reason}。`);
                    conflictCells.push({ dayIndex: d, footerStat: 'h8', reason });
                }
            } else {
                if (h8Count !== 1) {
                    const reason = `${dateLabel}の訪問8時が${h8Count}名です（要件: 1名）`;
                    errors.push(`【${dateLabel}】${reason}。`);
                    conflictCells.push({ dayIndex: d, footerStat: 'h8', reason });
                }
            }
        } else if (!isST) {"""

if target_old_special_skip in content:
    content = content.replace(target_old_special_skip, target_new_special_skip)
    print("Replaced life h8 validation in solver.js")
else:
    print("life h8 validation NOT found!")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated solver.js successfully!")
