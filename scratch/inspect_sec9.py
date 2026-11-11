import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('SYSTEM_CONSTRAINTS_AND_REQUIREMENTS_MASTER.md', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('## 9.')
pos_end = text.find('## 10.')
print(text[pos:pos_end])
