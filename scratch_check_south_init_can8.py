import sys
sys.stdout.reconfigure(encoding='utf-8')
import re

with open('app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'can8' in l and '南' in ''.join(lines[max(0, i-25):i+5]):
        print(f'Line {i+1}: {l.strip()[:100]}')
