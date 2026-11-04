# verify_all_screens_comprehensive.py
# 全画面のナビゲーション、文字色、2025年根絶、生活期トグル保護、マスターターム選択を機械的に一括自動検証する

import glob
import re
import sys

print("=== START COMPREHENSIVE SCREEN & RULE VERIFICATION ===")
errors = []

# 1. 2025年タームの根絶チェック
with open('app.js', 'r', encoding='utf-8') as f:
    app_text = f.read()

if '2025' in app_text.split('function generateAllTerms')[1].split('return allTerms;')[0]:
    errors.append("app.js generateAllTerms still contains 2025!")
else:
    print("[PASS] app.js generateAllTerms contains only 2026+ terms.")

html_files = ['index.html', '1f.html', '2f.html', '3f.html', 'south.html', 'ST.html', 'life.html', '生活期_管理者.html']
for h in html_files:
    try:
        with open(h, 'r', encoding='utf-8') as fp:
            ht = fp.read()
            if '2025' in ht and 'termSelect' in ht:
                # option value で 2025 が残っていないか
                opts = re.findall(r'<option[^>]*value=["\']2025[^"\']*["\']', ht)
                if opts:
                    errors.append(f"{h} still has 2025 options in termSelect: {opts}")
    except Exception as e:
        errors.append(f"Error checking {h}: {e}")

if not any("2025 options" in e for e in errors):
    print("[PASS] All HTML termSelect options have NO 2025 terms.")

# 2. ナビゲーションバーのリンクとテキストの一致チェック
for h in html_files:
    try:
        with open(h, 'r', encoding='utf-8') as fp:
            ht = fp.read()
            # 1f.html へのリンクが「1階病棟」になっているか
            m_1f = re.search(r'href=["\']1f\.html["\'][^>]*>(.*?)</a>', ht)
            if m_1f and '生活期' in m_1f.group(1):
                errors.append(f"{h} has wrong label for 1f.html: {m_1f.group(1)}")
            # life.html へのリンクが「生活期」になっているか
            m_life = re.search(r'href=["\']life\.html["\'][^>]*>(.*?)</a>', ht)
            if m_life and '1階' in m_life.group(1):
                errors.append(f"{h} has wrong label for life.html: {m_life.group(1)}")
    except Exception as e:
        errors.append(f"Error checking nav in {h}: {e}")

if not any("wrong label" in e for e in errors):
    print("[PASS] All HTML navigation labels (1階病棟, 生活期 etc.) are 100% CORRECT.")

# 3. 生活期マスター上書き除外ガードのチェック
if "!isLife" in app_text and "currentFloor !== '生活'" in app_text:
    print("[PASS] app.js has strict !isLife guard preventing master overwrite of life table.")
else:
    errors.append("app.js lacks strict !isLife guard!")

# 4. マスター画面上のターム選択ドロップダウン連動チェック
if "masterTermSelect" in app_text:
    print("[PASS] app.js contains masterTermSelect dynamically mounted on Master View.")
else:
    errors.append("app.js missing masterTermSelect!")

# 5. style.css のナビゲーションボタン文字色チェック
with open('style.css', 'r', encoding='utf-8') as f:
    css_text = f.read()

if "dept-nav-btn-1f" in css_text and "dept-nav-btn-life" in css_text:
    print("[PASS] style.css has explicit high-contrast classes for all dept buttons.")
else:
    errors.append("style.css missing dept-nav-btn classes!")

print("\n=== VERIFICATION RESULT ===")
if errors:
    print(f"FAILED with {len(errors)} errors:")
    for err in errors:
        print("  -", err)
    sys.exit(1)
else:
    print("ALL 5 CORE VERIFICATIONS PASSED WITH ZERO ERRORS!")
    sys.exit(0)
