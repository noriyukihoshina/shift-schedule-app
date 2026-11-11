import sys
sys.stdout.reconfigure(encoding='utf-8')
import re

with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

print("Checking assign8ClockDuties calls in solver.js:")
for m in re.finditer(r'.{0,50}assign8ClockDuties.{0,50}', text):
    print(m.group(0))
