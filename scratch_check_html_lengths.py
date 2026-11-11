import sys
sys.stdout.reconfigure(encoding='utf-8')
import os

for f in ['life.html', '生活期.html', '生活期_管理者.html', '1f.html']:
    if os.path.exists(f):
        with open(f, 'r', encoding='utf-8') as fp:
            c = fp.read()
            print(f"{f}: len={len(c)}, has inputTableBody={'inputTableBody' in c}")
