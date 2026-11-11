import sys
sys.stdout.reconfigure(encoding='utf-8')
import re

with open('life.html', 'r', encoding='utf-8') as f:
    life_html = f.read()

print("Checking life.html script tags and appConfig:")
for m in re.finditer(r'<script.*?</script>', life_html, re.DOTALL):
    print(m.group(0)[:300])
    print('---')
