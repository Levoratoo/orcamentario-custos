"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
exports.PUT = PUT;
exports.DELETE = DELETE;
const server_1 = require("next/server");
function getApiBaseUrl() {
    return process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';
}
async function GET(request, { params }) {
    return proxyRequest(request, params.path);
}
async function POST(request, { params }) {
    return proxyRequest(request, params.path);
}
async function PUT(request, { params }) {
    return proxyRequest(request, params.path);
}
async function DELETE(request, { params }) {
    return proxyRequest(request, params.path);
}
async function proxyRequest(request, pathParts) {
    const url = `${getApiBaseUrl()}/${pathParts.join('/')}${request.nextUrl.search}`;
    const headers = new Headers(request.headers);
    headers.delete('host');
    const response = await fetch(url, {
        method: request.method,
        headers,
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
    });
    const contentType = response.headers.get('content-type') || 'application/json';
    const data = await response.arrayBuffer();
    return new server_1.NextResponse(data, {
        status: response.status,
        headers: { 'content-type': contentType },
    });
}
//# sourceMappingURL=route.js.map