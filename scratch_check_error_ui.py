import sys
sys.stdout.reconfigure(encoding='utf-8')
import re

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# エラー表示関連を検索
print("Searching error display in app.js:")
for m in re.finditer(r'function (checkWorkAreaConstraints|checkFinalConstraints|renderErrorBanner|showValidationModal)', text):
    start = m.start()
    print("Function:", m.group(1), "at", start)
    print(text[start:start+600])
    print('='*50)
