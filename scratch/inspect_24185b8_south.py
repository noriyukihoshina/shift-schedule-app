import sys, re
sys.stdout.reconfigure(encoding='utf-8')

with open('solver.js', 'r', encoding='utf-8') as f:
    text = f.read()

# isSouth を含む箇所
pos_list = [m.start() for m in re.finditer(r'isSouth', text)]
print(f"Found {len(pos_list)} matches for isSouth")
for p in pos_list[:5]:
    print("--- snippet ---")
    print(text[p-50:p+300])
