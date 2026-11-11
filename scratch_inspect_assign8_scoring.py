with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('assign8ClockDuties(options = {}) {')
print(text[idx+1800:idx+3800])
