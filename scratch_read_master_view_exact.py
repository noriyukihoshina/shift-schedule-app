with open('app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if 'function renderMasterIntegrationView' in line:
        for i in range(idx, min(idx + 60, len(lines))):
            print(f'{i+1}: {lines[i]}', end='')
        break
