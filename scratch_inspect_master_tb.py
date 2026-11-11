import re

for fname in ['master.html', 'マスターテーブル.html', 'マスター統括.html']:
    with open(fname, 'r', encoding='utf-8') as f:
        text = f.read()
    pos = text.find('checkTab')
    if pos != -1:
        print(f'=== {fname} ===')
        pos_tb = text.find('toolbar-card', pos)
        if pos_tb != -1:
            print(text[pos_tb:pos_tb+800])
        else:
            print(text[pos:pos+500])
