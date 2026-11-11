import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = 71310
print(text[pos-100:pos+2500])
