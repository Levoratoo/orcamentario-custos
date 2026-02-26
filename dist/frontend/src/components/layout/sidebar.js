'use client';
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sidebar = Sidebar;
const link_1 = __importDefault(require("next/link"));
const navigation_1 = require("next/navigation");
const utils_1 = require("@/lib/utils");
const badge_1 = require("@/components/ui/badge");
const lucide_react_1 = require("lucide-react");
const auth_provider_1 = require("@/components/providers/auth-provider");
const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: lucide_react_1.LayoutGrid, roles: ['ADMIN', 'CONTROLLER', 'COORDINATOR'] },
    { href: '/budget', label: 'Grid Orcamentario', icon: lucide_react_1.Wallet, roles: ['ADMIN', 'CONTROLLER', 'COORDINATOR'] },
    { href: '/scenarios', label: 'Cenarios', icon: lucide_react_1.ListChecks, roles: ['ADMIN', 'CONTROLLER'] },
    { href: '/accounts', label: 'Contas', icon: lucide_react_1.BookOpen, roles: ['ADMIN', 'CONTROLLER'] },
    { href: '/cost-centers', label: 'Centros de Custo', icon: lucide_react_1.Building2, roles: ['ADMIN', 'CONTROLLER'] },
    { href: '/audit', label: 'Auditoria', icon: lucide_react_1.ShieldCheck, roles: ['ADMIN', 'CONTROLLER'] },
];
function Sidebar() {
    const pathname = (0, navigation_1.usePathname)();
    const { user } = (0, auth_provider_1.useAuth)();
    return (<aside className="flex h-full w-64 flex-col border-r bg-card/80 px-4 py-6">
      <div className="mb-6">
        <div className="text-lg font-semibold">Printbag</div>
        <div className="text-sm text-muted-foreground">Planejamento Orcamentario</div>
      </div>

      <nav className="space-y-1">
        {navItems
            .filter((item) => user && item.roles.includes(user.role))
            .map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (<link_1.default key={item.href} href={item.href} className={(0, utils_1.cn)('flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition', active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted')}>
                <Icon className="h-4 w-4"/>
                {item.label}
              </link_1.default>);
        })}
      </nav>

      <div className="mt-auto rounded-2xl border bg-background/60 p-3 text-xs text-muted-foreground">
        Ambiente seguro com RBAC ativo.
        <badge_1.Badge variant="secondary" className="mt-2 w-fit">Backend conectado</badge_1.Badge>
      </div>
    </aside>);
}
//# sourceMappingURL=sidebar.js.map