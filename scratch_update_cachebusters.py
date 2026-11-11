import glob
import re
import time

ts = int(time.time())

html_files = [
    'index.html', 'master.html', '1f.html', '2f.html', '3f.html', 'south.html', 'life.html', 'ST.html',
    'マスターテーブル.html', '生活期.html', '生活期_管理者.html', '1階病棟.html', '2階病棟.html', '3階病棟.html', '南病棟.html'
]

for hf in html_files:
    try:
        with open(hf, 'r', encoding='utf-8') as f:
            content = f.read()
        
        content = re.sub(r'app\.js\?v=[^\s"\'<>]+', f'app.js?v={ts}', content)
        content = re.sub(r'style\.css\?v=[^\s"\'<>]+', f'style.css?v={ts}', content)
        
        with open(hf, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated cachebuster in {hf}")
    except Exception as e:
        print(f"Error {hf}: {e}")
