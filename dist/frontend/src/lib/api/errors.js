"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseApiError = parseApiError;
exports.getErrorMessage = getErrorMessage;
exports.parseJsonSafe = parseJsonSafe;
async function parseApiError(response) {
    try {
        const payload = (await response.json());
        return {
            code: payload.code || 'HTTP_ERROR',
            message: payload.message || response.statusText,
            details: payload.details,
        };
    }
    catch {
        return { code: 'HTTP_ERROR', message: response.statusText };
    }
}
function getErrorMessage(error, fallback = 'Falha inesperada') {
    if (error && typeof error === 'object' && 'message' in error) {
        return String(error.message);
    }
    return fallback;
}
async function parseJsonSafe(response) {
    const text = await response.text();
    if (!text)
        return null;
    try {
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=errors.js.map