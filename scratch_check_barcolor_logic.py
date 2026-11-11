# -*- coding: utf-8 -*-
with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find("barColor = '#0ea5e9';")
print(text[idx-600:idx+200])
