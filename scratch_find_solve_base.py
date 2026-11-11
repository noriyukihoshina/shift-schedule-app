import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('solveBaseSchedule')
if idx != -1:
    print(text[idx:idx+3500])
