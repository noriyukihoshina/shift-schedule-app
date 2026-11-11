import sys
sys.stdout.reconfigure(encoding='utf-8')
import re

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

print("Checking app.js components:")
print("1. generateAllTerms year:", re.findall(r'const years = \[.*?\];', text))
print("2. thickCls count:", len(re.findall(r'const thickCls = \(\(d \+ 1\) % 7 === 0\)', text)))
print("3. ST table header/rows search:")
for m in re.finditer(r'.{0,40}所属 STスタッフ.{0,40}', text):
    print("   ", m.group(0))
for m in re.finditer(r'.{0,40}応援.*ハーフマン.{0,40}', text):
    print("   ", m.group(0))
