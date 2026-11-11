with open('index.html', 'r', encoding='utf-8') as f:
    t_idx = f.read()

with open('master.html', 'r', encoding='utf-8') as f:
    t_mst = f.read()

print("index.html size:", len(t_idx))
print("master.html size:", len(t_mst))
print("Are they identical?", t_idx == t_mst)
