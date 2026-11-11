with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('// ★ 生活期テーブル専用チェック: 平日は訪問8時が必ず1名（土日は0名）')
print(text[pos-200:pos+500])
