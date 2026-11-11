import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('solver.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'counts.total[chosen]' in l or 'counts[req.key][chosen]' in l:
        print(f'Line {i+1}: {l.strip()[:100]}')
        print(''.join(lines[max(0, i-5):min(len(lines), i+15)]))
        break
