'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useApiClient = useApiClient;
const auth_provider_1 = require("@/components/providers/auth-provider");
const client_1 = require("@/lib/api/client");
function useApiClient() {
    const { accessToken, refresh } = (0, auth_provider_1.useAuth)();
    return (0, client_1.createApiClient)({ accessToken, refresh });
}
//# sourceMappingURL=use-api-client.js.map