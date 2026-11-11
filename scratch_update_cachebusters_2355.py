# -*- coding: utf-8 -*-
import glob
import re

html_files = glob.glob("*.html")
v_str = "20261111_2355"

for hf in html_files:
    with open(hf, "r", encoding="utf-8") as f:
        content = f.read()

    new_content = re.sub(r'app\.js\?v=[^"\'\s>]+', f'app.js?v={v_str}', content)
    new_content = re.sub(r'solver\.js\?v=[^"\'\s>]+', f'solver.js?v={v_str}', new_content)
    new_content = re.sub(r'style\.css\?v=[^"\'\s>]+', f'style.css?v={v_str}', new_content)

    if new_content != content:
        with open(hf, "w", encoding="utf-8") as f:
            f.write(new_content)

print("All HTML cachebusters updated to 20261111_2355.")
