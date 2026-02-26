"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const headers_1 = require("next/headers");
function getApiBaseUrl() {
    return process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
}
async function getUser(accessToken) {
    const response = await fetch(`${getApiBaseUrl()}/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
    });
    if (!response.ok)
        return null;
    return response.json();
}
async function POST(request) {
    let payload;
    try {
        payload = await request.json();
    }
    catch {
        return server_1.NextResponse.json({ code: 'INVALID_JSON', message: 'Payload invalido' }, { status: 400 });
    }
    let response;
    try {
        response = await fetch(`${getApiBaseUrl()}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }
    catch {
        return server_1.NextResponse.json({ code: 'API_UNAVAILABLE', message: 'Backend indisponivel' }, { status: 502 });
    }
    if (!response.ok) {
        const error = await response.json().catch(() => ({ code: 'AUTH_FAILED', message: 'Falha ao autenticar' }));
        return server_1.NextResponse.json(error, { status: response.status });
    }
    const data = await response.json();
    const cookieStore = await (0, headers_1.cookies)();
    cookieStore.set('refresh_token', data.refreshToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: data.refreshTokenExpiresIn,
    });
    const user = await getUser(data.accessToken);
    return server_1.NextResponse.json({
        accessToken: data.accessToken,
        accessTokenExpiresIn: data.accessTokenExpiresIn,
        refreshTokenExpiresIn: data.refreshTokenExpiresIn,
        user,
    });
}
//# sourceMappingURL=route.js.map