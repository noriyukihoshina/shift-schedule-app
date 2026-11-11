# -*- coding: utf-8 -*-
with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function renderMasterIntegrationView()')
idx2 = text.find('html +=', idx)
print(text[idx2:idx2+2500])
