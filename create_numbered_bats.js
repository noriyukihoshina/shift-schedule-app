const fs = require('fs');
const path = require('path');

const targets = [
    { num: '①', name: '1階病棟', page: '1f.html' },
    { num: '②', name: '2階病棟', page: '2f.html' },
    { num: '③', name: '3階病棟', page: '3f.html' },
    { num: '④', name: '南病棟', page: 'south.html' },
    { num: '⑤', name: '生活期', page: 'life.html' },
    { num: '⑥', name: 'ST', page: 'ST.html' },
    { num: '⑦', name: 'マスターテーブル', page: 'master.html' }
];

const pkgDir = 'Hospital_Clean_Package';

targets.forEach(t => {
    const batContent = `@echo off\r\npushd "%~dp0"\r\nstart "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File "%~dp0system\\server.ps1" -TargetPage ${t.page}\r\npopd\r\n`;
    
    // ①1階病棟.bat
    const newName = t.num + t.name + '.bat';
    fs.writeFileSync(path.join(pkgDir, newName), batContent);
    console.log('Created:', newName);

    // 既存の名前（1階病棟.bat）もpushd対応で更新
    const oldName = t.name + '.bat';
    fs.writeFileSync(path.join(pkgDir, oldName), batContent);
});
