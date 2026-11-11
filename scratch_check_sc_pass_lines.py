import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('solver.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'isSectionChief && offDays' in l:
        print(f'Line {i+1}: {l.strip()[:100]}')
