'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Topbar = Topbar;
const react_1 = require("react");
const auth_provider_1 = require("@/components/providers/auth-provider");
const theme_toggle_1 = require("@/components/shared/theme-toggle");
const avatar_1 = require("@/components/ui/avatar");
const badge_1 = require("@/components/ui/badge");
function Topbar() {
    const { user, logout } = (0, auth_provider_1.useAuth)();
    const initials = (0, react_1.useMemo)(() => user?.name?.split(' ').map((part) => part[0]).slice(0, 2).join('') || 'PB', [user]);
    return (<header className="flex items-center justify-between border-b bg-background/80 px-6 py-4">
      <div>
        <div className="text-base font-semibold">Planejamento Orcamentario</div>
        <div className="text-sm text-muted-foreground">Controle por coordenador</div>
      </div>

      <div className="flex items-center gap-4">
        {user && (<badge_1.Badge variant="outline" className="text-xs uppercase tracking-wide">
            {user.role}
          </badge_1.Badge>)}
        <theme_toggle_1.ThemeToggle />
        <div className="flex items-center gap-2">
          <avatar_1.Avatar className="h-8 w-8">
            <avatar_1.AvatarFallback>{initials}</avatar_1.AvatarFallback>
          </avatar_1.Avatar>
          <div className="text-right">
            <div className="text-sm font-medium">{user?.name || 'Usuario'}</div>
            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={logout}>
              Sair
            </button>
          </div>
        </div>
      </div>
    </header>);
}
//# sourceMappingURL=topbar.js.map