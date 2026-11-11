import sys
sys.stdout.reconfigure(encoding='utf-8')
import re

with open('app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'can8' in l and ('initStaffData' in ''.join(lines[max(0, i-30):i]) or 'defaultStaff' in ''.join(lines[max(0, i-30):i])):
        print(f'Line {i+1}: {l.strip()[:100]}')
