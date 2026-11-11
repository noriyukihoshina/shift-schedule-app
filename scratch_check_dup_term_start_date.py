# -*- coding: utf-8 -*-
with open('master.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'id=["\']termStartDate["\']', text)]
print("id='termStartDate' matches in master.html at:", matches)
for m in matches:
    print(text[m-30:m+80])
