import sys
sys.stdout.reconfigure(encoding='utf-8')
import re

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

for m in re.finditer(r'function\s+([a-zA-Z0-9_]*[sS][tT][a-zA-Z0-9_]*)\s*\(', text):
    print(m.group(0))
