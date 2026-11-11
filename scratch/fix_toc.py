import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('SYSTEM_CONSTRAINTS_AND_REQUIREMENTS_MASTER.md', 'r', encoding='utf-8') as f:
    text = f.read()

# 目次の更新
text = text.replace(
    '- [4.2 特殊勤務の定数および配置規則（南病棟8時・南病棟早番完全独立含む）](#42-特殊勤務の定数および配置規則南病棟8時南病棟早番完全独立含む)',
    '- [4.2 特殊勤務の定数および配置規則（南病棟8時・特殊勤務ST+PO合算規則）](#42-特殊勤務の定数および配置規則南病棟8時特殊勤務stpo合算規則)'
)

with open('SYSTEM_CONSTRAINTS_AND_REQUIREMENTS_MASTER.md', 'w', encoding='utf-8') as f:
    f.write(text)

print("TOC verified and updated!")
