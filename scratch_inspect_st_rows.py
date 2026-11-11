import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(4600, 4675):
    if i < len(lines):
        print(f'{i+1}: {lines[i]}', end='')
