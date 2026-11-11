import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if '修正作業エリア: 制約の指摘・エラー検知' in l:
        start = max(0, i - 40)
        for j in range(start, min(len(lines), i + 40)):
            print(f"{j+1}: {lines[j]}", end='')
        break
