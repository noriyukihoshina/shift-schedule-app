import re

# 1. HTMLファイルから 2025年度 の option を削除
import glob

html_files = glob.glob('*.html')
pattern = re.compile(r'\s*<option value="2026-0[123]-0[1236]">【2025年度.*?</option>\r?\n?', re.MULTILINE)

modified_htmls = []
for hf in html_files:
    try:
        with open(hf, 'r', encoding='utf-8') as f:
            content = f.read()
        if '2025年度' in content:
            new_content = pattern.sub('', content)
            if new_content != content:
                with open(hf, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                modified_htmls.append(hf)
    except Exception as e:
        print(f'Error processing {hf}: {e}')

print(f'Cleaned 2025 options from {len(modified_htmls)} files: {modified_htmls}')
