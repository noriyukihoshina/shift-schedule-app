with open('master.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
m = re.search(r'<nav class=[\'"]tab-nav[\'"].*?</nav>', text, re.DOTALL)
if m:
    print(m.group(0))
else:
    print('No tab-nav found')
