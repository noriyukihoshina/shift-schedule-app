with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('copyMode')
while idx != -1:
    print('--- copyMode at', idx)
    print(text[max(0, idx-50):min(len(text), idx+400)])
    idx = text.find('copyMode', idx+1)
