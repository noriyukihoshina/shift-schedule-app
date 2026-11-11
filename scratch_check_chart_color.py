# -*- coding: utf-8 -*-
with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('日別出勤人数（実数合計）グラフ')
if idx == -1:
    idx = text.find('日別出勤人数')
print(text[idx-100:idx+2500])
