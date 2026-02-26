"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiAuth = void 0;
const errors_1 = require("@/lib/api/errors");
exports.apiAuth = {
    async login(email, password) {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const payload = await (0, errors_1.parseJsonSafe)(response);
        if (!response.ok) {
            throw payload || { message: response.statusText || 'Falha ao autenticar' };
        }
        return payload;
    },
    async refresh() {
        const response = await fetch('/api/auth/refresh', { method: 'POST' });
        const payload = await (0, errors_1.parseJsonSafe)(response);
        if (!response.ok) {
            throw payload || { message: response.statusText || 'Falha ao renovar' };
        }
        return payload;
    },
    async logout() {
        await fetch('/api/auth/logout', { method: 'POST' });
    },
};
//# sourceMappingURL=auth.js.map