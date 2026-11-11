with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function validateScheduleGrid')
import re
matches = [m.start() for m in re.finditer(r'addConflict\(s, d', text[idx:idx+40000])]
print('addConflict(s, d) matches count:', len(matches))
for m_idx in matches:
    pos = idx + m_idx
    print('=== addConflict match ===')
    print(text[pos-100:pos+300])
