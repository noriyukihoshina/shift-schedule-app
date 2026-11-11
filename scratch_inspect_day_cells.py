import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'document.querySelectorAll(\'.day-cell\').forEach(cell => {' in l:
        print(f'Line {i+1}:')
        print(''.join(lines[i:i+40]))
        print('='*40)
