import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('SYSTEM_CONSTRAINTS_AND_REQUIREMENTS_MASTER.md', 'r', encoding='utf-8') as f:
    text = f.read()

# 4.2条と4.3条の該当部分
pos = text.find('### 4.2')
pos_end = text.find('### 4.4')
print(text[pos:pos_end])
