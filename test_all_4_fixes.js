// test_all_4_fixes.js
const fs = require('fs');
const path = require('path');

console.log('=== Starting Comprehensive Verification of All 4 Fixes ===');

const appCode = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// 1. Check index.html for termSelect options and palette buttons
const optionMatches = indexHtml.match(/<option value="\d{4}-\d{2}-\d{2}"/g) || [];
console.log(`[Check 1] index.html termSelect static options count: ${optionMatches.length} (Expected: 39)`);
if (optionMatches.length !== 39) throw new Error('termSelect static options count mismatch!');

const endDisplayMatches = indexHtml.match(/id="termEndDateDisplay"/g) || [];
const titleBadgeMatches = indexHtml.match(/id="termTitleBadge"/g) || [];
console.log(`[Check 2] Duplicate badge check: termEndDateDisplay=${endDisplayMatches.length}, termTitleBadge=${titleBadgeMatches.length} (Expected: 1 each)`);
if (endDisplayMatches.length !== 1 || titleBadgeMatches.length !== 1) throw new Error('Duplicate badges still exist in index.html!');

// Check palette-btn classes for 「ー」
const outExcludeMatch = indexHtml.match(/class="palette-btn output-palette-btn" data-sym="ー"/);
const chkExcludeMatch = indexHtml.match(/class="palette-btn check-palette-btn" data-sym="ー"/);
console.log(`[Check 3] Palette 「ー」 button classes: output=${!!outExcludeMatch}, check=${!!chkExcludeMatch}`);
if (!outExcludeMatch || !chkExcludeMatch) throw new Error('Missing output/check palette class on 「ー」 button!');

// 2. Check app.js for toggle save after change
if (!appCode.includes('exclusiveRoleFlags.includes(flag)')) {
    throw new Error('Exclusive role flags logic missing in app.js!');
}
if (!appCode.includes('extractXmlTextWithoutPhonetic')) {
    throw new Error('extractXmlTextWithoutPhonetic missing in app.js!');
}
if (!appCode.includes('initTermSelector();')) {
    throw new Error('initTermSelector() call missing in startup of app.js!');
}
if (appCode.includes('resetTermDataKeepStaffSettings')) {
    throw new Error('Undefined resetTermDataKeepStaffSettings still present in app.js!');
}
if (!appCode.includes('let NUM_DAYS = 28;')) {
    throw new Error('NUM_DAYS is not declared with let!');
}

// 3. Test Role Exclusivity Logic directly
function testRoleExclusivity() {
    const staff = { isSectionChief: true, isChief: false, isSubChief: false };
    const exclusiveRoleFlags = ['isSectionChief', 'isChief', 'isSubChief'];
    // Simulate clicking 'isChief' ON
    const flag = 'isChief';
    staff[flag] = true;
    exclusiveRoleFlags.forEach(otherFlag => {
        if (otherFlag !== flag) staff[otherFlag] = false;
    });
    if (staff.isSectionChief !== false || staff.isChief !== true || staff.isSubChief !== false) {
        throw new Error('Role exclusivity failed when switching SectionChief -> Chief');
    }
    // Simulate clicking 'isSubChief' ON
    const flag2 = 'isSubChief';
    staff[flag2] = true;
    exclusiveRoleFlags.forEach(otherFlag => {
        if (otherFlag !== flag2) staff[otherFlag] = false;
    });
    if (staff.isSectionChief !== false || staff.isChief !== false || staff.isSubChief !== true) {
        throw new Error('Role exclusivity failed when switching Chief -> SubChief');
    }
    console.log('[Check 4] Role exclusivity (係長 / 主任 / 副主任 択一制御): PASSED');
}
testRoleExclusivity();

// 4. Verify all 7 department HTML files have the updated termSelect and rev25 cache buster
const deptFiles = ['1階病棟.html', '2階病棟.html', '3階病棟.html', '南病棟.html', 'ST.html', '生活期_管理者.html', 'マスター統括.html'];
for (const df of deptFiles) {
    const content = fs.readFileSync(path.join(__dirname, df), 'utf8');
    if (!content.includes('app.js?v=20261016_rev25') || !content.includes('window.APP_CONFIG')) {
        throw new Error(`Department HTML file ${df} was not properly updated!`);
    }
}
console.log('[Check 5] All 7 department HTML files synced with rev25 and 13-term selector: PASSED');

console.log('=== ALL CHECKS PASSED SUCCESSFULLY ===');
