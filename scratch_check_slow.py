import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('solver.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'sLow' in l and 'balanceSpecialDuties' in ''.join(lines[max(0, i-50):i]):
        print(f'{i+1}: {l.strip()[:100]}')
