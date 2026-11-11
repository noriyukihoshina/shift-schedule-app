with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('isLife')
while idx != -1:
    idx2 = text.find('renderOutputTable', max(0, idx-1000))
    if idx2 != -1 and idx2 < idx + 500:
        print('--- near renderOutputTable at', idx)
        print(text[idx-50:idx+300])
    idx = text.find('isLife', idx+1)
