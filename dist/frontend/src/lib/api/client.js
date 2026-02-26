"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApiClient = createApiClient;
exports.isApiError = isApiError;
const errors_1 = require("@/lib/api/errors");
function createApiClient(options) {
    const apiFetch = async (path, init, retry = true) => {
        const headers = new Headers(init?.headers);
        if (options.accessToken) {
            headers.set('Authorization', `Bearer ${options.accessToken}`);
        }
        if (!headers.has('Content-Type') && !(init?.body instanceof FormData)) {
            headers.set('Content-Type', 'application/json');
        }
        const response = await fetch(`/api/backend${path}`, {
            ...init,
            headers,
        });
        if (response.status === 401 && retry && options.refresh) {
            const nextToken = await options.refresh();
            if (nextToken) {
                options.accessToken = nextToken;
                return apiFetch(path, init, false);
            }
        }
        if (!response.ok) {
            throw await (0, errors_1.parseApiError)(response);
        }
        if (response.status === 204) {
            return undefined;
        }
        return (await response.json());
    };
    return { apiFetch };
}
function isApiError(error) {
    return Boolean(error && typeof error === 'object' && 'code' in error && 'message' in error);
}
//# sourceMappingURL=client.js.map