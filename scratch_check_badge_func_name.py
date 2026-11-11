# -*- coding: utf-8 -*-
with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = 169513
idx_func = text.rfind('function ', 0, idx)
print(text[idx_func:idx_func+300])
