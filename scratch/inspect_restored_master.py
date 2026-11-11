with open('master.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
tabs = re.findall(r'<button class="tab-button.*?>.*?</button>', text)
print("Tabs in restored master.html:")
for t in tabs:
    print(" ", t)
