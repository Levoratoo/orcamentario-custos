'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Menu, ChevronDown } from 'lucide-react';
import { SidebarNav, ThemeModeSwitch } from '@/components/layout/sidebar';
import Link from 'next/link';

export function Topbar() {
  const { user, logout } = useAuth();
  const initials = useMemo(() => user?.name?.split(' ').map((part) => part[0]).slice(0,2).join('') || 'PB', [user]);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="topbar-glow flex items-center justify-between px-4 py-3.5 lg:px-6">
      <div>
        <div className="text-base font-semibold">Planejamento Orcamentario</div>
        <div className="text-sm text-muted-foreground">Controle por coordenador</div>
      </div>

      <div className="flex items-center gap-4">
        <div className="lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 border-r border-border/70 bg-[color:var(--surface-1)]">
              <SheetHeader className="space-y-1">
                <SheetTitle className="text-lg font-semibold tracking-tight">Printbag</SheetTitle>
                <div className="text-xs text-muted-foreground">Planejamento Orcamentario</div>
              </SheetHeader>
              <div className="mt-6">
                <SidebarNav onNavigate={() => setMobileOpen(false)} />
                <div className="mt-3">
                  <ThemeModeSwitch compact />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
        {user?.role === 'ADMIN' && (
          <Badge variant="outline" className="text-xs uppercase tracking-wide">
            ADMIN
          </Badge>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="group flex items-center gap-3 rounded-full border border-border/70 bg-[color:var(--surface-1)] px-3 py-1.5 hover:border-[color:var(--accent-border)] hover:bg-[color:var(--surface-2)]"
            >
              <Avatar className="h-8 w-8 ring-2 ring-[color:var(--accent-border)]">
                <AvatarFallback className="text-muted-foreground transition-colors group-hover:text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="text-sm font-semibold">{user?.name || 'Usuario'}</div>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link href="/minha-conta">Minha conta</Link>
            </DropdownMenuItem>
            {user?.role === 'ADMIN' && (
              <DropdownMenuItem asChild>
                <Link href="/admin/users">Usuarios</Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>Sair e fazer logoff</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
