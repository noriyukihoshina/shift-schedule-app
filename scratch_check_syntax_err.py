with open('app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(max(0, 5630), min(len(lines), 5655)):
    print(f'{i+1}: {lines[i]}', end='')
