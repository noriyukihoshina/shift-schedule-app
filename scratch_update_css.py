import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('style.css', 'r', encoding='utf-8') as f:
    css = f.read()

# 備考欄の柔軟幅スタイル、出張文字のスタイル、公休8以外網掛けスタイル、コピペモード用スタイル
extra_css = """
/* ★ ユーザー指示: 画面の最右部の備考は記載の多い者にあわせて幅を広げる柔軟な対応 */
.remarks-cell,
th.remarks-header,
td.remarks-cell {
    min-width: 90px !important;
    max-width: 320px !important;
    white-space: normal !important;
    word-break: break-all !important;
}

/* ★ ユーザー指示: 「出」を「出張」に変更（枠に収まるようフォント調整） */
.cell-symbol-出張,
.day-cell[data-symbol="出張"],
.day-cell:contains("出張") {
    font-size: 11px !important;
    font-weight: 800 !important;
    letter-spacing: -1px !important;
    line-height: 1.1 !important;
    color: #4338ca !important;
}

/* ★ ユーザー指示: 公休が8以外のスタッフは網掛け */
.holiday-alert-cell {
    background: #e0f2fe !important;
    color: #0369a1 !important;
    font-weight: 800 !important;
    box-shadow: inset 0 0 0 2px #0284c7 !important;
    position: relative;
}
.holiday-alert-cell::after {
    content: "!";
    position: absolute;
    top: 1px;
    right: 2px;
    font-size: 9px;
    color: #0284c7;
    font-weight: 900;
}

/* ★ ユーザー指示: コピペモードの選択枠ハイライト */
.copy-selected-cell {
    outline: 3px solid #2563eb !important;
    outline-offset: -3px !important;
    background-color: #dbeafe !important;
    animation: pulse-copy 1.5s infinite;
}
@keyframes pulse-copy {
    0% { outline-color: #2563eb; }
    50% { outline-color: #93c5fd; }
    100% { outline-color: #2563eb; }
}

/* ★ ドラッグ＆ドロップ行並び替え用スタイル */
tr.dragging-row {
    opacity: 0.4;
    background: #e2e8f0 !important;
}
tr.drag-over-row {
    border-top: 3px solid #2563eb !important;
}
.drag-handle {
    cursor: grab;
    color: #94a3b8;
    user-select: none;
    font-size: 14px;
    margin-right: 4px;
}
.drag-handle:active {
    cursor: grabbing;
}

/* ★ STテーブル罫線統一: 最も太い横罫線＝スタッフの勤務と集計の間、中太横線＝階と階の間 */
.st-floor-divider {
    border-bottom: 2px solid #94a3b8 !important;
}
.st-summary-divider {
    border-top: 3.5px solid #1e293b !important;
}
"""

if "/* ★ ユーザー指示: 画面の最右部の備考は記載の多い者にあわせて幅を広げる柔軟な対応 */" not in css:
    css += extra_css
    with open('style.css', 'w', encoding='utf-8') as f:
        f.write(css)
    print("SUCCESS: Updated style.css with remarks flexible width, trip style, holiday alert, copy mode, and ST dividers.")
else:
    print("ALREADY UPDATED style.css")
