# -*- coding: utf-8 -*-
with open('solver.js', 'r', encoding='utf-8') as f:
    content = f.read()

target_step2 = """        // ステップ2: 各フロア（1F, 2F, 3F, 南）ごとに公休日数（8日/8.5日）を均等配分（各階毎日2〜3名出勤、全社11〜12名出勤を数学的保証）
        this.assignHolidaysForST();

        // ステップ3: 特殊勤務「早」を各人3回ずつ割り当て"""

replacement_step2 = """        // ステップ2: 各フロア（1F, 2F, 3F, 南）ごとに公休日数（8日/8.5日）を均等配分（各階毎日2〜3名出勤、全社11〜12名出勤を数学的保証）
        this.assignHolidaysForST();

        // ステップ2.5: 早番配置前に各フロアの実数を事前平準化スワップ（1.5や3.0の極端な偏りを根絶）
        this.balanceWorkforceForST();

        // ステップ3: 特殊勤務「早」を各人3回ずつ割り当て"""

if target_step2 in content:
    content = content.replace(target_step2, replacement_step2, 1)
    print("Step 2.5 inserted successfully.")
else:
    print("Warning: target_step2 not found in solver.js!")

with open('solver.js', 'w', encoding='utf-8') as f:
    f.write(content)
