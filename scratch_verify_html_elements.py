import re

for fname in ['index.html', 'master.html', 'マスターテーブル.html']:
    with open(fname, 'r', encoding='utf-8') as f:
        text = f.read()

    has_master_sel = 'id="masterTermSelect"' in text
    has_end_display = 'id="termEndDateDisplay"' in text
    has_label_badge = 'id="termLabelBadge"' in text
    has_days_badge = 'id="termDaysBadge"' in text

    print(f"{fname}:")
    print(f"  masterTermSelect: {has_master_sel}")
    print(f"  termEndDateDisplay: {has_end_display}")
    print(f"  termLabelBadge: {has_label_badge}")
    print(f"  termDaysBadge: {has_days_badge}")
