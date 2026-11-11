# -*- coding: utf-8 -*-
import glob

# 1. HTMLファイルへのボタン追加
master_html_files = ['master.html', 'マスターテーブル.html', 'マスター統括.html']

btn_stats_html = """            <!-- ★ ユーザー指示: マスターテーブル平準化ダッシュボードの最上部に「平日出勤ブレ最少化」ボタンを常時大きく表示！ -->
            <div class="toolbar-card" style="margin-bottom: 1rem; background: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 8px; padding: 12px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 1.25rem;">⚖️</span>
                    <div>
                        <div style="font-weight: 800; color: #065f46; font-size: 0.95rem;">全フロア平日出勤ブレ最少化システム（マスター統括平準化）</div>
                        <div style="font-size: 0.8rem; color: #047857;">実務で発生する平日出勤人数・実数の上下ブレ（14.5名等）を、各階の制約（連勤・週休2日・特殊勤務翌日休）を守りながら自動スワップして最小化します</div>
                    </div>
                </div>
                <button class="btn btn-success" id="masterBalanceWeekdaysBtnStats" style="background: #059669; border-color: #047857; color: white; font-weight: 800; font-size: 0.92rem; padding: 8px 18px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(5,150,105,0.25); cursor: pointer;" title="全フロア合算の平日出勤実数ブレを各階の公休スワップで最小化（平準化）します">
                    ⚡ 平日出勤ブレを最少化
                </button>
            </div>
            <div class="stats-grid">"""

btn_check_html = """                        <button class="btn btn-success" id="masterBalanceWeekdaysBtn" style="background: #059669; border-color: #047857; color: white; font-weight: 700; font-size: 0.82rem; padding: 5px 12px; display: inline-flex; align-items: center; gap: 4px;" title="実務で発生する平日出勤人数・実数の上下ブレ（最大8.5名〜14.5名）を、各階の制約を守りながら各階の公休を自動微修正（スワップ）してブレ幅を最小化（平準化）します">
                            ⚡ 平日出勤ブレを最少化
                        </button>
                        <button class="btn btn-primary" id="checkCopyForExcelBtn\""""

for fn in master_html_files:
    try:
        with open(fn, 'r', encoding='utf-8') as f:
            html = f.read()

        # statsTab にボタンを追加
        if 'id="masterBalanceWeekdaysBtnStats"' not in html:
            if '<section id="statsTab" class="tab-panel">\n            <div class="stats-grid">' in html:
                html = html.replace('<section id="statsTab" class="tab-panel">\n            <div class="stats-grid">',
                                    '<section id="statsTab" class="tab-panel">\n' + btn_stats_html)
            elif '<section id="statsTab" class="tab-panel">' in html and '<div class="stats-grid">' in html:
                html = html.replace('<div class="stats-grid">', btn_stats_html, 1)

        # checkTab にボタンを追加
        if 'id="masterBalanceWeekdaysBtn"' not in html or 'id="checkCopyForExcelBtn"' in html:
            if '<button class="btn btn-primary" id="checkCopyForExcelBtn"' in html and 'id="masterBalanceWeekdaysBtn"' not in html.split('checkTab')[1]:
                html = html.replace('<button class="btn btn-primary" id="checkCopyForExcelBtn"', btn_check_html, 1)

        with open(fn, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f"Updated buttons in {fn}")
    except Exception as e:
        print(f"Error in {fn}:", e)

print("HTML buttons updated.")
