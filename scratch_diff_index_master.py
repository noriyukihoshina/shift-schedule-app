import difflib
with open('index.html', 'r', encoding='utf-8') as f:
    t_idx = f.readlines()

with open('master.html', 'r', encoding='utf-8') as f:
    t_mst = f.readlines()

diff = list(difflib.unified_diff(t_idx, t_mst, fromfile='index.html', tofile='master.html'))
for l in diff[:40]:
    print(l, end='')
