import sys
sys.stdout.reconfigure(encoding='utf-8')
import re

with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

for m in re.finditer(r'calculateStats\s*\([^)]*\)\s*\{', text):
    start = m.start()
    print("Match at:", start)
    print(text[start:start+1200])
    print('='*50)
