import glob
import re

count = 0
for fpath in glob.glob('*.html'):
    try:
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()

        new_content = re.sub(r'<button[^>]*class="[^"]*manual-save-btn[^"]*"[^>]*>[\s\S]*?</button>', '', content)
        new_content = re.sub(r'<button[^>]*class=\'[^\']*manual-save-btn[^\']*\'[^>]*>[\s\S]*?</button>', '', new_content)

        if new_content != content:
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Removed manual-save-btn from {fpath}")
            count += 1
    except Exception as e:
        print(f"Error {fpath}: {e}")

print(f"Total files updated: {count}")
