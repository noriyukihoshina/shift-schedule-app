const fs = require('fs');
const path = require('path');

const targetDirs = [
    '.',
    'Hospital_Clean_Package/system'
];

const newVersion = '20261126_212000';

function getNavHtml(deptId) {
    const isMaster = deptId === 'master';
    const displayStyle = isMaster ? 'display: flex !important;' : 'display: none !important;';
    const hiddenClass = isMaster ? '' : 'hidden-nav';
    return `    <!-- Table Navigation -->
    <nav class="dept-nav-container ${hiddenClass}" style="${displayStyle}">
        <span style="font-size:0.8rem; font-weight:700; color:#475569;">テーブル切替:</span>
        <a href="index.html" class="dept-nav-btn nav-master ${isMaster ? 'active' : ''}" style="background:#fefce8; border-color:#fef08a; color:#854d0e;">👑 マスターテーブル</a>
        <a href="1f.html?from=master" class="dept-nav-btn nav-1f ${deptId === '1f' ? 'active' : ''}" style="background:#f0f9ff; border-color:#bae6fd; color:#0369a1;">1階病棟</a>
        <a href="2f.html?from=master" class="dept-nav-btn nav-2f ${deptId === '2f' ? 'active' : ''}" style="background:#fff7ed; border-color:#fed7aa; color:#c2410c;">2階病棟</a>
        <a href="3f.html?from=master" class="dept-nav-btn nav-3f ${deptId === '3f' ? 'active' : ''}" style="background:#f0fdf4; border-color:#bbf7d0; color:#15803d;">3階病棟</a>
        <a href="south.html?from=master" class="dept-nav-btn nav-south ${deptId === 'south' ? 'active' : ''}" style="background:#faf5ff; border-color:#e9d5ff; color:#7e22ce;">南病棟</a>
        <a href="ST.html?from=master" class="dept-nav-btn nav-st dept-nav-st ${deptId === 'st' ? 'active' : ''}" style="background:#fdf2f8; border-color:#fbcfe8; color:#be185d;">ST</a>
        <a href="life.html?from=master" class="dept-nav-btn nav-life dept-nav-life ${(deptId === 'life' || deptId === 'life_admin') ? 'active' : ''}" style="background:#f0fdfa; border-color:#99f6e4; color:#0f766e;">生活期</a>
    </nav>`;
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // キャッシュバスター更新
    content = content.replace(/app\.js\?v=[0-9_]+/g, 'app.js?v=' + newVersion);
    content = content.replace(/style\.css\?v=[0-9_]+/g, 'style.css?v=' + newVersion);

    // deptId の判定
    let deptId = 'master';
    const deptMatch = content.match(/deptId:\s*'([^']+)'/);
    if (deptMatch) {
        deptId = deptMatch[1];
    }

    // 既存の dept-nav-container やコメントアウトされた Table Navigation を除去
    content = content.replace(/<!-- Table Navigation -->[\s\S]*?<!-- Table Navigation -->/g, '');
    content = content.replace(/<nav class="dept-nav-container[\s\S]*?<\/nav>/g, '');
    content = content.replace(/<!-- dept navigation removed for security and isolation -->/g, '');

    // </header> の直後に正しいナビバーを挿入
    const navBlock = getNavHtml(deptId);
    content = content.replace(/(<\/header>)/, '$1\n' + navBlock);

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Processed:', filePath, 'Dept:', deptId);
}

targetDirs.forEach(dir => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    files.forEach(f => {
        if (f.endsWith('.html') && f !== '404.html' && !f.includes('救出')) {
            processFile(path.join(dir, f));
        }
    });
});
