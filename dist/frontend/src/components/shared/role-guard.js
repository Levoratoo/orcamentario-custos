'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleGuard = RoleGuard;
const auth_provider_1 = require("@/components/providers/auth-provider");
const card_1 = require("@/components/ui/card");
function RoleGuard({ roles, children }) {
    const { user } = (0, auth_provider_1.useAuth)();
    if (!user)
        return null;
    if (!roles.includes(user.role)) {
        return (<card_1.Card className="rounded-2xl p-6 text-center text-muted-foreground">
        Voce nao tem permissao para acessar esta area.
      </card_1.Card>);
    }
    return <>{children}</>;
}
//# sourceMappingURL=role-guard.js.map