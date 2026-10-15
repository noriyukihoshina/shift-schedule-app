// generate_dept_html_files.js
// 各病棟・部署用のHTMLファイル（計7ファイル）を生成するスクリプト

const fs = require('fs');
const path = require('path');

const baseHtmlPath = path.join(__dirname, 'index.html');
const baseHtml = fs.readFileSync(baseHtmlPath, 'utf8');

const departments = [
    { filename: '1階病棟.html', deptId: '1f', deptName: '1階病棟', password: '11111' },
    { filename: '2階病棟.html', deptId: '2f', deptName: '2階病棟', password: '22222' },
    { filename: '3階病棟.html', deptId: '3f', deptName: '3階病棟', password: '33333' },
    { filename: '南病棟.html', deptId: 'south', deptName: '南病棟', password: '44444' },
    { filename: 'ST.html', deptId: 'st', deptName: 'ST (4病棟合同)', password: '55555' },
    { filename: '生活期_管理者.html', deptId: 'life_admin', deptName: '生活期＋管理者', password: '66666' },
    { filename: 'マスター統括.html', deptId: 'master', deptName: 'マスター統括', password: '77777' }
];

departments.forEach(dept => {
    const configScript = `
    <!-- 部署・病棟固有設定 (パスワード・データ分離) -->
    <script>
        window.APP_CONFIG = {
            deptId: '${dept.deptId}',
            deptName: '${dept.deptName}',
            password: '${dept.password}'
        };
    </script>
`;
    // <head> タグの直後、または <script src="solver.js"> の直前に挿入
    let deptHtml = baseHtml.replace('<title>勤務予定表 自動作成システム (28日サイクル・60名規模)</title>', `<title>勤務予定表 自動作成システム - ${dept.deptName}</title>`);
    deptHtml = deptHtml.replace('<script src="solver.js', configScript + '    <script src="solver.js');

    const outPath = path.join(__dirname, dept.filename);
    fs.writeFileSync(outPath, deptHtml, 'utf8');
    console.log(`Generated: ${dept.filename}`);
});

console.log('SUCCESS: All department HTML files generated successfully!');
