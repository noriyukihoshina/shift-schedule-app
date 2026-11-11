import sys, re
sys.stdout.reconfigure(encoding='utf-8')

with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('function validateScheduleGrid')
if pos != -1:
    body = text[pos:pos+15000]
    # '早' または '早番' または isFinal を探す
    matches = [m.start() for m in re.finditer(r'isFinal', body)]
    for m in matches:
        print("--- isFinal usage ---")
        print(body[max(0, m-50):min(len(body), m+300)])
