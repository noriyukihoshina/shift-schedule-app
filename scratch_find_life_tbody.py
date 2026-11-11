with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('if (isLife) {')
while idx != -1:
    print('--- if (isLife) at', idx)
    print(text[max(0, idx-50):min(len(text), idx+400)])
    idx = text.find('if (isLife) {', idx+1)
