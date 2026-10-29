const fs = require('fs');
const path = require('path');

const dir = 'c:\\Users\\coffe\\OneDrive\\デスクトップ\\Antigravity\\勤務表作成';

// 1. life.html 生成
const content1f = fs.readFileSync(path.join(dir, '1f.html'), 'utf8');
let lifeHtml = content1f
    .replace('勤務予定表 自動作成システム - 1階病棟', '勤務予定表 自動作成システム - 生活期')
    .replace('勤務予定表 自動作成システム 〜 1階病棟 〜', '勤務予定表 自動作成システム 〜 生活期 〜')
    .replace('class="theme-1f"', 'class="theme-life"')
    .replace(/deptId:\s*'1f'/, "deptId: 'life'")
    .replace(/deptName:\s*'1階病棟'/, "deptName: '生活期'")
    .replace(/floor:\s*'1F'/, "floor: '生活期',\n            isLife: true")
    .replace(/theme:\s*'theme-1f'/, "theme: 'theme-life'");

fs.writeFileSync(path.join(dir, 'life.html'), lifeHtml, 'utf8');
fs.writeFileSync(path.join(dir, '生活期.html'), lifeHtml, 'utf8');
console.log('Created life.html and 生活期.html');

// 2. 全HTMLファイルのナビゲーションバーに「生活期」リンクを追加し、キャッシュバスターを rev66 に更新
const targetFiles = [
    'index.html', 'マスターテーブル.html', 'master.html',
    '1f.html', '1階病棟.html',
    '2f.html', '2階病棟.html',
    '3f.html', '3階病棟.html',
    'south.html', '南病棟.html',
    'ST.html',
    'life.html', '生活期.html', '生活期_管理者.html'
];

targetFiles.forEach(file => {
    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');

    // キャッシュバスター更新 rev65 -> rev66
    content = content.replace(/rev65/g, 'rev66');

    // ナビバーの「ST」の後ろに「生活期」を追加（既に存在しなければ）
    if (!content.includes('href="life.html"')) {
        const isCurrentLife = (file.includes('life') || file.includes('生活期'));
        const activeCls = isCurrentLife ? ' active' : '';
        const lifeBtn = `\n        <a href="life.html" class="dept-nav-btn dept-nav-life${activeCls}" style="background:#f0fdfa; border-color:#99f6e4; color:#0f766e;">生活期</a>`;
        
        content = content.replace(/(<a href="ST\.html"[^>]*>[\s\S]*?<\/a>)/, `$1${lifeBtn}`);
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
});
