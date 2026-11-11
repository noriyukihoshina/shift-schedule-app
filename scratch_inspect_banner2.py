import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('function applyOutputConflictHighlights')
print(text[pos+2200:pos+3500])
