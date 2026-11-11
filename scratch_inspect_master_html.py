import re

with open('master.html', 'r', encoding='utf-8') as f:
    text = f.read()

print('master.html length:', len(text))
for m in re.finditer(r'<select[^>]*>', text, re.IGNORECASE):
    print(m.group(0))

for m in re.finditer(r'<script[^>]*src=[\'"]([^\'"]+)[\'"]', text, re.IGNORECASE):
    print('Script src:', m.group(1))

# term selectの記述を探す
print('--- Occurrences of term in master.html ---')
for line_idx, line in enumerate(text.splitlines()):
    if 'term' in line.lower() or 'ターム' in line:
        print(f'Line {line_idx+1}: {line.strip()[:100]}')
