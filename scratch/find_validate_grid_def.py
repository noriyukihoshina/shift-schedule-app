import sys, re
sys.stdout.reconfigure(encoding='utf-8')

for fname in ['solver.js', 'app.js']:
    with open(fname, 'r', encoding='utf-8') as f:
        text = f.read()
    m = re.search(r'function\s+validateScheduleGrid\s*\(', text)
    if m:
        pos = m.start()
        print(f"DEF in {fname} at {pos}:")
        print(text[pos:pos+1500])
