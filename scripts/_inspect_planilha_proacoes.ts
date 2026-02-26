import * as XLSX from 'xlsx';
const wb = XLSX.readFile('Detalhado Pro Ação 2026.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
const keys = rows.length ? Object.keys(rows[0]) : [];
console.log('SHEET', wb.SheetNames[0]);
console.log('COLUMNS', keys.join(' | '));
const candidates = keys.filter((k) => /pro|acao|açao|cen[aá]rio|categoria/i.test(k));
console.log('CANDIDATES', candidates.join(' | '));
for (const key of candidates) {
  const vals = Array.from(new Set(rows.map((r) => String(r[key] ?? '').trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'pt-BR'));
  console.log('\nKEY', key, 'UNIQUE', vals.length);
  vals.slice(0,200).forEach((v)=>console.log(v));
}
