with open('app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(5800, 5870):
    print(f'{i+1}: {lines[i]}', end='')
