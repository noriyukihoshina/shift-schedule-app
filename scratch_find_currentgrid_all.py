import glob

for fname in glob.glob('*.js'):
    if fname == 'app.js': continue
    with open(fname, 'r', encoding='utf-8') as f:
        text = f.read()
    if 'currentGrid' in text:
        print(f'Found in {fname}!')
