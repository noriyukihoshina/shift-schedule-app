import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('assignSpecialDuties(options = {})')
print(text[pos:pos+1500])
