import sys
sys.stdout.reconfigure(encoding='utf-8')
import re

with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

for m in re.finditer(r'assignHolidays.*?\n\}', text, re.DOTALL):
    print(m.group(0)[:200])
    print('---')
