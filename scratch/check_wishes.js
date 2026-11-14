const fs = require('fs');
const html = fs.readFileSync('dump_1f.html', 'utf8');

const inputBodyMatch = html.match(/<tbody id="inputTableBody">([\s\S]*?)<\/tbody>/);
const rows = inputBodyMatch[1].split(/<tr\b[^>]*>/).filter(r => r.includes('</td>'));
for (let s = 0; s < rows.length; s++) {
    const row = rows[s];
    const nameMatch = row.match(/class="staff-name-input"\s+value="([^"]*)"/);
    const name = nameMatch ? nameMatch[1] : '';
    if (name.includes('21') || name.includes('16') || name.includes('28') || name.includes('29') || name.includes('30')) {
        const cellRegex = /<td\b[^>]*data-d="(\d+)"[^>]*>([\s\S]*?)<\/td>/g;
        const wishes = [];
        let cm;
        while ((cm = cellRegex.exec(row)) !== null) {
            const sym = cm[2].trim().replace(/<[^>]+>/g, '').trim();
            if (sym) wishes.push({ d: parseInt(cm[1]), sym });
        }
        console.log(name, JSON.stringify(wishes));
    }
}
