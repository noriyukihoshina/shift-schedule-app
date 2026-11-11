with open('life.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
matches = re.findall(r'<button[^>]*assignSpecialDutiesBtn[^>]*>.*?</button>', text, re.DOTALL)
print('matches in life.html:', matches)

matches2 = re.findall(r'<button[^>]*forceAssignSpecialBtn[^>]*>.*?</button>', text, re.DOTALL)
print('forceAssign matches in life.html:', matches2)
