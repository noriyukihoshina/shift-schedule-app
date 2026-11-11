with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('isLife')
while idx != -1:
    print('--- isLife at', idx)
    print(text[max(0, idx-100):min(len(text), idx+300)])
    idx = text.find('isLife', idx+1)
