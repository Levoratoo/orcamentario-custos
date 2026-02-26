'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AuditPage;
const card_1 = require("@/components/ui/card");
const role_guard_1 = require("@/components/shared/role-guard");
function AuditPage() {
    return (<role_guard_1.RoleGuard roles={['ADMIN', 'CONTROLLER']}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Auditoria</h1>
          <p className="text-sm text-muted-foreground">Logs e alteracoes recentes (placeholder).</p>
        </div>
        <card_1.Card className="rounded-2xl p-6 text-sm text-muted-foreground">
          TODO: Conectar endpoint de auditoria quando disponivel.
        </card_1.Card>
      </div>
    </role_guard_1.RoleGuard>);
}
//# sourceMappingURL=page.js.map