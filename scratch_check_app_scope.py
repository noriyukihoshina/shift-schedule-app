import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 末尾にある initMasterTermSelect と copy_paste_full_code を探す
term_idx = text.find("// ★ ユーザー指示: マスターテーブルでもPOテーブルのようにタームを指定可能にする")
copy_idx = text.find("// ★ ユーザー指示: コピペモード（セル選択 Ctrl+C / Ctrl+V またはクリック貼付）")

print("term_idx:", term_idx, "copy_idx:", copy_idx)
print("text length:", len(text))

# DOMContentLoaded の閉じ括弧 }); を探す
# 末尾のコードを切り離し、DOMContentLoaded の閉じ括弧の直前に配置する
