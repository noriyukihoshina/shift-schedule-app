with open('index.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('id="inputTab"')
idx2 = text.find('id="outputTab"')
input_tab_html = text[idx:idx2]
print('copy-mode in inputTab:', 'copy-mode' in input_tab_html or 'コピペ' in input_tab_html)
print(input_tab_html[:1500])
