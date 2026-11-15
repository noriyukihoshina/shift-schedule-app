const fs = require('fs');
let code = fs.readFileSync('solver.js', 'utf8');

// obtainedHistory[st.id] || obtainedHistory[sIdx] を obtainedHistory[st.id] に修正
code = code.replace(/obtainedHistory\[st\.id\] \|\| obtainedHistory\[sIdx\]/g, 'obtainedHistory[st.id]');
code = code.replace(/futureHistory\[st\.id\] \|\| futureHistory\[sIdx\]/g, 'futureHistory[st.id]');

fs.writeFileSync('solver.js', code, 'utf8');
console.log('Fixed history indexing bugs in solver.js!');
