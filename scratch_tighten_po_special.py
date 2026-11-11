# -*- coding: utf-8 -*-
with open('solver.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. counts.total[s] >= 5 のペナルティをさらに強化（4〜5回を厳守）
old_penalty = """if (!is8ClockStaff && counts.total[s] >= 5) continue;"""
new_penalty = """// ★ 46名全員で1人あたり4〜5回を厳守！6回以上は完全禁止！
                    if (!is8ClockStaff && counts.total[s] >= 5) continue;
                    // 早番は最大2回（枠数不足時のみ一部3回許容）
                    if (req.key === 'early' && counts.early[s] >= 3) continue;
                    // Eは最大2回（原則1回、0回の人優先）
                    if (req.key === 'eve' && counts.eve[s] >= 2) continue;"""

if old_penalty in code:
    code = code.replace(old_penalty, new_penalty)
    print("Tightened PO special duty counts to strict 4-5 bounds")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(code)
