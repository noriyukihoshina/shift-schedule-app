with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('// ★ 超過分がある場合（8日超過・9日バグの完全解消！）')
print(text[pos:pos+1500])
