with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('Can8 >= 1 && can8Available < 1')
print(text[idx-200:idx+800])
