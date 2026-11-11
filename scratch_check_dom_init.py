# -*- coding: utf-8 -*-
with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('document.addEventListener(\'DOMContentLoaded\'')
if idx == -1:
    idx = text.find('addEventListener(\'DOMContentLoaded\'')
print(text[idx:idx+2000])
