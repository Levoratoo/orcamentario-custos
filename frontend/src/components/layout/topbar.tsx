'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Menu, ChevronDown } from 'lucide-react';
import { SidebarNav, ThemeModeSwitch } from '@/components/layout/sidebar';
import Link from 'next/link';

export function Topbar() {
  const { user, logout } = useAuth();
  const initials = useMemo(() => user?.name?.split(' ').map((part) => part[0]).slice(0,2).join('') || 'NX', [user]);
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
                <SheetTitle className="text-lg font-semibold tracking-tight">Nexora</SheetTitle>
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="group relative h-11 rounded-2xl border border-[color:var(--border-base)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-1)_98%,white_2%),color-mix(in_srgb,var(--surface-2)_64%,var(--surface-1)))] px-2.5 pr-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.34),0_8px_22px_rgba(15,23,42,0.14)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[color:var(--accent-border)] hover:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-1)_96%,white_4%),color-mix(in_srgb,var(--surface-2)_72%,var(--surface-1)))] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_14px_28px_rgba(15,23,42,0.2)] focus-visible:ring-2 focus-visible:ring-[color:var(--accent-border)] focus-visible:ring-offset-0"
            >
              <div className="rounded-full border border-[color:var(--accent-border)]/80 bg-[color:var(--surface-2)] p-0.5 shadow-[0_0_0_1px_rgba(255,255,255,0.12)] transition-colors group-hover:border-[color:var(--accent-border)]">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-[linear-gradient(165deg,color-mix(in_srgb,var(--accent-2)_24%,var(--surface-1)),color-mix(in_srgb,var(--accent)_22%,var(--surface-2)))] text-[11px] font-semibold tracking-[0.02em] text-muted-foreground transition-colors group-hover:text-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="text-sm font-semibold tracking-tight text-foreground/90 transition-colors group-hover:text-foreground">
                {user?.name || 'Usuario'}
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-all duration-200 group-hover:text-foreground group-data-[state=open]:rotate-180" />
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
