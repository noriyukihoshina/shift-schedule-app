# -*- coding: utf-8 -*-
with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. ターム初期化時のキーと読み込み箇所
idx = text.find('currentWorkingStartDate')
print("currentWorkingStartDate occurrences:")
for i in range(5):
    if idx == -1: break
    print(f"--- at {idx} ---")
    print(text[max(0, idx-50):min(len(text), idx+150)])
    idx = text.find('currentWorkingStartDate', idx+1)
