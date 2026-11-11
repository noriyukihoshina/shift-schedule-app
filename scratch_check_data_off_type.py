with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

print('data-off-type in app.js:', 'data-off-type' in text)
idx = text.find('data-off-type')
while idx != -1:
    print('--- at', idx, '---')
    print(text[max(0, idx-50):min(len(text), idx+200)])
    idx = text.find('data-off-type', idx+1)
