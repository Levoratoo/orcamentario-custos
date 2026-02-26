"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dre_2026_sheet_1 = require("../src/dre/dre-2026-sheet");
const sheet = (0, dre_2026_sheet_1.getDre2026SheetData)();
if (!sheet) {
    console.log('no sheet');
    process.exit(0);
}
for (const code of ['6184', '6191', '88383', '88390', '68713', '68720']) {
    const rows = sheet.entries.filter(e => String(e.code ?? '').trim() === code);
    console.log('\ncode', code, 'rows', rows.length);
    for (const r of rows) {
        const jan = r.months.get(1)?.previsto ?? 0;
        console.log(' ', r.label, 'jan', jan);
    }
}
//# sourceMappingURL=tmp-sheet-codes.js.map