const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const html = fs.readFileSync('master.html', 'utf-8');
const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable" });
const { window } = dom;

// Check what scripts exist and run
console.log('Window loaded, checking elements:');
console.log('masterTermSelect:', !!dom.window.document.getElementById('masterTermSelect'));
console.log('termSelect:', !!dom.window.document.getElementById('termSelect'));
console.log('termStartDate:', dom.window.document.getElementById('termStartDate')?.value);
