import sys
sys.stdout.reconfigure(encoding='utf-8')
import re

with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

for m in re.finditer(r'function solveLifeSchedule|solveLifeSchedule|isLife', text):
    print(m.group(0), "at", m.start())
