with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('balanceWorkforceForST()')
if pos != -1:
    print(text[pos:pos+2500])
