with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function validateScheduleGrid')
idx2 = text.find('南病棟', idx)
if idx2 != -1:
    print(text[idx2-100:idx2+2500])
