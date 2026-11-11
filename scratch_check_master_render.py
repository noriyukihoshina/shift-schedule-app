import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'renderMasterIntegrationView(' in l:
        print(f'Line {i+1}:')
        print(''.join(lines[i:i+30]))
        break
