with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function validateInitialState(')
if idx == -1:
    idx = text.find('validateInitialState =')
print('validateInitialState pos in solver.js:', idx)
if idx != -1:
    print(text[idx:idx+3000])
