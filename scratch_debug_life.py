import sys
sys.stdout.reconfigure(encoding='utf-8')
import re

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# isLife 関連のコードを検索
print("Searching for syntax or runtime issues in app.js...")
for m in re.finditer(r'isLife', text):
    start = max(0, m.start() - 50)
    end = min(len(text), m.start() + 100)
    # print snippet if suspicious
