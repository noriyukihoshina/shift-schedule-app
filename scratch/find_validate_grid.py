import sys
sys.stdout.reconfigure(encoding='utf-8')

for fname in ['solver.js', 'app.js']:
    with open(fname, 'r', encoding='utf-8') as f:
        text = f.read()
    pos = text.find('validateScheduleGrid')
    if pos != -1:
        print(f"Found validateScheduleGrid in {fname} at {pos}")
        print(text[pos:pos+1500])
