import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('生活期.html', 'r', encoding='utf-8') as f:
    life_good = f.read()

with open('life.html', 'w', encoding='utf-8') as f:
    f.write(life_good)

print("SUCCESS: Synced full HTML structure from 生活期.html to life.html")
print("Length of new life.html:", len(life_good))
