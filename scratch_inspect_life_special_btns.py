import re

for fname in ['life.html', '生活期.html', '生活期_管理者.html']:
    with open(fname, 'r', encoding='utf-8') as f:
        text = f.read()
    m = re.search(r'<button class="btn btn-success" id="outputAssignSpecialBtn"[\s\S]*?</button>', text)
    if m:
        print(f'=== {fname} ===')
        print(m.group(0))
    m2 = re.search(r'<button class="btn btn-success" id="forceAssignSpecialBtn"[\s\S]*?</button>', text)
    if m2:
        print(f'=== {fname} force ===')
        print(m2.group(0))
