with open('app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for line_idx, line in enumerate(lines):
    if 'offDays' in line:
        print(f"Line {line_idx+1}: {line.strip()[:110]}")
