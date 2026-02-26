"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toAsciiUpper = toAsciiUpper;
exports.slugify = slugify;
exports.fileSha256 = fileSha256;
exports.parseNumberFlexible = parseNumberFlexible;
exports.parseIndicatorCodeAndName = parseIndicatorCodeAndName;
const crypto_1 = require("crypto");
function toAsciiUpper(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}
function slugify(value) {
    return toAsciiUpper(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
function fileSha256(buffer) {
    return (0, crypto_1.createHash)('sha256').update(buffer).digest('hex');
}
function parseNumberFlexible(value) {
    if (value === null || value === undefined)
        return null;
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : null;
    const raw = String(value).trim();
    if (!raw)
        return null;
    const cleaned = raw
        .replace(/\s/g, '')
        .replace(/R\$/gi, '')
        .replace(/\.(?=\d{3}(\D|$))/g, '')
        .replace(',', '.')
        .replace('%', '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
}
function parseIndicatorCodeAndName(raw) {
    const text = String(raw ?? '').trim();
    if (!text)
        return { code: null, name: null };
    const match = text.match(/^([FCPA]\d+(?:\.\d+){0,2})\s*[-–:]?\s*(.*)$/i);
    if (!match)
        return { code: null, name: text || null };
    return { code: match[1].toUpperCase(), name: match[2]?.trim() || null };
}
//# sourceMappingURL=normalize.js.map