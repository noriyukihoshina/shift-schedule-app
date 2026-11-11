import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('solver.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(3125, 3210):
    print(f'{i+1}: {lines[i]}', end='')
