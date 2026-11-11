import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'totalWorkAll' in l:
        print(f'Line {i+1}:')
        print(''.join(lines[max(0, i-80):min(len(lines), i+30)]))
        break
