import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('SYSTEM_CONSTRAINTS_AND_REQUIREMENTS_MASTER.md', 'r', encoding='utf-8') as f:
    text = f.read()

lines = text.split('\n')
print(f"Total lines in master doc: {len(lines)}")
# 主要見出しの抽出
for i, l in enumerate(lines):
    if l.startswith('#'):
        print(f"L{i+1}: {l}")
