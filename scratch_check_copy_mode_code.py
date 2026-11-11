import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

pos = text.find('// ★ ユーザー指示: コピペモード（セル選択 Ctrl+C / Ctrl+V またはクリック貼付）')
print(text[pos:pos+1600])
