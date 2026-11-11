import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

old_slow_limit = """                        const sLowLimit = is8(sLow) ? 2 : 5;
                        // 合計回数が上限未満のスタッフにのみ譲渡（8時担当者は最大2回で打ち止め）
                        if (counts.total[sLow] >= sLowLimit) continue;"""

new_slow_limit = """                        // ★ ユーザー指示: 8時担当スタッフは「全特殊勤務合計ちょうど2回固定」！一般スタッフは最大4回！
                        const isLow8 = counts.h8[sLow] > 0 || is8(sLow);
                        const sLowGrandTotal = counts.total[sLow] + counts.h8[sLow];
                        const sLowLimit = isLow8 ? 2 : 4;
                        if (sLowGrandTotal >= sLowLimit) continue;"""

if old_slow_limit in text:
    text = text.replace(old_slow_limit, new_slow_limit)
    print("SUCCESS: Strictly locked sLowLimit to grandTotal 2 for 8h staff and 4 for general staff")
else:
    print("WARNING: old_slow_limit not matched directly")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("solver.js updated successfully.")
