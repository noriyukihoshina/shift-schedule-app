# -*- coding: utf-8 -*-
with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('lifeHaDataMap')
while idx != -1:
    print(f"--- at {idx} ---")
    print(text[max(0, idx-100):min(len(text), idx+300)])
    idx = text.find('lifeHaDataMap', idx+1)
