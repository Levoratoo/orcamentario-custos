'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppShell = AppShell;
const sidebar_1 = require("@/components/layout/sidebar");
const topbar_1 = require("@/components/layout/topbar");
const auth_provider_1 = require("@/components/providers/auth-provider");
function AppShell({ children }) {
    const { isLoading } = (0, auth_provider_1.useAuth)();
    if (isLoading) {
        return <div className="flex h-screen items-center justify-center text-muted-foreground">Carregando...</div>;
    }
    return (<div className="flex h-screen w-full">
      <sidebar_1.Sidebar />
      <div className="flex flex-1 flex-col">
        <topbar_1.Topbar />
        <main className="flex-1 overflow-y-auto px-6 py-6">{children}</main>
      </div>
    </div>);
}
//# sourceMappingURL=app-shell.js.map