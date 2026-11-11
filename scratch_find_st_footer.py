import sys
sys.stdout.reconfigure(encoding='utf-8')
import re

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# STテーブルのフッター（階別集計: 1階, 2階, 3階, 南, 全階合計）を探す
for m in re.finditer(r'全階合計', text):
    start = max(0, m.start() - 300)
    end = min(len(text), m.start() + 1500)
    print("Match around 全階合計:")
    print(text[start:end])
    print('='*50)
