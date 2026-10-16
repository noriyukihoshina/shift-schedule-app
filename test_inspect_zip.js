const fs = require('fs');

function inspectZipHeaders(filename) {
    console.log(`\n=================== Inspecting ${filename} ===================`);
    const buf = fs.readFileSync(filename);
    let pos = 0;
    while (pos < buf.length - 4) {
        const sig = buf.readUInt32LE(pos);
        if (sig === 0x04034b50) { // Local Header
            const ver = buf.readUInt16LE(pos + 4);
            const flags = buf.readUInt16LE(pos + 6);
            const compMethod = buf.readUInt16LE(pos + 8);
            const modTime = buf.readUInt16LE(pos + 10);
            const modDate = buf.readUInt16LE(pos + 12);
            const crc = buf.readUInt32LE(pos + 14);
            const compSize = buf.readUInt32LE(pos + 18);
            const uncompSize = buf.readUInt32LE(pos + 22);
            const nameLen = buf.readUInt16LE(pos + 26);
            const extraLen = buf.readUInt16LE(pos + 28);
            const name = buf.toString('utf8', pos + 30, pos + 30 + nameLen);
            console.log(`LocalHeader: ${name} (ver:${ver}, flags:0x${flags.toString(16)}, compMethod:${compMethod}, crc:0x${crc.toString(16)}, compSize:${compSize}, uncompSize:${uncompSize}, extraLen:${extraLen})`);
            pos += 30 + nameLen + extraLen + compSize;
        } else if (sig === 0x02014b50) { // Central Directory Header
            const verMadeBy = buf.readUInt16LE(pos + 4);
            const verNeeded = buf.readUInt16LE(pos + 6);
            const flags = buf.readUInt16LE(pos + 8);
            const compMethod = buf.readUInt16LE(pos + 10);
            const crc = buf.readUInt32LE(pos + 16);
            const compSize = buf.readUInt32LE(pos + 20);
            const uncompSize = buf.readUInt32LE(pos + 24);
            const nameLen = buf.readUInt16LE(pos + 28);
            const extraLen = buf.readUInt16LE(pos + 30);
            const commentLen = buf.readUInt16LE(pos + 32);
            const localHeaderOffset = buf.readUInt32LE(pos + 42);
            const name = buf.toString('utf8', pos + 46, pos + 46 + nameLen);
            console.log(`CDHeader: ${name} (verMade:${verMadeBy}, verNeed:${verNeeded}, flags:0x${flags.toString(16)}, offset:${localHeaderOffset})`);
            pos += 46 + nameLen + extraLen + commentLen;
        } else if (sig === 0x06054b50) { // EOCD
            const totalEntries = buf.readUInt16LE(pos + 10);
            const cdSize = buf.readUInt32LE(pos + 12);
            const cdOffset = buf.readUInt32LE(pos + 16);
            console.log(`EOCD: entries:${totalEntries}, cdSize:${cdSize}, cdOffset:${cdOffset}`);
            break;
        } else {
            pos++;
        }
    }
}

inspectZipHeaders('test_store.xlsx');
inspectZipHeaders('test_export_generated.xlsx');
