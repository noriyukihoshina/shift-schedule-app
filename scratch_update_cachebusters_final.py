import glob, time, re

ts = int(time.time())
for fname in glob.glob('*.html'):
    with open(fname, 'r', encoding='utf-8') as f:
        content = f.read()
    new_content = re.sub(r'app\.js\?v=\d+', f'app.js?v={ts}', content)
    new_content = re.sub(r'solver\.js\?v=[^\"\'\s>]+', f'solver.js?v={ts}', new_content)
    new_content = re.sub(r'style\.css\?v=[^\"\'\s>]+', f'style.css?v={ts}', new_content)
    if new_content != content:
        with open(fname, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Updated cachebuster for {fname}')
