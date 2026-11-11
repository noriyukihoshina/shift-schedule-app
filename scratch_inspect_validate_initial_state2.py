with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('validateInitialState pos in solver.js:')
idx = text.find('function validateInitialState(')
print(text[idx+3000:idx+6000])
