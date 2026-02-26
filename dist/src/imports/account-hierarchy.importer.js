"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAccountHierarchyXlsx = parseAccountHierarchyXlsx;
const xlsx = __importStar(require("xlsx"));
function normalizeHeader(value) {
    return String(value ?? '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, '');
}
function normalizeClassification(value) {
    const raw = String(value ?? '').trim();
    if (!raw)
        return '';
    const cleaned = raw.replace(/[^\d.]/g, '').replace(/\.{2,}/g, '.').replace(/\.$/, '');
    return cleaned;
}
function findHeaderRow(rows) {
    for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i] || [];
        let classificationIndex = -1;
        let descriptionIndex = -1;
        row.forEach((cell, idx) => {
            const normalized = normalizeHeader(cell);
            if (normalized === 'classificacao')
                classificationIndex = idx;
            if (normalized === 'descricao' || normalized === 'descrica')
                descriptionIndex = idx;
        });
        if (classificationIndex >= 0 && descriptionIndex >= 0) {
            return { rowIndex: i, classificationIndex, descriptionIndex };
        }
    }
    return null;
}
function parseAccountHierarchyXlsx(buffer, fileName) {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const errors = [];
    const nodesByClassification = new Map();
    workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet)
            return;
        const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        const header = findHeaderRow(rows);
        if (!header)
            return;
        for (let index = header.rowIndex + 1; index < rows.length; index += 1) {
            const row = rows[index] || [];
            const classificationRaw = row[header.classificationIndex];
            const descriptionRaw = row[header.descriptionIndex];
            const classification = normalizeClassification(classificationRaw);
            const description = String(descriptionRaw ?? '').trim();
            if (!classification || !description) {
                continue;
            }
            if (!/^\d/.test(classification)) {
                continue;
            }
            const segments = classification.split('.').filter(Boolean);
            const normalized = segments.join('.');
            const level = segments.length;
            if (!normalized) {
                continue;
            }
            const existing = nodesByClassification.get(normalized);
            if (existing) {
                if (!existing.description && description) {
                    existing.description = description;
                }
                continue;
            }
            nodesByClassification.set(normalized, {
                classification: normalized,
                description,
                level,
                children: [],
            });
        }
    });
    if (nodesByClassification.size === 0) {
        errors.push(`${fileName} :: nenhuma hierarquia encontrada`);
        return { tree: [], errors };
    }
    const tree = [];
    nodesByClassification.forEach((node) => {
        const segments = node.classification.split('.').filter(Boolean);
        const parentKey = segments.slice(0, -1).join('.');
        const parent = parentKey ? nodesByClassification.get(parentKey) : undefined;
        if (parent) {
            parent.children.push(node);
        }
        else {
            tree.push(node);
        }
    });
    const sortNodes = (items) => {
        items.sort((a, b) => a.classification.localeCompare(b.classification));
        items.forEach((child) => sortNodes(child.children));
    };
    sortNodes(tree);
    return { tree, errors };
}
//# sourceMappingURL=account-hierarchy.importer.js.map