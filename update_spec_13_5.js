const fs = require('fs');
let content = fs.readFileSync('SYSTEM_CONSTRAINTS_AND_REQUIREMENTS_MASTER.md', 'utf8');

const additionalNotes = `
### 13.5 特殊勤務セル背景色の全テーブル・全モード完全統一仕様
「早」「遅」「E」の配置セルについて、以下の通り全テーブル（1階〜南、ST、生活期、マスターテーブル）および全モード（希望入力、修正作業エリア、最終チェック＆完成）で共通の背景色および文字色を完全強制適用する。
* **早番（早・ハヤ）**: 薄い黄色/アンバー背景（\`#fef08a\`）、濃いアンバー文字（\`#854d0e\`）。※事前固定希望枠は赤字（\`#dc2626\`）を保持。
* **遅番（遅）**: 薄いシアン/ターコイズ背景（\`#a5f3fc\`）、濃いシアンネイビー文字（\`#164e63\`）。※事前固定希望枠は赤字（\`#dc2626\`）を保持。
* **E（イブニング）**: 薄いピンク/マゼンタ背景（\`#fbcfe8\`）、濃いワインレッド文字（\`#831843\`）。※事前固定希望枠は赤字（\`#dc2626\`）を保持。
* **印刷時**: \`@media print\` においてすべてのセル背景色を除去し、白地・枠線・黒文字のみで印刷する。
* **休暇記号判定の厳格化**: \`isHolidaySymbol\`、\`isPaidHolidaySymbol\`、\`isRefreshHolidaySymbol\` を明確に分離し、有給休暇やリフレッシュ休暇が公休数に誤加算されることおよび未定義エラー（ReferenceError）の発生を恒久的に物理防止。
`;

if (!content.includes('13.5 特殊勤務セル背景色の全テーブル・全モード完全統一仕様')) {
    content = content.trim() + '\n' + additionalNotes;
    fs.writeFileSync('SYSTEM_CONSTRAINTS_AND_REQUIREMENTS_MASTER.md', content, 'utf8');
    console.log('Added 13.5 to SYSTEM_CONSTRAINTS_AND_REQUIREMENTS_MASTER.md');
} else {
    console.log('13.5 already present');
}
