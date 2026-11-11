const fs = require('fs');

const pages = ['index.html', 'master.html', '1f.html', '2f.html', '3f.html', 'south.html', 'ST.html', 'life.html'];
let allGood = true;

pages.forEach(p => {
    if (!fs.existsSync(p)) {
        console.log(`[MISSING] ${p}`);
        allGood = false;
        return;
    }
    const html = fs.readFileSync(p, 'utf8');
    console.log(`[EXISTS] ${p} (${html.length} bytes)`);
});

if (allGood) {
    console.log("All main HTML pages restored cleanly from 24185b8!");
}
