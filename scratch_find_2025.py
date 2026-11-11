import glob

for fpath in glob.glob('*.html'):
    try:
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
        cnt = content.count('2025')
        if cnt > 0:
            print(f'{fpath}: contains 2025 (count: {cnt})')
    except Exception as e:
        pass
