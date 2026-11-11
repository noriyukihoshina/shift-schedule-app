import glob

for fpath in glob.glob('*.html'):
    with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
        text = f.read()
    if '2025' in text:
        # option 内の 2025 をカウント
        import re
        opts = re.findall(r'<option[^>]*2025[^>]*>[\s\S]*?</option>', text)
        print(f'{fpath}: {len(opts)} options with 2025')
