with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('solveLife(')
import re
matches = [m.start() for m in re.finditer(r'8時|SYMBOLS\.H8', text[idx:idx+15000])]
print('8時 in solveLife matches count:', len(matches))
for m_idx in matches:
    pos = idx + m_idx
    print('=== match ===')
    print(text[pos-100:pos+300])
