# -*- coding: utf-8 -*-
with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('initTermSelector()')
print(text[idx-50:idx+2500])
