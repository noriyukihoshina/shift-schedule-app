# -*- coding: utf-8 -*-
with open('app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'function handleAssignSpecialDuties' in l:
        for j in range(i, min(i + 80, len(lines))):
            print(f'{j+1}: {lines[j].rstrip()}')
        break
