import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('style.css', 'r', encoding='utf-8') as f:
    text = f.read()

old_h_alert = """.holiday-alert-cell {
    background: #e0f2fe !important;
    color: #0369a1 !important;
    font-weight: 800 !important;
    box-shadow: inset 0 0 0 2px #0284c7 !important;
    position: relative;
}"""

new_h_alert = """.holiday-alert-cell {
    background: #e0f2fe !important;
    background-color: #e0f2fe !important;
    color: #0369a1 !important;
    font-weight: 800 !important;
    box-shadow: inset 0 0 0 2px #0284c7 !important;
    position: relative;
}"""

text = text.replace(old_h_alert, new_h_alert)

with open('style.css', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS: style.css updated!")
