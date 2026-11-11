with open('scratch_verify_all_4_issues.js', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace("getElementById: () => null,", "getElementById: () => null,\n        addEventListener: () => {},")
with open('scratch_verify_all_4_issues.js', 'w', encoding='utf-8') as f:
    f.write(c)
