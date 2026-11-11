with open('master.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'勤務表（最終チェック＆完成）', text)]
for idx in matches:
    print('=== title in master.html ===')
    print(text[max(0, idx-100):min(len(text), idx+100)])
