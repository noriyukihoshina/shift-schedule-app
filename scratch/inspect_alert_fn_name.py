import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(2750, 2818):
    if 'function ' in lines[i]:
        print(f"{i+1}: {lines[i]}", end='')
