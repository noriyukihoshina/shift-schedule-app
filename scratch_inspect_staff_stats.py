import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = 245478
print(text[pos+1000:pos+3000])
