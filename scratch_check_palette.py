import sys
sys.stdout.reconfigure(encoding='utf-8')
import re

with open('1f.html', 'r', encoding='utf-8') as f:
    text = f.read()

for m in re.finditer(r'<div class="[^"]*palette[^"]*"(.*?)</div>\s*</div>', text, re.DOTALL):
    print(m.group(0)[:600])
    print('='*40)
