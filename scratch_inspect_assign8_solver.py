with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('assign8ClockDuties(')
print(text[idx:idx+2500])
