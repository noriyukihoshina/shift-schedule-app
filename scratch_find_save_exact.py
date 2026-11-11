import re

for fname in ['1f.html', '1階病棟.html', '2f.html', '3f.html', 'south.html', 'ST.html', 'life.html', '生活期.html']:
    try:
        with open(fname, 'r', encoding='utf-8') as f:
            text = f.read()
        for m in re.finditer(r'<button[^>]*>[\s\S]*?この期間を白紙化[\s\S]*?</button>', text):
            # 前後300文字を表示
            start = max(0, m.start() - 300)
            end = min(len(text), m.end() + 100)
            print(f"=== {fname} ===")
            print(text[start:end])
    except Exception as e:
        print(f"Error {fname}: {e}")
