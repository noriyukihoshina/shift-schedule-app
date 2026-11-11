with open('index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print('index.html lines count:', len(lines))
for idx, line in enumerate(lines[:120]):
    print(f'{idx+1}: {line.strip()[:100]}')
