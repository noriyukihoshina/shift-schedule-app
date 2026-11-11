# -*- coding: utf-8 -*-
with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('STORAGE_KEY_LAST_ACTIVE')
print("STORAGE_KEY_LAST_ACTIVE occurrences:")
while idx != -1:
    print(f"--- at {idx} ---")
    print(text[max(0, idx-50):min(len(text), idx+200)])
    idx = text.find('STORAGE_KEY_LAST_ACTIVE', idx+1)
