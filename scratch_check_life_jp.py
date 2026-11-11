import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('生活期.html', 'r', encoding='utf-8') as f:
    text = f.read()

print("Checking 生活期.html header and config:")
print(text[:1000])
print("="*50)
print(text[-1000:])
