"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.middleware = middleware;
const server_1 = require("next/server");
const PUBLIC_PATHS = ['/login'];
function middleware(request) {
    const { pathname } = request.nextUrl;
    if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.includes('.')) {
        return server_1.NextResponse.next();
    }
    if (PUBLIC_PATHS.includes(pathname)) {
        return server_1.NextResponse.next();
    }
    const refreshToken = request.cookies.get('refresh_token');
    if (!refreshToken) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return server_1.NextResponse.redirect(url);
    }
    return server_1.NextResponse.next();
}
exports.config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
//# sourceMappingURL=middleware.js.map