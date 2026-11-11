with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('let score =')
while idx != -1:
    print('--- score at', idx)
    print(text[max(0, idx-50):min(len(text), idx+400)])
    idx = text.find('let score =', idx+1)
