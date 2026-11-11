with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function validateScheduleGrid')
idx2 = text.find('南病棟', idx + 1000)
idx3 = text.find('南病棟', idx2 + 100)
if idx3 != -1:
    print(text[idx3-100:idx3+2500])
