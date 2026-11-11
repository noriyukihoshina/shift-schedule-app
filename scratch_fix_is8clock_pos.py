# -*- coding: utf-8 -*-
with open('solver.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 誤った位置のコードを削除
err_code = """                    // ★ 遅番は全スタッフ「最大1回」絶対厳守！（事前入力等を含め既に遅番が1回あるスタッフは完全除外）
                    if (req.key === 'late' && counts.late[s] >= 1) continue;
                    // ★ 8時担当スタッフは特殊勤務合計（早・遅・E・8時）をちょうど2回に固定（早遅Eは最大1回）
                    if (is8ClockStaff && counts.total[s] >= 1) continue;
                    // ★ 一般スタッフ（8時なし）は特殊勤務合計（早・遅・E）最大5回（6回以上は完全除外）
                    if (!is8ClockStaff && counts.total[s] >= 5) continue;
"""

code = code.replace(err_code, "")

# 正しい位置（const is8ClockStaff の直後）に追加
target = "const is8ClockStaff = !!this.staffList[s].can8;"
replacement = """const is8ClockStaff = !!this.staffList[s].can8;
                    // ★ 遅番は全スタッフ「最大1回」絶対厳守！（事前入力等を含め既に遅番が1回あるスタッフは完全除外）
                    if (req.key === 'late' && counts.late[s] >= 1) continue;
                    // ★ 8時担当スタッフは特殊勤務合計（早・遅・E・8時）をちょうど2回に固定（早遅Eは最大1回）
                    if (is8ClockStaff && counts.total[s] >= 1) continue;
                    // ★ 一般スタッフ（8時なし）は特殊勤務合計（早・遅・E）最大5回（6回以上は完全除外）
                    if (!is8ClockStaff && counts.total[s] >= 5) continue;"""

code = code.replace(target, replacement, 1)

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(code)
print("Fixed is8ClockStaff positioning in solver.js")
