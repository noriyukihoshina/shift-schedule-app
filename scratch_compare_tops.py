with open('1f.html', 'r', encoding='utf-8') as f:
    text_1f = f.read()

with open('master.html', 'r', encoding='utf-8') as f:
    text_master = f.read()

print("=== 1f.html top 120 lines ===")
lines_1f = text_1f.splitlines()[:120]
for i, l in enumerate(lines_1f):
    if 'tab' in l or 'nav' in l or 'term' in l or '期間' in l:
        print(f"{i}: {l}")

print("\n=== master.html top 120 lines ===")
lines_m = text_master.splitlines()[:120]
for i, l in enumerate(lines_m):
    if 'tab' in l or 'nav' in l or 'term' in l or '期間' in l:
        print(f"{i}: {l}")
