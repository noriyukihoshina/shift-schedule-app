import glob
import re

for fpath in glob.glob('*.html'):
    with open(fpath, 'r', encoding='utf-8', errors='ignore') as f:
        text = f.read()
    btns = re.findall(r'<button[^>]*id=[\'"]saveBtn[\'"][^>]*>[\s\S]*?</button>|<button[^>]*>[\s\S]*?💾[\s\S]*?保存[\s\S]*?</button>', text)
    if btns:
        print(f"{fpath}: found {len(btns)} save buttons")
        for b in btns:
            print("  ", b[:80])
