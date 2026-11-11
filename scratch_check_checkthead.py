# -*- coding: utf-8 -*-
with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function renderMasterIntegrationView()')
idx2 = text.find('checkThead.innerHTML =', idx)
if idx2 != -1:
    print(text[idx2-200:idx2+1500])
else:
    print("checkThead.innerHTML not found directly")
