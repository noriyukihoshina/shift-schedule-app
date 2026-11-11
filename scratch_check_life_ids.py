import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('life.html', 'r', encoding='utf-8') as f:
    text = f.read()

print("Checking life.html body and elements:")
print("Length of life.html:", len(text))
# Check if inputTableHead, inputTableBody, etc. exist
for elem_id in ['inputTableHead', 'inputTableBody', 'outputTableHead', 'outputTableBody', 'solveBtn', 'masterTermSelect']:
    print(f"Contains id='{elem_id}':", elem_id in text)
