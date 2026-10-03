var fso = new ActiveXObject("Scripting.FileSystemObject");
var f = fso.OpenTextFile("solver.js", 1);
var code = f.ReadAll();
f.Close();

try {
    eval(code);
    WScript.Echo("SYNTAX OK");
} catch(e) {
    WScript.Echo("SYNTAX ERROR: " + e.message + " (number: " + (e.number & 0xFFFF) + ")");
}
