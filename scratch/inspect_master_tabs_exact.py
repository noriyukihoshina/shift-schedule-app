import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('master.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
pos = text.find('tab-container')
if pos != -1:
    print(text[pos:pos+1000])
