# -*- coding: utf-8 -*-
with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

t_loop = """                // 超過日 (realSum >= 2.75) と 不足日 (realSum <= 1.75) を優先ペアリング
                const highDays = dailyLoads.filter(x => x.realSum > minDayObj.realSum + 0.5).sort((a, b) => b.realSum - a.realSum);
                const lowDays = dailyLoads.filter(x => x.realSum < maxDayObj.realSum - 0.5).sort((a, b) => a.realSum - b.realSum);"""

r_loop = """                // 超過日 (実数2.5超: 3.5や3.0) と 不足日 (実数2.0以下: 1.5や2.0) を優先ペアリング
                const highDays = dailyLoads.filter(x => x.realSum > 2.5).sort((a, b) => b.realSum - a.realSum);
                const lowDays = dailyLoads.filter(x => x.realSum <= 2.0).sort((a, b) => a.realSum - b.realSum);"""

if t_loop in content:
    content = content.replace(t_loop, r_loop, 1)
    print("ST loop filter updated.")
else:
    print("Warning: t_loop not found!")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(content)
