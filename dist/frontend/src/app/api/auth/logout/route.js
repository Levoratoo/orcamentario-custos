"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const headers_1 = require("next/headers");
function getApiBaseUrl() {
    return process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
}
async function POST() {
    const cookieStore = await (0, headers_1.cookies)();
    const refreshToken = cookieStore.get('refresh_token')?.value;
    if (refreshToken) {
        await fetch(`${getApiBaseUrl()}/auth/logout`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${refreshToken}` },
        });
    }
    cookieStore.delete('refresh_token');
    return server_1.NextResponse.json({ success: true });
}
//# sourceMappingURL=route.js.map