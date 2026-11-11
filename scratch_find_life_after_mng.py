with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('// 2. 生活期業務（訪問・通所・Cl1・Cl2・管理: 択一）')
if idx != -1:
    print(text[idx:idx+2500])
