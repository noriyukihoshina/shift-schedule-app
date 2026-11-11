with open('style.css', 'r', encoding='utf-8') as f:
    text = f.read()

extra_css = '''
/* ★ 添付1: 4/28と出勤集計の間にはさらに太い線が必要 (4.5px極太線) */
.border-thickest-right {
    border-right: 4.5px solid #0f172a !important;
}
th[title="出勤日数"],
td.stat-work-col,
th.border-thick-left,
td.border-thick-left {
    border-left: 4.5px solid #0f172a !important;
}

/* ★ 添付4: マスターテーブル各フロア間の横境界線を最右端まで太線貫通 */
tr.floor-boundary-row th,
tr.floor-boundary-row td {
    border-top: 4px solid #334155 !important;
}
'''

text += extra_css

with open('style.css', 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated style.css successfully.")
