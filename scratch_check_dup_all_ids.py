# -*- coding: utf-8 -*-
with open('master.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
for id_name in ['termEndDateDisplay', 'termTitleBadge', 'termDaysBadge', 'termSelect']:
    matches = [m.start() for m in re.finditer(f'id=["\']{id_name}["\']', text)]
    print(f"id='{id_name}' matches in master.html at: {matches}")
