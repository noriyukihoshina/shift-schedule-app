with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function validateScheduleGrid')
import re
matches = [m.start() for m in re.finditer(r'8時', text[idx:idx+40000])]
print('8時 matches count in validateScheduleGrid:', len(matches))
for m_idx in matches:
    pos = idx + m_idx
    print('=== validate 8時 match ===')
    print(text[pos-100:pos+300])
