import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('solver.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'assign8ClockDuties(options' in l and 'const' in l:
        print(f'Called at line {i+1}:')
        print(''.join(lines[max(0, i-10):min(len(lines), i+15)]))
        break
