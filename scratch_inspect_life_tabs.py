import re

for fname in ['生活期.html', '生活期_管理者.html', 'life.html']:
    with open(fname, 'r', encoding='utf-8') as f:
        text = f.read()
    print(f'=== {fname} ===')
    for m in re.finditer(r'<button class="tab-btn', text):
        idx = m.start()
        print(text[idx:idx+150].replace('\n', ' '))
