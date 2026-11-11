import sys
sys.stdout.reconfigure(encoding='utf-8')
import re

with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 関数定義
for m in re.finditer(r'assign8ClockDuties\s*\([^)]*\)\s*\{', text):
    start = m.start()
    print("Definition found at:", start)
    print(text[start:start+1800])
    print('='*50)
