import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('solver.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'balanceSpecialDuties()' in l:
        print(''.join(lines[i+85:i+160]))
        break
