import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# '制約チェック結果' または '薄いブルーの網掛けセル' を検索
pos = text.find('制約チェック結果')
if pos != -1:
    print("Found '制約チェック結果' in app.js:")
    print(text[pos-100:pos+800])
else:
    print("'制約チェック結果' not found in app.js")

with open('solver.js', 'r', encoding='utf-8') as f:
    text2 = f.read()

pos2 = text2.find('早番')
print("Found '早番' in solver.js around:", pos2)
