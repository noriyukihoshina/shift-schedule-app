with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = [m.start() for m in re.finditer(r'setItem\(.*start_date|setItem\(.*CURRENT_TERM|setItem\(.*LAST_ACTIVE', text)]
print('setItem matches count:', len(matches))
for idx in matches:
    print(text[max(0, idx-50):min(len(text), idx+150)])
