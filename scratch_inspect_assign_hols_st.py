with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('assignHolidaysForST() {')
print(text[idx+1200:idx+3500])
