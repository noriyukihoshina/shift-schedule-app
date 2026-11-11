import sys
sys.stdout.reconfigure(encoding='utf-8')
import re

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 添付4のフッター階別集計エリアを検索
for m in re.finditer(r'1階.*?2階.*?3階', text, re.DOTALL):
    start = max(0, m.start() - 100)
    end = min(len(text), m.start() + 1500)
    print("Match found:")
    print(text[start:end])
    print('='*50)
