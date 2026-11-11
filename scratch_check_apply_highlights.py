import sys
sys.stdout.reconfigure(encoding='utf-8')
import re

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('function applyOutputConflictHighlights')
print(text[pos:pos+1500])
