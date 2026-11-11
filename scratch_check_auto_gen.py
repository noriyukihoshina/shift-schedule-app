import sys
sys.stdout.reconfigure(encoding='utf-8')
import re

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 勤務表自動生成ボタンのハンドラを検索
print("Auto generate button click handler in app.js:")
for m in re.finditer(r'assignSpecialDutiesToGrid|solveBtn|btnGenerate|generateBtn', text):
    start = max(0, m.start() - 40)
    end = min(len(text), m.start() + 100)
    print(text[start:end])
    print('---')
