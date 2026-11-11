import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'cloud.terms && typeof cloud.terms === \'object\'' in l:
        for j in range(max(0, i - 5), min(len(lines), i + 40)):
            print(f"{j+1}: {lines[j]}", end='')
        break
