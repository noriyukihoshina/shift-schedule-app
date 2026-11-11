with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re
m = re.search(r'function renderMasterIntegrationView', text)
if m:
    idx = m.start()
    print('Found renderMasterIntegrationView at:', idx)
    print(text[idx:idx+800])
