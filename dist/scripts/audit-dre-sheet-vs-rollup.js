"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dre_2026_sheet_1 = require("../src/dre/dre-2026-sheet");
const dre_utils_1 = require("../src/dre/dre-utils");
const YEAR = 2026;
const MONTHS = Array.from({ length: 12 }, (_, i) => `${YEAR}-${String(i + 1).padStart(2, '0')}`);
function applySheetHierarchy(rows) {
    if (rows.length === 0)
        return rows;
    const markerRegex = /^\s*\(([+\-=])\)\s*(.+)$/u;
    const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    let currentGroupId = null;
    let deducoesRootId = null;
    let inDeducoesBlock = false;
    return rows
        .slice()
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((row) => {
        const marker = String(row.descricao ?? '').match(markerRegex);
        if (marker) {
            const sign = marker[1];
            const markerLabel = normalize(marker[2] ?? '');
            const isDeducoesRoot = sign === '-' && markerLabel.includes('DEDUCOES');
            const isDeducoesChild = inDeducoesBlock && sign === '-' && !markerLabel.includes('DEDUCOES');
            if (isDeducoesRoot) {
                inDeducoesBlock = true;
                deducoesRootId = row.id;
                currentGroupId = row.id;
                return { ...row, nivel: 0, parentId: null };
            }
            if (isDeducoesChild && deducoesRootId) {
                currentGroupId = row.id;
                return { ...row, nivel: 1, parentId: deducoesRootId };
            }
            inDeducoesBlock = false;
            deducoesRootId = null;
            currentGroupId = row.id;
            return { ...row, nivel: 0, parentId: null };
        }
        if (inDeducoesBlock && deducoesRootId && currentGroupId && currentGroupId !== deducoesRootId) {
            return { ...row, nivel: 2, parentId: currentGroupId };
        }
        if (currentGroupId) {
            return { ...row, nivel: 1, parentId: currentGroupId };
        }
        return { ...row, nivel: 0, parentId: null };
    });
}
function rollupHierarchyMonthValues(rows, months) {
    if (rows.length === 0)
        return rows;
    const byId = new Map(rows.map((r) => [r.id, r]));
    const childrenByParent = new Map();
    rows.forEach((r) => {
        if (!r.parentId || !byId.has(r.parentId))
            return;
        const list = childrenByParent.get(r.parentId) ?? [];
        list.push(r);
        childrenByParent.set(r.parentId, list);
    });
    const visited = new Set();
    const walk = (row) => {
        if (visited.has(row.id))
            return;
        const children = childrenByParent.get(row.id) ?? [];
        children.forEach((c) => walk(c));
        if (children.length > 0) {
            months.forEach((mk) => {
                let previsto = 0, realizado = 0, projetado = 0;
                children.forEach((c) => {
                    const v = c.valoresPorMes[mk] ?? { previsto: 0, realizado: 0, projetado: 0 };
                    previsto += v.previsto ?? 0;
                    realizado += v.realizado ?? 0;
                    projetado += v.projetado ?? 0;
                });
                row.valoresPorMes[mk] = { previsto, realizado, projetado };
            });
        }
        visited.add(row.id);
    };
    rows.forEach((r) => {
        if (!r.parentId || !byId.has(r.parentId))
            walk(r);
    });
    return rows;
}
function fmt(value) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function run() {
    (0, dre_2026_sheet_1.invalidateDre2026SheetCache)();
    const sheet = (0, dre_2026_sheet_1.getDre2026SheetData)();
    if (!sheet) {
        console.error('Planilha DRE expandida nao encontrada no diretorio do projeto.');
        process.exit(1);
    }
    console.log(`\nPlanilha: ${sheet.sourceFile}`);
    console.log(`Total de linhas: ${sheet.entries.length}\n`);
    const sheetRows = sheet.entries
        .sort((a, b) => a.rank - b.rank)
        .map((entry) => {
        const valoresPorMes = {};
        for (let m = 1; m <= 12; m++) {
            const mk = `${YEAR}-${String(m).padStart(2, '0')}`;
            const mv = entry.months.get(m) ?? { previsto: 0, realizado: 0 };
            valoresPorMes[mk] = { previsto: mv.previsto, realizado: mv.realizado, projetado: 0 };
        }
        return {
            id: `ROW-${entry.rank}`,
            codigo: entry.code,
            descricao: (0, dre_utils_1.sanitizeLabel)(entry.label),
            nivel: 0,
            parentId: null,
            sortOrder: entry.rank,
            valoresPorMes,
        };
    });
    const originalValues = new Map();
    sheetRows.forEach((r) => {
        const snapshot = {};
        MONTHS.forEach((mk) => {
            const v = r.valoresPorMes[mk];
            snapshot[mk] = { previsto: v?.previsto ?? 0, realizado: v?.realizado ?? 0 };
        });
        originalValues.set(r.id, snapshot);
    });
    const hierarchyRows = applySheetHierarchy(sheetRows);
    const preRollupValues = new Map();
    hierarchyRows.forEach((r) => {
        const snapshot = {};
        MONTHS.forEach((mk) => {
            const v = r.valoresPorMes[mk];
            snapshot[mk] = { previsto: v?.previsto ?? 0, realizado: v?.realizado ?? 0 };
        });
        preRollupValues.set(r.id, snapshot);
    });
    const deepCopy = hierarchyRows.map((r) => ({
        ...r,
        valoresPorMes: Object.fromEntries(Object.entries(r.valoresPorMes).map(([k, v]) => [k, { ...v }])),
    }));
    rollupHierarchyMonthValues(deepCopy, MONTHS);
    console.log('='.repeat(120));
    console.log('VARREDURA: COMPARACAO PLANILHA vs ROLLUP (simulacao do bug antigo)');
    console.log('='.repeat(120));
    const issues = [];
    const childrenByParent = new Map();
    hierarchyRows.forEach((r) => {
        if (r.parentId) {
            const list = childrenByParent.get(r.parentId) ?? [];
            list.push(r.id);
            childrenByParent.set(r.parentId, list);
        }
    });
    hierarchyRows.forEach((row) => {
        const original = preRollupValues.get(row.id);
        const rolled = deepCopy.find((r) => r.id === row.id);
        const children = childrenByParent.get(row.id) ?? [];
        MONTHS.forEach((mk) => {
            const oPrev = original[mk]?.previsto ?? 0;
            const oReal = original[mk]?.realizado ?? 0;
            const rPrev = rolled.valoresPorMes[mk]?.previsto ?? 0;
            const rReal = rolled.valoresPorMes[mk]?.realizado ?? 0;
            const deltaPrev = rPrev - oPrev;
            const deltaReal = rReal - oReal;
            if (Math.abs(deltaPrev) > 0.02 || Math.abs(deltaReal) > 0.02) {
                issues.push({
                    row: row.descricao,
                    nivel: row.nivel,
                    parentId: row.parentId,
                    childCount: children.length,
                    month: mk,
                    sheetPrevisto: oPrev,
                    rolledPrevisto: rPrev,
                    deltaPrevisto: deltaPrev,
                    sheetRealizado: oReal,
                    rolledRealizado: rReal,
                    deltaRealizado: deltaReal,
                });
            }
        });
    });
    if (issues.length === 0) {
        console.log('\n  NENHUMA DIVERGENCIA ENCONTRADA. Todos os valores da planilha batem com o rollup.\n');
    }
    else {
        const rowsAffected = new Set(issues.map((i) => i.row));
        console.log(`\n  TOTAL DE DIVERGENCIAS: ${issues.length} celulas em ${rowsAffected.size} linhas\n`);
        const grouped = new Map();
        issues.forEach((i) => {
            const list = grouped.get(i.row) ?? [];
            list.push(i);
            grouped.set(i.row, list);
        });
        grouped.forEach((rowIssues, rowLabel) => {
            const first = rowIssues[0];
            console.log('-'.repeat(120));
            console.log(`  LINHA: ${rowLabel}`);
            console.log(`  Nivel: ${first.nivel} | Pai: ${first.parentId ?? '(raiz)'} | Filhos diretos: ${first.childCount}`);
            console.log('');
            let totalSheetPrev = 0, totalRolledPrev = 0;
            let totalSheetReal = 0, totalRolledReal = 0;
            rowIssues.forEach((issue) => {
                const monthNum = issue.month.split('-')[1];
                const parts = [];
                if (Math.abs(issue.deltaPrevisto) > 0.02) {
                    parts.push(`Previsto: planilha=${fmt(issue.sheetPrevisto)} vs rollup=${fmt(issue.rolledPrevisto)} (delta=${fmt(issue.deltaPrevisto)})`);
                    totalSheetPrev += issue.sheetPrevisto;
                    totalRolledPrev += issue.rolledPrevisto;
                }
                if (Math.abs(issue.deltaRealizado) > 0.02) {
                    parts.push(`Realizado: planilha=${fmt(issue.sheetRealizado)} vs rollup=${fmt(issue.rolledRealizado)} (delta=${fmt(issue.deltaRealizado)})`);
                    totalSheetReal += issue.sheetRealizado;
                    totalRolledReal += issue.rolledRealizado;
                }
                console.log(`    Mes ${monthNum}: ${parts.join(' | ')}`);
            });
            if (rowIssues.length > 1) {
                console.log('');
                if (totalSheetPrev !== 0 || totalRolledPrev !== 0) {
                    console.log(`    TOTAL PREVISTO: planilha=${fmt(totalSheetPrev)} vs rollup=${fmt(totalRolledPrev)} (delta=${fmt(totalRolledPrev - totalSheetPrev)})`);
                }
                if (totalSheetReal !== 0 || totalRolledReal !== 0) {
                    console.log(`    TOTAL REALIZADO: planilha=${fmt(totalSheetReal)} vs rollup=${fmt(totalRolledReal)} (delta=${fmt(totalRolledReal - totalSheetReal)})`);
                }
            }
            console.log('');
        });
    }
    console.log('='.repeat(120));
    console.log('HIERARQUIA COMPLETA (resumo):');
    console.log('='.repeat(120));
    hierarchyRows.forEach((row) => {
        const indent = '  '.repeat(row.nivel);
        const children = childrenByParent.get(row.id) ?? [];
        const isParent = children.length > 0;
        const totalPrev = MONTHS.reduce((s, mk) => s + (row.valoresPorMes[mk]?.previsto ?? 0), 0);
        const marker = isParent ? `[PAI: ${children.length} filhos]` : '';
        const flag = issues.some((i) => i.row === row.descricao) ? ' *** DIVERGENTE ***' : '';
        console.log(`${indent}${row.descricao} | Prev.Total=${fmt(totalPrev)} ${marker}${flag}`);
    });
    console.log('\n' + '='.repeat(120));
    console.log('FIM DA VARREDURA');
    console.log('='.repeat(120));
}
run();
//# sourceMappingURL=audit-dre-sheet-vs-rollup.js.map