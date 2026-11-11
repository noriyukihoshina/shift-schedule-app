import sys
with open('app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for line_idx, line in enumerate(lines):
    if 'data-stat="off"' in line:
        print(f"Line {line_idx+1}: {line.strip()[:100]}")
        # 上に遡って関数を探す
        for up in range(line_idx, max(-1, line_idx-100), -1):
            if 'function ' in lines[up] or 'render' in lines[up] or 'const ' in lines[up] and '=>' in lines[up]:
                print(f"  Parent function near Line {up+1}: {lines[up].strip()[:80]}")
                break
