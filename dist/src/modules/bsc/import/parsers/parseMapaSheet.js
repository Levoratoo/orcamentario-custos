"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMapaSheet = parseMapaSheet;
const client_1 = require("@prisma/client");
const headerDetect_1 = require("../utils/headerDetect");
const normalize_1 = require("../utils/normalize");
function resolvePerspective(raw) {
    const value = String(raw ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase();
    if (value.includes('FINANCE'))
        return client_1.BscPerspectiveName.FINANCEIRO;
    if (value.includes('CLIENTE'))
        return client_1.BscPerspectiveName.CLIENTE;
    if (value.includes('PROCESS'))
        return client_1.BscPerspectiveName.PROCESSOS;
    if (value.includes('APRENDIZADO') || value.includes('CRESCIMENTO')) {
        return client_1.BscPerspectiveName.APRENDIZADO_CRESCIMENTO;
    }
    return null;
}
function parseMapaSheet(sheet) {
    const headerRowIndex = (0, headerDetect_1.findHeaderRow)(sheet, ['PERSPECTIVA', 'OBJETIVO', 'INDICADOR']);
    if (!headerRowIndex) {
        return { headerRowIndex: null, rows: [] };
    }
    const headerMap = (0, headerDetect_1.buildHeaderMap)(sheet.getRow(headerRowIndex));
    const perspectiveCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/PERSPECTIVA/]);
    const objectiveCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/OBJETIV/]);
    const indicatorCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/INDICADOR/]);
    const indicatorCodeCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/CODIGO/, /C[ÓO]D/]);
    const responsibleCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/RESPONS/]);
    const dataOwnerCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/ALIMENTADOR/, /DATA OWNER/]);
    const keywordsCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/PALAVRA.*CHAVE/, /KEYWORD/]);
    const levelCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/NIVEL/]);
    const processCol = (0, headerDetect_1.findHeaderColumn)(headerMap, [/PROCESSO/]);
    const yearColumns = new Map();
    for (const [header, column] of headerMap.entries()) {
        const yearMatch = header.match(/20\d{2}/);
        if (yearMatch)
            yearColumns.set(Number(yearMatch[0]), column);
    }
    const rows = [];
    for (let rowIndex = headerRowIndex + 1; rowIndex <= sheet.rowCount; rowIndex += 1) {
        const row = sheet.getRow(rowIndex);
        const perspectiveRaw = perspectiveCol ? (0, headerDetect_1.getCellValue)(row.getCell(perspectiveCol)) : null;
        const objective = objectiveCol ? String((0, headerDetect_1.getCellValue)(row.getCell(objectiveCol)) ?? '').trim() : '';
        const codeSource = indicatorCodeCol
            ? (0, headerDetect_1.getCellValue)(row.getCell(indicatorCodeCol))
            : indicatorCol
                ? (0, headerDetect_1.getCellValue)(row.getCell(indicatorCol))
                : null;
        const parsed = (0, normalize_1.parseIndicatorCodeAndName)(String(codeSource ?? ''));
        const indicatorName = parsed.name ||
            (indicatorCol ? String((0, headerDetect_1.getCellValue)(row.getCell(indicatorCol)) ?? '').trim() : null);
        const annualTargets = Array.from(yearColumns.entries()).map(([year, column]) => {
            const raw = (0, headerDetect_1.getCellValue)(row.getCell(column));
            return {
                year,
                rawValue: raw,
                targetValue: (0, normalize_1.parseNumberFlexible)(raw),
            };
        });
        rows.push({
            rowIndex,
            perspective: resolvePerspective(perspectiveRaw),
            objective,
            indicatorCode: parsed.code,
            indicatorName,
            responsible: responsibleCol ? String((0, headerDetect_1.getCellValue)(row.getCell(responsibleCol)) ?? '').trim() || null : null,
            dataOwner: dataOwnerCol ? String((0, headerDetect_1.getCellValue)(row.getCell(dataOwnerCol)) ?? '').trim() || null : null,
            keywords: keywordsCol ? String((0, headerDetect_1.getCellValue)(row.getCell(keywordsCol)) ?? '').trim() || null : null,
            level: levelCol ? (0, normalize_1.parseNumberFlexible)((0, headerDetect_1.getCellValue)(row.getCell(levelCol))) : null,
            process: processCol ? String((0, headerDetect_1.getCellValue)(row.getCell(processCol)) ?? '').trim() || null : null,
            annualTargets,
        });
    }
    return { headerRowIndex, rows };
}
//# sourceMappingURL=parseMapaSheet.js.map