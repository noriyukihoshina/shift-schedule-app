import glob
import re

for fpath in ['index.html', 'master.html', '1f.html', '2f.html', '3f.html', 'south.html', 'life.html', 'ST.html']:
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    if 'dailyWorkChart' in content:
        idx = content.find('dailyWorkChart')
        print(f'=== {fpath} dailyWorkChart ===')
        print(content[idx:idx+400])
