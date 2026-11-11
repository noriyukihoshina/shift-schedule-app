import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('life.html', 'r', encoding='utf-8') as f:
    text = f.read()

print(text[:2000])
print("="*50)
print(text[-1500:])
