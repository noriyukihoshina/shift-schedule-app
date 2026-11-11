with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('validateScheduleGrid')
print('solver.js idx:', idx)
if idx != -1:
    print(text[idx:idx+2500])
