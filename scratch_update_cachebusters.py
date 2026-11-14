import glob, re, datetime

v = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
count = 0
for f in glob.glob('*.html'):
    with open(f, 'r', encoding='utf-8') as fp:
        c = fp.read()
    c = re.sub(r'solver\.js\?v=[^\s"\'<>]+', f'solver.js?v={v}', c)
    c = re.sub(r'app\.js\?v=[^\s"\'<>]+', f'app.js?v={v}', c)
    c = re.sub(r'style\.css\?v=[^\s"\'<>]+', f'style.css?v={v}', c)
    with open(f, 'w', encoding='utf-8') as fp:
        fp.write(c)
    count += 1
print(f'Updated cache busters in {count} html files to version {v}!')
