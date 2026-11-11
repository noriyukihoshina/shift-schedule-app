import re

for fname in ['index.html', '1f.html', 'master.html', '生活期.html', 'st.html']:
    with open(fname, 'r', encoding='utf-8') as f:
        text = f.read()
    print(f'=== {fname} ===')
    for m in re.finditer(r'<nav[^>]*>[\s\S]*?</nav>', text):
        print(m.group(0)[:500])
    for m in re.finditer(r'href=[\'"][^\'"]*master[^\'"]*[\'"]|href=[\'"][^\'"]*[\'"]', text):
        if 'master' in m.group(0) or '生活' in m.group(0) or 'st' in m.group(0):
            print('  Link:', m.group(0))
